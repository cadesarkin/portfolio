"use client"

/**
 * The ASCII Bliss wallpaper.
 *
 * A hill, a sky and some clouds, redrawn thirty times a second out of
 * punctuation. The wind moves left to right.
 *
 * The noise functions, the character ramps and the run-length batching in
 * draw() are the reason this holds 30fps on a full-screen character grid.
 * They look repetitive on purpose — do not "clean them up".
 */

import { useEffect, useRef } from "react"
import { SKY_RAMP, GRASS_RAMP } from "@/lib/bliss-palette"
import { WALLPAPER, type RGB, type Theme } from "@/lib/theme"

interface Props {
  /** Halts the render loop — set when a maximized window covers the screen. */
  paused?: boolean
  theme?: Theme
}

/** Seconds for a full day/night crossfade. */
const FADE = 0.9

export default function BlissCanvas({ paused = false, theme = "day" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  /** 0 = day, 1 = night. Eased toward the target so the switch is a fade. */
  const nightRef = useRef(theme === "night" ? 1 : 0)
  const targetRef = useRef(theme === "night" ? 1 : 0)
  targetRef.current = theme === "night" ? 1 : 0
  /** Repaints the single static frame drawn under reduced motion. */
  const redrawStatic = useRef<((night: number) => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const CONFIG = {
      fontSize: 12,
      cloudSpeed: 1.0,
      windSpeed: 1.0,
      skyFloor: 0.34,
      skyRange: 0.3,
      /**
       * How dark the glyphs are relative to the scene colour behind them.
       *
       * Inverted from the original dark version. There, a near-black backdrop
       * carried bright glyphs. In daylight the backdrop is the full scene
       * colour and the glyphs are ink drawn on top of it, so density reads as
       * shading rather than as holes.
       */
      inkMix: 0.58,
      fps: 30,
    }

    let W = 0
    let H = 0
    let AR = 1
    let cols = 0
    let rows = 0
    let cw = 8
    let chh = 12
    let T = 0

    let rowFg: Int32Array = new Int32Array(0)
    let rowBg: Int32Array = new Int32Array(0)
    let rowCh: string[] = []

    function hash(x: number, y: number) {
      let h = (x | 0) * 374761393 + (y | 0) * 668265263
      h = (h ^ (h >> 13)) * 1274126177
      h = h ^ (h >> 16)
      return (h >>> 0) / 4294967295
    }

    function vnoise(x: number, y: number) {
      const xi = Math.floor(x)
      const yi = Math.floor(y)
      const xf = x - xi
      const yf = y - yi
      const u = xf * xf * (3 - 2 * xf)
      const v = yf * yf * (3 - 2 * yf)
      const a = hash(xi, yi)
      const b = hash(xi + 1, yi)
      const c = hash(xi, yi + 1)
      const d = hash(xi + 1, yi + 1)
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
    }

    function fbm(x: number, y: number, oct: number) {
      let s = 0
      let amp = 0.5
      let f = 1
      let norm = 0
      for (let i = 0; i < oct; i++) {
        s += amp * vnoise(x * f, y * f)
        norm += amp
        f *= 2
        amp *= 0.5
      }
      return s / norm
    }

    function ss(a: number, b: number, t: number) {
      let n = (t - a) / (b - a)
      if (n < 0) n = 0
      else if (n > 1) n = 1
      return n * n * (3 - 2 * n)
    }

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t
    }

    /**
     * The silhouette. A broad gaussian bump left of centre, plus low ripples.
     *
     * Sits low on purpose: Bliss is mostly sky, with the crest around 55% and
     * the horizon falling away to ~72% at the right edge.
     */
    function hillY(x: number) {
      const d = (x - 0.3) / 0.32
      return (
        0.74 -
        0.19 * Math.exp(-0.5 * d * d) +
        0.016 * Math.sin(x * 7.3 + 1.2) +
        0.01 * Math.sin(x * 3.1 - 0.6)
      )
    }

    const DAY = WALLPAPER.day
    const NIGHT = WALLPAPER.night

    // Recomputed whenever the fade advances, not per cell.
    let sky0: RGB = DAY.skyTop
    let sky1: RGB = DAY.skyHorizon
    let hill0: RGB = DAY.hillDark
    let hill1: RGB = DAY.hillLight
    let cloudRGB: RGB = DAY.cloud
    let inkMix = DAY.ink
    /** 0 = glyph density follows darkness (day), 1 = follows light (night). */
    let nightMix = 0

    const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
      lerp(a[0], b[0], t),
      lerp(a[1], b[1], t),
      lerp(a[2], b[2], t),
    ]

    function applyTheme(t: number) {
      nightMix = t
      sky0 = mixRGB(DAY.skyTop, NIGHT.skyTop, t)
      sky1 = mixRGB(DAY.skyHorizon, NIGHT.skyHorizon, t)
      hill0 = mixRGB(DAY.hillDark, NIGHT.hillDark, t)
      hill1 = mixRGB(DAY.hillLight, NIGHT.hillLight, t)
      cloudRGB = mixRGB(DAY.cloud, NIGHT.cloud, t)
      inkMix = lerp(DAY.ink, NIGHT.ink, t)
      colorCache.clear()
    }

    // Written by shade(), read by draw(). Avoids allocating per cell.
    let oR = 0
    let oG = 0
    let oB = 0
    let oCh = " "

    function shade(x: number, y: number) {
      const hy = hillY(x)
      const nx = x * AR

      if (y < hy) {
        const sy = y / hy
        let r = lerp(sky0[0], sky1[0], Math.pow(sy, 1.25))
        let g = lerp(sky0[1], sky1[1], Math.pow(sy, 1.1))
        let b = lerp(sky0[2], sky1[2], Math.pow(sy, 0.85))

        let bright = CONFIG.skyFloor + CONFIG.skyRange * Math.pow(sy, 1.1)

        // Clouds sit in the middle and lower sky, leaving the zenith clear.
        const band = ss(0.16, 0.42, sy) * (1 - ss(0.82, 1.0, sy))
        if (band > 0.001) {
          const c1 = fbm(
            nx * 1.6 - T * 0.02 * CONFIG.cloudSpeed,
            y * 2.6 + 1.7,
            4
          )
          const c2 = fbm(
            nx * 3.4 + T * 0.05 * CONFIG.cloudSpeed + 9.3,
            y * 5.2,
            3
          )

          // Thresholds are percentiles of the actual fbm output, measured
          // rather than assumed. This normalised fbm has a mean near 0.27 and
          // never exceeds ~0.45 — not the 0.5 mean the original assumed — so
          // thresholds set either side of 0.5 silently produce no cloud at all.
          // Only the top of each distribution becomes cloud — roughly c1's
          // 80th percentile up, and c2's 88th — which leaves most of the sky
          // as open blue instead of a solid white ceiling.
          let d = ss(0.338, 0.435, c1) * band + 0.4 * ss(0.318, 0.38, c2) * band
          if (d > 1) d = 1

          if (d > 0.01) {
            const w = ss(0.0, 0.62, d)
            r = lerp(r, cloudRGB[0], w)
            g = lerp(g, cloudRGB[1], w)
            b = lerp(b, cloudRGB[2], w)
            // By day a cloud is the brightest thing in frame and can max the
            // ramp. At night that same maximum reads as a solid slab, so the
            // cloud's contribution is capped well short of it.
            const cb = lerp(0.45 + 0.55 * d, 0.26 + 0.3 * d, nightMix)
            if (cb > bright) bright = cb
          }
        }
        oR = r
        oG = g
        oB = b
        // By day the densest glyphs sit where the sky is darkest — ink on
        // paper, with sunlit cloud tops nearly blank. At night that inverts:
        // glyphs are light on a dark field, so density follows brightness.
        // Interpolating the two keeps the crossfade continuous.
        const ink = lerp(1 - bright, bright, nightMix)
        oCh = SKY_RAMP.charAt(Math.round(ink * (SKY_RAMP.length - 1)))
      } else {
        const dy = y - hy
        const depth = ss(0, 0.42, dy)

        // Lower vertical frequency than the original: at y*16 the ripple read
        // as horizontal corduroy once the glyphs became dark ink.
        const rip = fbm(
          nx * 8.5 + T * 0.22 * CONFIG.windSpeed,
          y * 9.0 - T * 0.06,
          2
        )
        const patch = fbm(nx * 2.4 + 3.1, y * 4.0, 3)

        let lum = 0.58 + 0.22 * (rip - 0.5) + 0.34 * (patch - 0.5)
        lum *= lerp(1.12, 0.66, depth)
        // Rim light along the crest.
        lum += 0.3 * Math.exp(-Math.pow(dy / 0.03, 2))
        if (lum < 0) lum = 0
        else if (lum > 1) lum = 1

        oR = lerp(hill0[0], hill1[0], lum)
        oG = lerp(hill0[1], hill1[1], lum)
        oB = lerp(hill0[2], hill1[2], lum)
        // Same flip as the sky.
        const gd = lerp(1 - lum, lum, nightMix)
        oCh = GRASS_RAMP.charAt(
          Math.round((0.28 + 0.66 * gd) * (GRASS_RAMP.length - 1))
        )
      }
    }

    const colorCache = new Map<number, string>()
    function colorFor(key: number) {
      let s = colorCache.get(key)
      if (s === undefined) {
        s = `rgb(${(key >> 16) & 255},${(key >> 8) & 255},${key & 255})`
        colorCache.set(key, s)
      }
      return s
    }

    function draw() {
      const ink = inkMix

      for (let row = 0; row < rows; row++) {
        const y = (row + 0.5) / rows
        const py = row * chh
        let col: number

        for (col = 0; col < cols; col++) {
          shade((col + 0.5) / cols, y)
          rowCh[col] = oCh
          // Glyphs are a darkened version of the colour behind them, so the
          // texture shades the scene instead of fighting it.
          // Clamped: the night multiplier brightens past 255 on pale cells.
          rowFg[col] =
            oCh === " "
              ? -1
              : ((Math.min(255, oR * ink) & 0xf0) << 16) |
                ((Math.min(255, oG * ink) & 0xf0) << 8) |
                (Math.min(255, oB * ink) & 0xf0)
          rowBg[col] =
            ((oR & 0xf8) << 16) | ((oG & 0xf8) << 8) | (oB & 0xf8)
        }

        // Backdrop first, as run-length spans: blank cells then read as sky
        // and soil rather than as holes.
        let k = rowBg[0]
        let start = 0
        for (col = 1; col <= cols; col++) {
          if (col === cols || rowBg[col] !== k) {
            ctx!.fillStyle = colorFor(k)
            ctx!.fillRect(start * cw, py, (col - start) * cw + 1, chh + 1)
            if (col < cols) {
              k = rowBg[col]
              start = col
            }
          }
        }

        // Then the glyphs, batched into same-colour runs.
        let fk = rowFg[0]
        let fs = rowCh[0]
        let fstart = 0
        for (col = 1; col <= cols; col++) {
          const nk = col < cols ? rowFg[col] : -2
          if (nk !== fk) {
            if (fk >= 0 && fs) {
              ctx!.fillStyle = colorFor(fk)
              ctx!.fillText(fs, fstart * cw, py)
            }
            if (col < cols) {
              fk = nk
              fs = rowCh[col]
              fstart = col
            }
          } else {
            fs += rowCh[col]
          }
        }
      }
    }

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      AR = W / H
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      let fs = CONFIG.fontSize
      if (W < 600) fs = 9
      else if (W < 1000) fs = 11

      // Fewer frames on small screens: the grid is cheaper but the battery
      // budget is tighter.
      CONFIG.fps = W < 768 ? 20 : 30

      canvas!.width = Math.floor(W * dpr)
      canvas!.height = Math.floor(H * dpr)
      canvas!.style.width = W + "px"
      canvas!.style.height = H + "px"

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.font = `${fs}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
      ctx!.textBaseline = "top"

      cw = ctx!.measureText("M").width || fs * 0.6
      chh = Math.max(1, Math.round(fs * 1.06))
      cols = Math.ceil(W / cw) + 1
      rows = Math.ceil(H / chh) + 1

      rowFg = new Int32Array(cols)
      rowBg = new Int32Array(cols)
      rowCh = new Array(cols)
    }

    let last = 0
    let raf = 0

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      const dt = Math.min((now - last) / 1000, 0.1)

      // The crossfade runs even while the wallpaper is otherwise paused —
      // switching theme behind a maximized window would leave it stale
      // otherwise, and it would snap when the window closed.
      const fading = Math.abs(nightRef.current - targetRef.current) > 0.001
      if (fading) {
        const dir = Math.sign(targetRef.current - nightRef.current)
        nightRef.current = Math.max(
          0,
          Math.min(1, nightRef.current + dir * (dt / FADE))
        )
        applyTheme(nightRef.current)
      }

      if (pausedRef.current || document.hidden) {
        last = now
        if (fading) draw()
        return
      }

      const interval = 1000 / CONFIG.fps
      if (!fading && now - last < interval) return
      T += dt
      last = now
      draw()
    }

    let resizeTimer: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        resize()
        draw()
      }, 120)
    }
    window.addEventListener("resize", onResize)

    applyTheme(nightRef.current)
    redrawStatic.current = (night: number) => {
      nightRef.current = night
      applyTheme(night)
      draw()
    }
    resize()
    if (reduced) {
      // One representative frame, mid-drift, and no loop at all.
      T = 12
      draw()
    } else {
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      window.removeEventListener("resize", onResize)
      redrawStatic.current = null
    }
  }, [])

  // Under reduced motion there is no loop to advance the crossfade, so repaint
  // the single static frame whenever the theme changes.
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    redrawStatic.current?.(theme === "night" ? 1 : 0)
  }, [theme])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        display: "block",
        background: "var(--base)",
      }}
    />
  )
}
