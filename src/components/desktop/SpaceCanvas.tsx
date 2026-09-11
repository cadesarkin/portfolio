"use client"

/**
 * The wallpaper after the ship has launched: space, out of punctuation.
 *
 * The same character-grid idea as the plains, drawn in layers so it stays
 * cheap: a backdrop of nebula painted once per resize, stars drifting past at
 * three depths, planets redrawn a few times a second as they turn, and the
 * occasional visitor crossing the screen.
 */

import { useEffect, useRef } from "react"
import {
  KINDS,
  MAX_VISITORS,
  PLANETS,
  STAR_GLYPHS,
  behind,
  makeStars,
  planetAt,
  ringAt,
  spawnVisitor,
  stepStars,
  stepVisitors,
  surfaceAt,
  type Planet,
  type RGB,
  type Star,
  type Visitor,
} from "@/lib/space"
import { vnoise } from "@/lib/scene"
import { DEFAULT_SETTINGS, type WallpaperSettings } from "./wallpaper-settings"

interface Props {
  /** Halts the render loop — set when a maximized window covers the screen. */
  paused?: boolean
  /** Faded in and out rather than cut, for the moment the ship arrives. */
  visible: boolean
  settings?: WallpaperSettings
}

/** Seconds between redraws of a turning planet. Nobody can see it turn faster. */
const PLANET_EVERY = 0.35

const rgb = (c: RGB, a = 1) =>
  a >= 1
    ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`

export default function SpaceCanvas({ paused = false, visible, settings = DEFAULT_SETTINGS }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d", { alpha: false })
    if (!canvas || !ctx) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let W = 0
    let H = 0
    let dpr = 1
    let cw = 7
    let chh = 12
    let cols = 0
    let rows = 0
    let font = ""
    let stars: Star[] = []
    let visitors: Visitor[] = []
    let nextVisitor = 2
    let T = 0
    let planetT = -1
    const backdrop = document.createElement("canvas")
    const planetCanvas = new Map<string, { c: HTMLCanvasElement; x: number; y: number }>()

    function setFont(c: CanvasRenderingContext2D) {
      c.font = font
      c.textBaseline = "top"
    }

    /** Gradient and nebula, painted once: they do not move. */
    function paintBackdrop() {
      backdrop.width = Math.floor(W * dpr)
      backdrop.height = Math.floor(H * dpr)
      const b = backdrop.getContext("2d")!
      b.setTransform(dpr, 0, 0, dpr, 0, 0)
      const g = b.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, "#03040b")
      g.addColorStop(1, "#0b0f26")
      b.fillStyle = g
      b.fillRect(0, 0, W, H)
      setFont(b)
      const RAMP = " .,:;~"
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col / cols
          const y = row / rows
          // A diagonal smear of cloud across the middle of the sky, broken up.
          const band = Math.exp(-Math.pow((y - 0.35 - x * 0.3) / 0.22, 2))
          const n = vnoise(x * 6, y * 9) * 2 * 0.65 + vnoise(x * 17, y * 23) * 2 * 0.35
          const d = band * Math.max(0, n - 0.35) * 2.2
          if (d < 0.08) continue
          const hue = vnoise(x * 3 + 7, y * 3) * 2
          const c: RGB = [
            90 + 60 * (1 - hue),
            40 + 70 * hue,
            120 + 40 * hue,
          ]
          b.fillStyle = rgb(c, Math.min(0.55, d * 0.5))
          b.fillText(RAMP.charAt(Math.min(RAMP.length - 1, Math.floor(d * RAMP.length))), col * cw, row * chh)
        }
      }
    }

    /** One planet into its own small canvas, rings and all. */
    function paintPlanet(p: Planet) {
      const aspect = W / H
      const at = planetAt(p, T, aspect)
      const R = p.r * H
      const reach = p.rings ? R * p.rings.outer : R
      const c0 = Math.floor((at.x * W - reach) / cw) - 1
      const c1 = Math.ceil((at.x * W + reach) / cw) + 1
      const r0 = Math.floor((at.y * H - reach) / chh) - 1
      const r1 = Math.ceil((at.y * H + reach) / chh) + 1
      const entry = planetCanvas.get(p.id) ?? { c: document.createElement("canvas"), x: 0, y: 0 }
      const c = entry.c
      c.width = Math.max(1, Math.floor((c1 - c0) * cw * dpr))
      c.height = Math.max(1, Math.floor((r1 - r0) * chh * dpr))
      const pc = c.getContext("2d")!
      pc.setTransform(dpr, 0, 0, dpr, 0, 0)
      setFont(pc)
      for (let row = r0; row < r1; row++) {
        for (let col = c0; col < c1; col++) {
          const u = ((col + 0.5) * cw - at.x * W) / R
          const v = ((row + 0.5) * chh - at.y * H) / R
          const ring = ringAt(p, u, v)
          const surf = surfaceAt(p, u, v, T)
          const px = (col - c0) * cw
          const py = (row - r0) * chh
          if (surf && !(ring && ring.front)) {
            pc.fillStyle = rgb(surf.bg)
            pc.fillRect(px, py, cw + 0.5, chh + 0.5)
            pc.fillStyle = rgb(surf.fg)
            pc.fillText(surf.ch, px, py)
          } else if (ring) {
            pc.fillStyle = rgb(ring.fg, 0.85)
            pc.fillText(ring.ch, px, py)
          }
        }
      }
      entry.x = c0 * cw
      entry.y = r0 * chh
      planetCanvas.set(p.id, entry)
    }

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      let fs = settingsRef.current.fontSize
      if (W < 600) fs = Math.min(fs, 9)
      else if (W < 1000) fs = Math.min(fs, 11)
      font = `${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
      canvas!.width = Math.floor(W * dpr)
      canvas!.height = Math.floor(H * dpr)
      canvas!.style.width = `${W}px`
      canvas!.style.height = `${H}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      setFont(ctx!)
      cw = ctx!.measureText("M").width || fs * 0.6
      chh = Math.max(1, Math.round(fs * 1.06))
      cols = Math.ceil(W / cw) + 1
      rows = Math.ceil(H / chh) + 1
      stars = makeStars(cols, rows)
      paintBackdrop()
      planetT = -1
    }

    function draw() {
      ctx!.drawImage(backdrop, 0, 0, W, H)

      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(T * (1.2 + s.layer) + s.phase)
        const a = [0.35, 0.6, 0.9][s.layer] * tw
        ctx!.fillStyle = s.layer === 2 ? `rgba(255,244,214,${a.toFixed(3)})` : `rgba(190,215,255,${a.toFixed(3)})`
        ctx!.fillText(STAR_GLYPHS[s.layer], s.x * cw, s.y * chh)
      }

      if (T - planetT >= PLANET_EVERY || planetT < 0) {
        for (const p of PLANETS) paintPlanet(p)
        planetT = T
      }
      // A moon on the far side goes behind its planet.
      const order = [...PLANETS].sort((a, b) => Number(!behind(a, T)) - Number(!behind(b, T)))
      for (const p of order) {
        const e = planetCanvas.get(p.id)
        if (e) ctx!.drawImage(e.c, e.x, e.y, e.c.width / dpr, e.c.height / dpr)
      }

      for (const v of visitors) {
        const kind = KINDS.find((k) => k.id === v.kind)!
        const y = (v.y + Math.sin(T * 1.3 + v.phase) * kind.bob) * chh
        const on = Math.sin(T * 6 + v.phase) > 0
        v.art.forEach((line, i) => {
          ctx!.fillStyle = kind.color
          ctx!.fillText(line, v.x * cw, y + i * chh)
          if (kind.lights && on) {
            ctx!.fillStyle = "#ffe27a"
            ;[...line].forEach((ch, j) => {
              if (kind.lights!.includes(ch)) ctx!.fillText(ch, (v.x + j) * cw, y + i * chh)
            })
          }
        })
      }
    }

    let raf = 0
    let last = 0
    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      if (pausedRef.current || document.hidden) {
        last = now
        return
      }
      const interval = 1000 / Math.min(settingsRef.current.fps, 30)
      if (now - last < interval) return
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0
      last = now
      T += dt
      stars = stepStars(stars, dt, cols)
      visitors = stepVisitors(visitors, dt, cols)
      nextVisitor -= dt
      if (nextVisitor <= 0) {
        if (visitors.length < MAX_VISITORS) visitors = [...visitors, spawnVisitor(cols, rows)]
        nextVisitor = 3 + Math.random() * 5
      }
      draw()
    }

    let timer: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        resize()
        draw()
      }, 120)
    }
    window.addEventListener("resize", onResize)
    resize()
    if (reduced) {
      // One still frame, with a ship caught halfway across.
      T = 40
      visitors = [{ ...spawnVisitor(cols, rows, () => 0.3), x: cols * 0.4 }]
      draw()
    } else {
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      window.removeEventListener("resize", onResize)
    }
  }, [settings.fontSize])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        display: "block",
        background: "#03040b",
        opacity: visible ? 1 : 0,
        transition: "opacity 2.4s ease-in-out",
      }}
    />
  )
}
