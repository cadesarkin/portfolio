"use client"

import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { useWindows } from "./window-manager"
import { useWindowKeys } from "./use-window-keys"
import { allowed, stackOrder, type Win, type WinGrid } from "./window-reducer"
import { CURSOR, EDGES, cropBy, type Crop, type Edge } from "./window-crop"

const MIN_W = 320
const MIN_H = 200
/** Title bar kept on screen, so a window can always be dragged back. */
const KEEP_VISIBLE = 88
const TITLEBAR_H = 32
const TASKBAR_H = 32

/**
 * Where a window's content area sits inside it, measured rather than assumed:
 * the chrome is whatever the CSS says it is today.
 */
function chromeOf(el: HTMLElement, body: HTMLElement) {
  const outer = el.getBoundingClientRect()
  const inner = body.getBoundingClientRect()
  return {
    offX: inner.left - outer.left,
    offY: inner.top - outer.top,
    extraW: outer.width - inner.width,
    extraH: outer.height - inner.height,
  }
}

/** The nearest outer position that puts the content area on the grid. */
const snapTo = (pos: number, off: number, cell: number): number =>
  Math.round((pos + off) / cell) * cell - off

/** Where the content sits inside a cropped window, for the element's style. */
function cropStyle(el: HTMLElement, g: WinGrid, c: Pick<Crop, "ox" | "oy">) {
  el.dataset.ox = String(c.ox)
  el.dataset.oy = String(c.oy)
  el.style.setProperty("--crop-x", `${c.ox * g.cw}px`)
  el.style.setProperty("--crop-y", `${c.oy * g.ch}px`)
}

interface Props {
  win: Win
  isMobile: boolean
  children: React.ReactNode
}

export default function Window({ win, isMobile, children }: Props) {
  const { focused, focus, close, move, resize, regrid, minimize, maximize, restore } =
    useWindows()
  const isFocused = focused === win.id

  const elRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  /** Live geometry during a gesture. Committed to the reducer on release. */
  const dragRef = useRef<{ x: number; y: number; w: number; h: number } | null>(
    null
  )

  useWindowKeys(win.id, (e) => {
    // The app inside gets first refusal: if it handled Escape, leave it alone.
    if (e.key === "Escape" && !e.defaultPrevented && allowed(win, "close")) {
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

  /**
   * Puts a grid window's content area exactly on the grid, at exactly its size
   * in cells. Runs whenever the window's geometry changes, so a window opened
   * at an approximate rect settles into place on its first frame, and one that
   * drifted cannot stay off the grid.
   */
  const grid = win.grid
  useLayoutEffect(() => {
    if (!grid || isMobile || win.state !== "normal") return
    const el = elRef.current
    const body = bodyRef.current
    if (!el || !body) return
    const c = chromeOf(el, body)
    const x = snapTo(win.rect.x, c.offX, grid.cw)
    const y = snapTo(win.rect.y, c.offY, grid.ch)
    const w = grid.cols ? grid.cols * grid.cw + c.extraW : win.rect.w
    const h = grid.rows ? grid.rows * grid.ch + c.extraH : win.rect.h
    const off = (a: number, b: number) => Math.abs(a - b) > 0.25
    if (off(x, win.rect.x) || off(y, win.rect.y)) move(win.id, { x, y }, true)
    if (off(w, win.rect.w) || off(h, win.rect.h)) resize(win.id, { w, h }, true)
  }, [
    grid,
    isMobile,
    win.state,
    win.id,
    win.rect.x,
    win.rect.y,
    win.rect.w,
    win.rect.h,
    move,
    resize,
  ])

  const startDrag = useCallback(
    (e: React.PointerEvent, mode: "move" | "resize") => {
      if (isMobile || win.state === "maximized") return
      // Ignore clicks on the titlebar buttons.
      if ((e.target as HTMLElement).closest("button")) return
      // A window that may not move is still focused by a press on its bar.
      if (!allowed(win, mode === "move" ? "move" : "resize")) {
        focus(win.id)
        return
      }

      e.preventDefault()
      focus(win.id)

      const el = elRef.current
      if (!el) return

      const startX = e.clientX
      const startY = e.clientY
      const base = { ...win.rect }
      const body = bodyRef.current
      const chrome = win.grid && body ? chromeOf(el, body) : null
      dragRef.current = { ...base }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY

        if (mode === "move") {
          const maxX = window.innerWidth - KEEP_VISIBLE
          const maxY = window.innerHeight - TASKBAR_H - TITLEBAR_H
          let x = Math.min(Math.max(base.x + dx, KEEP_VISIBLE - base.w), maxX)
          let y = Math.min(Math.max(base.y + dy, 0), maxY)
          // A grid window moves a whole cell at a time, which is what turns
          // lining two of them up into a click into place, not a pixel hunt.
          if (win.grid && chrome) {
            x = snapTo(x, chrome.offX, win.grid.cw)
            y = snapTo(y, chrome.offY, win.grid.ch)
          }
          dragRef.current = { ...base, x, y }
          // Written straight to the element: dispatching per pointermove would
          // re-render every window sixty times a second.
          el.style.left = `${x}px`
          el.style.top = `${y}px`
          // Anything that needs to know where windows are mid-drag listens for
          // this instead of waiting for the drop.
          el.dispatchEvent(new CustomEvent("win-geometry", { bubbles: true }))
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
    [isMobile, win, focus, move, resize]
  )

  /**
   * Cropping: dragging an edge of a window whose content is bigger than it.
   * The content stays where it is on screen and the window's edge moves over
   * it, a whole cell at a time. Committed to the reducer on release; until
   * then the element, and the crop it announces, are written directly.
   */
  const startCrop = useCallback(
    (e: React.PointerEvent, edge: Edge) => {
      const g = win.grid
      const el = elRef.current
      if (!g?.max || !g.cols || !g.rows || !el || !allowed(win, "resize")) return
      e.preventDefault()
      e.stopPropagation()
      focus(win.id)

      const startX = e.clientX
      const startY = e.clientY
      const base = { ...win.rect }
      const from: Crop = { ox: g.ox ?? 0, oy: g.oy ?? 0, cols: g.cols, rows: g.rows }
      let crop = from
      let rect = base
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      const onMove = (ev: PointerEvent) => {
        const dx = Math.round((ev.clientX - startX) / g.cw)
        const dy = Math.round((ev.clientY - startY) / g.ch)
        crop = cropBy(g, from, edge, dx, dy)
        rect = {
          x: base.x + (crop.ox - from.ox) * g.cw,
          y: base.y + (crop.oy - from.oy) * g.ch,
          w: base.w + (crop.cols - from.cols) * g.cw,
          h: base.h + (crop.rows - from.rows) * g.ch,
        }
        el.style.left = `${rect.x}px`
        el.style.top = `${rect.y}px`
        el.style.width = `${rect.w}px`
        el.style.height = `${rect.h}px`
        cropStyle(el, g, crop)
        el.dispatchEvent(new CustomEvent("win-geometry", { bubbles: true }))
      }

      const onUp = () => {
        document.removeEventListener("pointermove", onMove)
        document.removeEventListener("pointerup", onUp)
        regrid(win.id, crop, rect)
      }

      document.addEventListener("pointermove", onMove)
      document.addEventListener("pointerup", onUp)
    },
    [win, focus, regrid]
  )

  if (win.state === "minimized") return null

  const maximized = win.state === "maximized"
  const can = {
    close: allowed(win, "close"),
    minimize: allowed(win, "minimize"),
    maximize: allowed(win, "maximize"),
    // A window sized in whole cells has no business being dragged bigger —
    // unless its content is bigger still, and then its edges crop it.
    resize: allowed(win, "resize") && !win.grid?.cols,
    crop: allowed(win, "resize") && Boolean(win.grid?.max),
  }
  const crop = win.grid && {
    "--crop-x": `${(win.grid.ox ?? 0) * win.grid.cw}px`,
    "--crop-y": `${(win.grid.oy ?? 0) * win.grid.ch}px`,
  }

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
      data-locked={allowed(win, "move") ? undefined : ""}
      data-grid={win.grid ? "" : undefined}
      data-crop={can.crop && !isMobile ? "" : undefined}
      data-ox={win.grid ? (win.grid.ox ?? 0) : undefined}
      data-oy={win.grid ? (win.grid.oy ?? 0) : undefined}
      style={{ ...geometry, ...crop, zIndex: 20 + stackOrder(win) } as React.CSSProperties}
    >
      <div
        className="win-bar"
        onPointerDown={(e) => startDrag(e, "move")}
        onDoubleClick={() =>
          !isMobile && can.maximize && (maximized ? restore(win.id) : maximize(win.id))
        }
      >
        <span className="win-title" id={`title-${win.id}`}>
          {win.title}
        </span>
        <span className="win-buttons">
          {isMobile ? (
            can.close && (
              <button
                type="button"
                onClick={() => close(win.id)}
                aria-label={`Close ${win.title}`}
              >
                [×]
              </button>
            )
          ) : (
            <>
              {can.minimize && (
                <button
                  type="button"
                  onClick={() => minimize(win.id)}
                  aria-label={`Minimize ${win.title}`}
                >
                  [–]
                </button>
              )}
              {can.maximize && (
                <button
                  type="button"
                  onClick={() =>
                    maximized ? restore(win.id) : maximize(win.id)
                  }
                  aria-label={`${maximized ? "Restore" : "Maximize"} ${win.title}`}
                >
                  [□]
                </button>
              )}
              {can.close && (
                <button
                  type="button"
                  onClick={() => close(win.id)}
                  aria-label={`Close ${win.title}`}
                >
                  [×]
                </button>
              )}
            </>
          )}
        </span>
      </div>

      <div
        className="win-body"
        ref={bodyRef}
        tabIndex={-1}
        // Grid content is laid out to the cell; a crop hides the rest of it.
        style={win.grid ? { overflow: "hidden" } : undefined}
      >
        {children}
      </div>

      {!isMobile && !maximized && can.resize && (
        <div
          className="win-grip"
          onPointerDown={(e) => startDrag(e, "resize")}
          aria-hidden="true"
        />
      )}

      {!isMobile &&
        !maximized &&
        can.crop &&
        EDGES.map((edge) => (
          <div
            key={edge}
            className={`win-edge win-edge-${edge}`}
            style={{ cursor: CURSOR[edge] }}
            onPointerDown={(e) => startCrop(e, edge)}
            aria-hidden="true"
          />
        ))}
    </div>
  )
}
