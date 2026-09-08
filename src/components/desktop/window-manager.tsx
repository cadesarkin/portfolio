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
  type Rect,
  type Win,
} from "./window-reducer"
import type { VNode } from "@/lib/vfs-types"

type KeyHandler = (e: KeyboardEvent) => void

interface WindowApi {
  wins: Win[]
  focused: string | null
  open: (node: VNode) => void
  close: (id: string) => void
  focus: (id: string) => void
  move: (id: string, rect: Partial<Rect>) => void
  resize: (id: string, rect: Partial<Rect>) => void
  minimize: (id: string) => void
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

  const handlers = useRef(new Map<string, KeyHandler>())
  // Read by the document listener, which is installed once and must not be
  // torn down and rebuilt every time focus changes.
  const focusedRef = useRef<string | null>(null)
  focusedRef.current = state.focused

  const registerKeys = useCallback((id: string, handler: KeyHandler) => {
    handlers.current.set(id, handler)
    return () => {
      // Only remove our own entry: a remount may already have replaced it.
      if (handlers.current.get(id) === handler) handlers.current.delete(id)
    }
  }, [])

  /**
   * One listener for every window.
   *
   * Terminal, Snake, Cube Runner and Pong all want the arrow keys. If each
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

      handlers.current.get(id)?.(e)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  const api = useMemo<WindowApi>(
    () => ({
      wins: state.wins,
      focused: state.focused,
      open: (node) => dispatch({ type: "OPEN", node }),
      close: (id) => dispatch({ type: "CLOSE", id }),
      focus: (id) => dispatch({ type: "FOCUS", id }),
      move: (id, rect) => dispatch({ type: "MOVE", id, rect }),
      resize: (id, rect) => dispatch({ type: "RESIZE", id, rect }),
      minimize: (id) => dispatch({ type: "MINIMIZE", id }),
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
