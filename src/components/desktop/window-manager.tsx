"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react"
import {
  windowReducer,
  initialWindowState,
  type Allow,
  type OpenOptions,
  type Rect,
  type Win,
  type WinGrid,
} from "./window-reducer"
import type { VNode } from "@/lib/vfs-types"

type KeyHandler = (e: KeyboardEvent) => void

interface WindowApi {
  wins: Win[]
  focused: string | null
  open: (node: VNode, opts?: OpenOptions) => void
  /** `force` closes a window the user may not close, for the program that owns it. */
  close: (id: string, force?: boolean) => void
  focus: (id: string) => void
  move: (id: string, rect: Partial<Rect>, force?: boolean) => void
  resize: (id: string, rect: Partial<Rect>, force?: boolean) => void
  regrid: (id: string, grid: Partial<WinGrid>, rect?: Partial<Rect>, force?: boolean) => void
  configure: (id: string, opts: { allow?: Allow; title?: string }) => void
  /** Brings a window forward without taking focus. */
  raise: (id: string) => void
  /** `force` minimizes a window the user may not, for the program that owns it. */
  minimize: (id: string, force?: boolean) => void
  minimizeAll: () => void
  maximize: (id: string) => void
  restore: (id: string) => void
  /** Registers a key handler that fires only while `id` is focused. */
  registerKeys: (id: string, handler: KeyHandler) => () => void
}

const WindowContext = createContext<WindowApi | null>(null)

export function useWindows(): WindowApi {
  const ctx = useContext(WindowContext)
  if (!ctx) throw new Error("useWindows must be used inside <WindowProvider>")
  return ctx
}

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(windowReducer, initialWindowState)

  /**
   * Key handlers per window, as a set rather than a single entry.
   *
   * A window commonly has more than one subscriber: `Window` itself registers
   * Escape-to-close, and the app inside it registers its own keys under the
   * same id. Storing one handler per id meant the later registration silently
   * replaced the earlier one — and since effects run child-before-parent, the
   * window's Escape handler always won, leaving games and folder navigation
   * with no keyboard at all.
   */
  const handlers = useRef(new Map<string, Set<KeyHandler>>())
  // Read by the document listener, which is installed once and must not be
  // torn down and rebuilt every time focus changes.
  const focusedRef = useRef<string | null>(null)
  focusedRef.current = state.focused

  const registerKeys = useCallback((id: string, handler: KeyHandler) => {
    let set = handlers.current.get(id)
    if (!set) {
      set = new Set()
      handlers.current.set(id, set)
    }
    set.add(handler)
    return () => {
      const current = handlers.current.get(id)
      if (!current) return
      current.delete(handler)
      if (current.size === 0) handlers.current.delete(id)
    }
  }, [])

  /**
   * One listener for every window.
   *
   * Terminal, Snake and Pong all want the arrow keys. If each
   * attached its own window listener, typing in the terminal would steer the
   * snake. Routing through focus is what keeps them separate.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const id = focusedRef.current
      if (!id) return

      // Let a focused text field in another window keep its own keystrokes.
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          const owner = target.closest<HTMLElement>("[data-win-id]")
          if (owner && owner.dataset.winId !== id) return
        }
      }

      // Copied before iterating: a handler may unsubscribe during dispatch.
      const subs = handlers.current.get(id)
      if (subs) for (const handler of [...subs]) handler(e)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const api = useMemo<WindowApi>(
    () => ({
      wins: state.wins,
      focused: state.focused,
      open: (node, opts) => dispatch({ type: "OPEN", node, opts }),
      close: (id, force) => dispatch({ type: "CLOSE", id, force }),
      focus: (id) => dispatch({ type: "FOCUS", id }),
      move: (id, rect, force) => dispatch({ type: "MOVE", id, rect, force }),
      resize: (id, rect, force) => dispatch({ type: "RESIZE", id, rect, force }),
      regrid: (id, grid, rect, force) => dispatch({ type: "REGRID", id, grid, rect, force }),
      configure: (id, opts) => dispatch({ type: "CONFIGURE", id, ...opts }),
      raise: (id) => dispatch({ type: "RAISE", id }),
      minimize: (id, force) => dispatch({ type: "MINIMIZE", id, force }),
      minimizeAll: () => dispatch({ type: "MINIMIZE_ALL" }),
      maximize: (id) => dispatch({ type: "MAXIMIZE", id }),
      restore: (id) => dispatch({ type: "RESTORE", id }),
      registerKeys,
    }),
    [state.wins, state.focused, registerKeys]
  )

  return (
    <WindowContext.Provider value={api}>{children}</WindowContext.Provider>
  )
}
