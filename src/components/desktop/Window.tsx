"use client"

import { useCallback, useEffect, useRef } from "react"
import { useWindows } from "./window-manager"
import { useWindowKeys } from "./use-window-keys"
import type { Win } from "./window-reducer"

const MIN_W = 320
const MIN_H = 200
/** Title bar kept on screen, so a window can always be dragged back. */
const KEEP_VISIBLE = 88
const TITLEBAR_H = 28
const TASKBAR_H = 32

interface Props {
  win: Win
  isMobile: boolean
  children: React.ReactNode
}

export default function Window({ win, isMobile, children }: Props) {
  const { focused, focus, close, move, resize, minimize, maximize, restore } =
    useWindows()
  const isFocused = focused === win.id

  const elRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  /** Live geometry during a gesture. Committed to the reducer on release. */
  const dragRef = useRef<{ x: number; y: number; w: number; h: number } | null>(
    null
  )

  useWindowKeys(win.id, (e) => {
    if (e.key === "Escape") {
      e.preventDefault()
      close(win.id)
    }
  })

  // Move focus into the window when it opens or is raised, so keyboard users
  // land inside it rather than back at the top of the document.
  //
  // Skipped when focus is already somewhere inside: an app can claim it first
  // (the terminal autofocuses its input), and effects run child-before-parent,
  // so focusing unconditionally here would take it straight back.
  useEffect(() => {
    if (!isFocused) return
    const el = elRef.current
    if (el?.contains(document.activeElement)) return
    bodyRef.current?.focus({ preventScroll: true })
  }, [isFocused])

  const startDrag = useCallback(
    (e: React.PointerEvent, mode: "move" | "resize") => {
      if (isMobile || win.state === "maximized") return
      // Ignore clicks on the titlebar buttons.
      if ((e.target as HTMLElement).closest("button")) return

      e.preventDefault()
      focus(win.id)

      const el = elRef.current
      if (!el) return

      const startX = e.clientX
      const startY = e.clientY
      const base = { ...win.rect }
      dragRef.current = { ...base }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY

        if (mode === "move") {
          const maxX = window.innerWidth - KEEP_VISIBLE
          const maxY = window.innerHeight - TASKBAR_H - TITLEBAR_H
          const x = Math.min(Math.max(base.x + dx, KEEP_VISIBLE - base.w), maxX)
          const y = Math.min(Math.max(base.y + dy, 0), maxY)
          dragRef.current = { ...base, x, y }
          // Written straight to the element: dispatching per pointermove would
          // re-render every window sixty times a second.
          el.style.left = `${x}px`
          el.style.top = `${y}px`
        } else {
          const w = Math.max(base.w + dx, MIN_W)
          const h = Math.max(base.h + dy, MIN_H)
          dragRef.current = { ...base, w, h }
          el.style.width = `${w}px`
          el.style.height = `${h}px`
        }
      }

      const onUp = () => {
        document.removeEventListener("pointermove", onMove)
        document.removeEventListener("pointerup", onUp)
        const final = dragRef.current
        dragRef.current = null
        if (!final) return
        if (mode === "move") move(win.id, { x: final.x, y: final.y })
        else resize(win.id, { w: final.w, h: final.h })
      }

      document.addEventListener("pointermove", onMove)
      document.addEventListener("pointerup", onUp)
    },
    [isMobile, win.id, win.rect, win.state, focus, move, resize]
  )

  if (win.state === "minimized") return null

  const maximized = win.state === "maximized"

  // Mobile windows are bottom sheets: no drag, no resize, no z-stack.
  const geometry: React.CSSProperties = isMobile
    ? { left: 0, right: 0, bottom: 0, top: "12vh", width: "auto", height: "auto" }
    : maximized
      ? { left: 0, top: 0, width: "100vw", height: `calc(100vh - ${TASKBAR_H}px)` }
      : {
          left: win.rect.x,
          top: win.rect.y,
          width: win.rect.w,
          height: win.rect.h,
        }

  return (
    <div
      ref={elRef}
      role="dialog"
      aria-labelledby={`title-${win.id}`}
      aria-modal={isMobile ? true : undefined}
      data-win-id={win.id}
      onPointerDown={() => !isFocused && focus(win.id)}
      className="win"
      data-focused={isFocused ? "" : undefined}
      data-mobile={isMobile ? "" : undefined}
      style={{ ...geometry, zIndex: 20 + win.z }}
    >
      <div
        className="win-bar"
        onPointerDown={(e) => startDrag(e, "move")}
        onDoubleClick={() =>
          !isMobile && (maximized ? restore(win.id) : maximize(win.id))
        }
      >
        <span className="win-title" id={`title-${win.id}`}>
          {win.title}
        </span>
        <span className="win-buttons">
          {isMobile ? (
            <button
              type="button"
              onClick={() => close(win.id)}
              aria-label={`Close ${win.title}`}
            >
              [×]
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => minimize(win.id)}
                aria-label={`Minimize ${win.title}`}
              >
                [–]
              </button>
              <button
                type="button"
                onClick={() =>
                  maximized ? restore(win.id) : maximize(win.id)
                }
                aria-label={`${maximized ? "Restore" : "Maximize"} ${win.title}`}
              >
                [□]
              </button>
              <button
                type="button"
                onClick={() => close(win.id)}
                aria-label={`Close ${win.title}`}
              >
                [×]
              </button>
            </>
          )}
        </span>
      </div>

      <div className="win-body" ref={bodyRef} tabIndex={-1}>
        {children}
      </div>

      {!isMobile && !maximized && (
        <div
          className="win-grip"
          onPointerDown={(e) => startDrag(e, "resize")}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
