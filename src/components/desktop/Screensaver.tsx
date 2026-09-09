"use client"

import { useEffect, useRef, useState } from "react"
import { IDENTITY } from "@/lib/resume"

const IDLE_MS = 60_000
/** Grace after the saver appears, so the event that armed it cannot dismiss it. */
const ARM_MS = 250

/**
 * ASCII starfield with the name drifting across it, after a minute idle.
 *
 * Rendered on a canvas rather than as characters in the DOM: at this star
 * count a re-render per frame would cost far more than a fill.
 */
function Stars({ onWake }: { onWake: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    let W = 0
    let H = 0
    let dpr = 1
    const resize = () => {
      W = window.innerWidth
      H = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(W * dpr)
      canvas.height = Math.floor(H * dpr)
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
      ctx.textBaseline = "middle"
    }
    resize()
    window.addEventListener("resize", resize)

    const GLYPHS = ".．·:+*"
    const stars = Array.from({ length: 220 }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random() * 1 + 0.05,
    }))

    // The name drifts and bounces, DVD-logo style.
    const label = IDENTITY.name.toLowerCase()
    let lx = W * 0.3
    let ly = H * 0.45
    let lvx = 44
    let lvy = 31

    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      ctx.fillStyle = "#04080f"
      ctx.fillRect(0, 0, W, H)

      for (const s of stars) {
        s.z -= dt * 0.28
        if (s.z <= 0.04) {
          s.x = (Math.random() - 0.5) * 2
          s.y = (Math.random() - 0.5) * 2
          s.z = 1.05
        }
        const sx = W / 2 + (s.x / s.z) * (W / 2)
        const sy = H / 2 + (s.y / s.z) * (H / 2)
        if (sx < 0 || sy < 0 || sx > W || sy > H) continue
        const near = 1 - s.z
        const g = GLYPHS[Math.min(GLYPHS.length - 1, Math.floor(near * GLYPHS.length))]
        ctx.fillStyle = `rgba(150,200,240,${(0.15 + near * 0.85).toFixed(3)})`
        ctx.fillText(g, sx, sy)
      }

      const tw = ctx.measureText(label).width
      lx += lvx * dt
      ly += lvy * dt
      if (lx < 0) { lx = 0; lvx = Math.abs(lvx) }
      if (lx + tw > W) { lx = W - tw; lvx = -Math.abs(lvx) }
      if (ly < 12) { ly = 12; lvy = Math.abs(lvy) }
      if (ly > H - 12) { ly = H - 12; lvy = -Math.abs(lvy) }

      ctx.fillStyle = "#7dd88f"
      ctx.fillText(label, lx, ly)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [])

  useEffect(() => {
    const armedAt = performance.now() + ARM_MS
    const wake = () => {
      if (performance.now() < armedAt) return
      onWake()
    }
    window.addEventListener("keydown", wake)
    window.addEventListener("pointerdown", wake)
    window.addEventListener("pointermove", wake)
    return () => {
      window.removeEventListener("keydown", wake)
      window.removeEventListener("pointerdown", wake)
      window.removeEventListener("pointermove", wake)
    }
  }, [onWake])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: 900, display: "block" }}
    />
  )
}

export default function Screensaver({ enabled }: { enabled: boolean }) {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    if (!enabled) return
    // Never start a screensaver for someone who asked for less motion.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let timer: ReturnType<typeof setTimeout>
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), IDLE_MS)
    }

    const events = ["keydown", "pointerdown", "pointermove", "wheel"] as const
    for (const e of events) window.addEventListener(e, arm, { passive: true })
    arm()

    return () => {
      clearTimeout(timer)
      for (const e of events) window.removeEventListener(e, arm)
    }
  }, [enabled])

  if (!idle) return null
  return <Stars onWake={() => setIdle(false)} />
}
