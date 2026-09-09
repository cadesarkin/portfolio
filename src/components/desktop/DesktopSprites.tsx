"use client"

import { useEffect, useRef } from "react"
import { step, bob, spriteSize, type Sprite } from "@/lib/sprite"
import { PALETTE } from "@/components/apps/paint/engine"
import { useSprites } from "./sprites-context"

/**
 * Released drawings, drifting across the desktop.
 *
 * Positions are integrated in a ref and written straight to each element's
 * transform. Putting them in React state would re-render every sprite sixty
 * times a second for movement that never changes the markup.
 */
export default function DesktopSprites() {
  const { sprites } = useSprites()
  const nodes = useRef(new Map<string, HTMLDivElement | null>())
  const live = useRef<Sprite[]>([])

  // Re-seed the simulation whenever the set changes, keeping the positions of
  // sprites that were already adrift.
  useEffect(() => {
    const previous = new Map(live.current.map((s) => [s.id, s]))
    live.current = sprites.map((s) => previous.get(s.id) ?? { ...s })
  }, [sprites])

  useEffect(() => {
    if (sprites.length === 0) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

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

      const bounds = { w: window.innerWidth, h: window.innerHeight - 38 }
      const t = now / 1000

      live.current = live.current.map((s) => {
        const next = reduced ? s : step(s, dt, bounds)
        const el = nodes.current.get(s.id)
        if (el) {
          const y = next.y + (reduced ? 0 : bob(next, t))
          el.style.transform = `translate3d(${next.x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        }
        return next
      })
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [sprites])

  if (sprites.length === 0) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5,
        // Never intercept a click meant for the desktop beneath them.
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {sprites.map((s) => {
        const { w, h } = spriteSize(s)
        return (
          <div
            key={s.id}
            ref={(el) => {
              nodes.current.set(s.id, el)
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: w,
              height: h,
              transform: `translate3d(${s.x}px, ${s.y}px, 0)`,
              whiteSpace: "pre",
              fontSize: 12,
              lineHeight: "14px",
              letterSpacing: 0,
              // A pale halo plus a soft drop shadow. The wallpaper runs from
              // white cloud to dark green hill, so a sprite needs to read
              // against both — one shadow alone disappears over half of it.
              textShadow:
                "0 0 3px rgba(255, 255, 255, 0.9), 0 0 6px rgba(255, 255, 255, 0.55), 0 1px 3px rgba(4, 18, 32, 0.5)",
              willChange: "transform",
            }}
          >
            {s.rows.map((row, i) => (
              <div key={i}>
                {row.map((run, j) => (
                  <span
                    key={j}
                    style={{
                      color: run.color >= 0 ? PALETTE[run.color] : "var(--ink)",
                    }}
                  >
                    {run.text}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
