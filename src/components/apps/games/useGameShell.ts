"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** Per-game high score, kept in localStorage. */
export function useHighScore(key: string) {
  const [best, setBest] = useState(0)
  const storageKey = `sarkin.hi.${key}`

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem(storageKey)) || 0)
    } catch {
      // Unavailable storage: the score simply stays session-local.
    }
  }, [storageKey])

  const submit = useCallback(
    (score: number) => {
      setBest((prev) => {
        if (score <= prev) return prev
        try {
          localStorage.setItem(storageKey, String(score))
        } catch {
          // Non-fatal.
        }
        return score
      })
    },
    [storageKey]
  )

  return { best, submit }
}

/**
 * A requestAnimationFrame loop that pauses when the tab is hidden or the game
 * is not focused.
 *
 * `onFrame` receives seconds elapsed, clamped: returning from a background tab
 * would otherwise deliver one enormous delta and teleport everything through
 * walls.
 */
export function useGameLoop(
  active: boolean,
  onFrame: (dt: number) => void
) {
  const cb = useRef(onFrame)
  cb.current = onFrame

  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (document.hidden) {
        last = now
        return
      }
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      cb.current(dt)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [active])
}

/** Sizes a canvas to its container at device pixel ratio. */
export function useCanvasSize(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  wrapRef: React.RefObject<HTMLDivElement | null>
) {
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const sync = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext("2d")
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
      setSize({ w: rect.width, h: rect.height })
    }

    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [canvasRef, wrapRef])

  return size
}
