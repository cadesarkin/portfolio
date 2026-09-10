/**
 * Window manager state.
 *
 * Pure — no DOM reads, no React. Window ids are VFS paths, which is what makes
 * open-dedupe free: opening a folder that is already open can only ever focus
 * the existing window.
 */

import { pathOf } from "@/lib/vfs-utils"
import type { AppKey, VNode } from "@/lib/vfs-types"

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** What a user may do to a window. Anything unset is allowed. */
export type Allow = Partial<Record<"move" | "resize" | "close" | "minimize" | "maximize", boolean>>

/**
 * A character grid a window's content is drawn on.
 *
 * While set, the window moves in whole cells, with its content area kept on
 * the grid; with cols and rows, the content area is sized to exactly that
 * many cells. This is what lets content in two separate windows line up.
 */
export interface WinGrid {
  cw: number
  ch: number
  cols?: number
  rows?: number
}

export interface Win {
  /** The node's VFS path, unless the window was opened with its own id. */
  id: string
  node: VNode
  title: string
  rect: Rect
  z: number
  state: "normal" | "minimized" | "maximized"
  /** Rect to return to from maximized. */
  prevRect?: Rect
  allow?: Allow
  grid?: WinGrid
  /** Drawn over every window without it, whatever has focus. */
  onTop?: boolean
}

/** Options for opening a window that is not simply a VFS node. */
export interface OpenOptions {
  /**
   * An id of its own. Needed to open the same node more than once — a game
   * whose level is several windows — since ids are otherwise the node's path.
   */
  id?: string
  title?: string
  rect?: Rect
  allow?: Allow
  grid?: WinGrid
  onTop?: boolean
}

/**
 * The order windows are stacked in, nearest the viewer highest.
 *
 * One function, used by the renderer and by anything that asks what is on top
 * of what, so the two can never disagree.
 */
export const stackOrder = (w: Pick<Win, "z" | "onTop">): number =>
  (w.onTop ? 1_000_000 : 0) + w.z

export const allowed = (w: Win, what: keyof Allow): boolean => w.allow?.[what] !== false

export interface WindowState {
  wins: Win[]
  focused: string | null
  zTop: number
  /** Cascade counter, so consecutive opens step down and across. */
  opened: number
}

export type WindowAction =
  | { type: "OPEN"; node: VNode; opts?: OpenOptions }
  | { type: "CLOSE"; id: string; force?: boolean }
  | { type: "FOCUS"; id: string }
  /**
   * `force` lets the program that owns a window move it even where the user
   * may not — a locked room still has to be placed, and snapped onto the grid.
   */
  | { type: "MOVE"; id: string; rect: Partial<Rect>; force?: boolean }
  | { type: "RESIZE"; id: string; rect: Partial<Rect>; force?: boolean }
  | { type: "MINIMIZE"; id: string }
  | { type: "MINIMIZE_ALL" }
  | { type: "MAXIMIZE"; id: string }
  | { type: "RESTORE"; id: string }

export const initialWindowState: WindowState = {
  wins: [],
  focused: null,
  zTop: 10,
  opened: 0,
}

/** Default window size per app. Folders and files share the generic size. */
const SIZES: Partial<Record<AppKey, { w: number; h: number }>> = {
  terminal: { w: 820, h: 500 },
  resume: { w: 860, h: 680 },
  contact: { w: 560, h: 330 },
  display: { w: 520, h: 440 },
  minesweeper: { w: 480, h: 560 },
  snake: { w: 660, h: 560 },
  pong: { w: 760, h: 500 },
  solitaire: { w: 900, h: 640 },
  paint: { w: 700, h: 640 },
  music: { w: 520, h: 420 },
  leaderboard: { w: 620, h: 660 },
  starmap: { w: 860, h: 620 },
  defrag: { w: 340, h: 300 },
}

const DEFAULT_SIZE = { w: 720, h: 480 }
const CASCADE_STEP = 28
const CASCADE_WRAP = 8
const ORIGIN = { x: 132, y: 64 }

function sizeFor(node: VNode) {
  if (node.kind === "app") return SIZES[node.app] ?? DEFAULT_SIZE
  if (node.kind === "file") return { w: 720, h: 540 }
  if (node.kind === "image") return { w: 880, h: 620 }
  return DEFAULT_SIZE
}

function rectFor(node: VNode, opened: number): Rect {
  const { w, h } = sizeFor(node)
  const step = opened % CASCADE_WRAP
  return {
    x: ORIGIN.x + step * CASCADE_STEP,
    y: ORIGIN.y + step * CASCADE_STEP,
    w,
    h,
  }
}

/** The window that should take focus once `excludeId` is gone or hidden. */
function nextFocus(wins: Win[], excludeId: string): string | null {
  const candidates = wins.filter(
    (w) => w.id !== excludeId && w.state !== "minimized"
  )
  if (candidates.length === 0) return null
  return candidates.reduce((a, b) => (a.z > b.z ? a : b)).id
}

export function windowReducer(
  state: WindowState,
  action: WindowAction
): WindowState {
  switch (action.type) {
    case "OPEN": {
      const { node, opts } = action
      // Links navigate; they never become windows.
      if (node.kind === "link") return state

      const id = opts?.id ?? pathOf(node)
      const existing = state.wins.find((w) => w.id === id)
      const z = state.zTop + 1

      if (existing) {
        return {
          ...state,
          zTop: z,
          focused: id,
          wins: state.wins.map((w) =>
            w.id === id
              ? {
                  ...w,
                  z,
                  state: w.state === "minimized" ? "normal" : w.state,
                }
              : w
          ),
        }
      }

      const win: Win = {
        id,
        node,
        title: opts?.title ?? node.label ?? node.name,
        rect: opts?.rect ?? rectFor(node, state.opened),
        z,
        state: "normal",
        ...(opts?.allow && { allow: opts.allow }),
        ...(opts?.grid && { grid: opts.grid }),
        ...(opts?.onTop && { onTop: true }),
      }
      return {
        ...state,
        wins: [...state.wins, win],
        focused: id,
        zTop: z,
        opened: state.opened + 1,
      }
    }

    case "CLOSE": {
      const target = state.wins.find((w) => w.id === action.id)
      if (!target || (!allowed(target, "close") && !action.force)) return state
      const wins = state.wins.filter((w) => w.id !== action.id)
      return {
        ...state,
        wins,
        focused:
          state.focused === action.id
            ? nextFocus(wins, action.id)
            : state.focused,
      }
    }

    case "FOCUS": {
      if (!state.wins.some((w) => w.id === action.id)) return state
      const z = state.zTop + 1
      return {
        ...state,
        zTop: z,
        focused: action.id,
        wins: state.wins.map((w) =>
          w.id === action.id
            ? { ...w, z, state: w.state === "minimized" ? "normal" : w.state }
            : w
        ),
      }
    }

    case "MOVE":
    case "RESIZE": {
      const target = state.wins.find((w) => w.id === action.id)
      if (!target) return state
      if (!allowed(target, action.type === "MOVE" ? "move" : "resize") && !action.force) {
        return state
      }
      return {
        ...state,
        wins: state.wins.map((w) =>
          w.id === action.id ? { ...w, rect: { ...w.rect, ...action.rect } } : w
        ),
      }
    }

    case "MINIMIZE": {
      const target = state.wins.find((w) => w.id === action.id)
      if (!target || !allowed(target, "minimize")) return state
      const wins = state.wins.map((w) =>
        w.id === action.id ? { ...w, state: "minimized" as const } : w
      )
      return {
        ...state,
        wins,
        focused:
          state.focused === action.id
            ? nextFocus(wins, action.id)
            : state.focused,
      }
    }

    case "MINIMIZE_ALL": {
      // "Show desktop" leaves alone any window that may not be minimized.
      const wins = state.wins.map((w) =>
        allowed(w, "minimize") ? { ...w, state: "minimized" as const } : w
      )
      const left = wins.filter((w) => w.state !== "minimized")
      return {
        ...state,
        wins,
        focused: left.length ? left.reduce((a, b) => (a.z > b.z ? a : b)).id : null,
      }
    }

    case "MAXIMIZE": {
      const target = state.wins.find((w) => w.id === action.id)
      if (!target || !allowed(target, "maximize")) return state
      const z = state.zTop + 1
      return {
        ...state,
        zTop: z,
        focused: action.id,
        wins: state.wins.map((w) =>
          w.id === action.id
            ? {
                ...w,
                z,
                state: "maximized" as const,
                // Keep the first pre-maximize rect; maximizing twice must not
                // overwrite it with the maximized geometry.
                prevRect: w.prevRect ?? w.rect,
              }
            : w
        ),
      }
    }

    case "RESTORE": {
      if (!state.wins.some((w) => w.id === action.id)) return state
      const z = state.zTop + 1
      return {
        ...state,
        zTop: z,
        focused: action.id,
        wins: state.wins.map((w) =>
          w.id === action.id
            ? {
                ...w,
                z,
                state: "normal" as const,
                rect: w.prevRect ?? w.rect,
                prevRect: undefined,
              }
            : w
        ),
      }
    }

    default:
      return state
  }
}
