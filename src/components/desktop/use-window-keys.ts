"use client"

import { useEffect, useRef } from "react"
import { useWindows } from "./window-manager"

/**
 * Subscribes a window to keyboard events, delivered only while it is focused.
 *
 * The handler is held in a ref, so callers can pass an inline arrow function
 * without re-subscribing on every render.
 */
export function useWindowKeys(
  winId: string,
  handler: (e: KeyboardEvent) => void
) {
  const { registerKeys } = useWindows()
  const ref = useRef(handler)
  ref.current = handler

  useEffect(
    () => registerKeys(winId, (e) => ref.current(e)),
    [winId, registerKeys]
  )
}
