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

export interface Win {
  /** Always the node's VFS path. */
  id: string
  node: VNode
  title: string
  rect: Rect
  z: number
  state: "normal" | "minimized" | "maximized"
  /** Rect to return to from maximized. */
  prevRect?: Rect
}

export interface WindowState {
  wins: Win[]
  focused: string | null
  zTop: number
  /** Cascade counter, so consecutive opens step down and across. */
  opened: number
}

export type WindowAction =
  | { type: "OPEN"; node: VNode }
  | { type: "CLOSE"; id: string }
  | { type: "FOCUS"; id: string }
  | { type: "MOVE"; id: string; rect: Partial<Rect> }
  | { type: "RESIZE"; id: string; rect: Partial<Rect> }
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
  terminal: { w: 720, h: 440 },
  resume: { w: 780, h: 620 },
  contact: { w: 480, h: 300 },
  "cube-runner": { w: 640, h: 520 },
  minesweeper: { w: 420, h: 460 },
  snake: { w: 560, h: 500 },
  pong: { w: 640, h: 440 },
}

const DEFAULT_SIZE = { w: 640, h: 420 }
const CASCADE_STEP = 28
const CASCADE_WRAP = 8
const ORIGIN = { x: 132, y: 64 }

function sizeFor(node: VNode) {
  if (node.kind === "app") return SIZES[node.app] ?? DEFAULT_SIZE
  if (node.kind === "file") return { w: 660, h: 480 }
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
      const { node } = action
      // Links navigate; they never become windows.
      if (node.kind === "link") return state

      const id = pathOf(node)
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
        title: node.label ?? node.name,
        rect: rectFor(node, state.opened),
        z,
        state: "normal",
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
      if (!state.wins.some((w) => w.id === action.id)) return state
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
      if (!state.wins.some((w) => w.id === action.id)) return state
      return {
        ...state,
        wins: state.wins.map((w) =>
          w.id === action.id ? { ...w, rect: { ...w.rect, ...action.rect } } : w
        ),
      }
    }

    case "MINIMIZE": {
      if (!state.wins.some((w) => w.id === action.id)) return state
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

    case "MINIMIZE_ALL":
      return {
        ...state,
        wins: state.wins.map((w) => ({ ...w, state: "minimized" as const })),
        focused: null,
      }

    case "MAXIMIZE": {
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
