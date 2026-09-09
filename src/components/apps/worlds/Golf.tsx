"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
import { vnoise } from "@/lib/scene"
import { SKY_RAMP, GRASS_RAMP } from "@/lib/bliss-palette"
import { Grid, fitCanvas, measure, ramp, type Metrics } from "./ascii"
import {
  createGame,
  swing,
  step,
  groundAt,
  lieAt,
  distanceToPin,
  nextHole,
  toPar,
  scoreName,
  facing,
  GRAVITY,
  HOLES,
  LIE_POWER,
  type Game,
  type Lie,
} from "./engine/golf"

type Phase = "power" | "angle" | "flying" | "holed" | "round-over"

const LIE_LABEL: Record<Lie, string> = {
  tee: "the tee",
  fairway: "the fairway",
  rough: "the rough",
  bunker: "a bunker",
  green: "the green",
}

/** Turf colour per lie. The glyph comes from the shared grass ramp. */
const TURF: Record<Lie, { rgb: [number, number, number] }> = {
  tee: { rgb: [126, 172, 96] },
  fairway: { rgb: [104, 160, 78] },
  rough: { rgb: [64, 104, 48] },
  bunker: { rgb: [216, 200, 152] },
  green: { rgb: [150, 206, 120] },
}

const SOIL: [number, number, number] = [26, 40, 24]

const rgb = (c: [number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`

const lift = (c: [number, number, number], t: number): [number, number, number] => [
  Math.round(c[0] + (255 - c[0]) * t),
  Math.round(c[1] + (255 - c[1]) * t),
  Math.round(c[2] + (255 - c[2]) * t),
]

const mix = (
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]

export default function Golf({ winId }: { winId: string; isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [game, setGame] = useState<Game>(() => createGame(1))
  const [phase, setPhase] = useState<Phase>("power")
  const meter = useRef({ power: 0, angle: 0.45, dir: 1 })
  const gameRef = useRef(game)
  gameRef.current = game
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  /** Recent ball positions, drawn as a fading tracer behind the shot. */
  const trail = useRef<{ x: number; y: number }[]>([])
  /** Metres per row, eased so the camera does not snap as the ball climbs. */
  const zoom = useRef(1)

  const restart = useCallback(() => {
    setGame(createGame(1))
    setPhase("power")
    meter.current = { power: 0, angle: 0.45, dir: 1 }
    trail.current = []
  }, [])

  const advance = useCallback(() => {
    const g = gameRef.current
    if (phase === "power") {
      meter.current.angle = 0.1
      meter.current.dir = 1
      setPhase("angle")
    } else if (phase === "angle") {
      // Angle meter maps 0..1 onto 10..80 degrees.
      trail.current = []
      setGame(swing(g, meter.current.power, 10 + meter.current.angle * 70))
      setPhase("flying")
    } else if (phase === "holed") {
      if (g.holeNumber >= HOLES) {
        setGame(nextHole(g))
        setPhase("round-over")
      } else {
        setGame(nextHole(g))
        setPhase("power")
        meter.current = { power: 0, angle: 0.45, dir: 1 }
        trail.current = []
      }
    } else if (phase === "round-over") {
      restart()
    }
  }, [phase, restart])

  useWindowKeys(winId, (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      advance()
    } else if (e.key === "r") {
      e.preventDefault()
      restart()
    }
  })

  // Meters and ball flight.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let acc = 0

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      if (phase === "power" || phase === "angle") {
        const key = phase === "power" ? "power" : "angle"
        meter.current[key] += meter.current.dir * dt * 1.05
        if (meter.current[key] > 1) {
          meter.current[key] = 1
          meter.current.dir = -1
        } else if (meter.current[key] < 0.02) {
          meter.current[key] = 0.02
          meter.current.dir = 1
        }
        return
      }

      if (phase === "flying") {
        // Fixed physics step, decoupled from the frame rate.
        acc += dt
        let g = gameRef.current
        while (acc >= 0.016) {
          g = step(g, 0.016)
          acc -= 0.016
        }
        trail.current.push({ x: g.ball.x, y: g.ball.y })
        if (trail.current.length > 44) trail.current.shift()
        setGame(g)
        if (g.holed) setPhase("holed")
        else if (!g.ball.moving) {
          setPhase("power")
          meter.current = { power: 0, angle: 0.45, dir: 1 }
        }
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // Render.
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !wrap || !ctx) return

    let raf = 0
    let t = 0
    let last = performance.now()
    let grid: Grid | null = null
    let m: Metrics | null = null
    let sized = { w: 0, h: 0 }

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (document.hidden) {
        last = now
        return
      }
      t += Math.min((now - last) / 1000, 0.05)
      last = now

      const g = gameRef.current
      const rect = wrap.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) return
      fitCanvas(canvas, ctx, rect)

      if (!grid || !m || sized.w !== rect.width || sized.h !== rect.height) {
        m = measure(ctx, rect.width, rect.height, rect.width < 520 ? 11 : 13)
        grid = new Grid(m.cols, m.rows)
        sized = { w: rect.width, h: rect.height }
      }
      grid.clear()

      const { cols, rows } = grid
      // Every cell gets a background below, but clear anyway: a gap would
      // otherwise hold the previous frame.
      ctx.fillStyle = "#0b1a22"
      ctx.fillRect(0, 0, rect.width, rect.height)

      /* Camera. Horizontal follows the ball; vertical zooms out to keep a high
         shot in frame, eased so the ground does not jump under the player. */
      const span = Math.max(90, g.hole.length * 0.55)
      /* Follow the ball, but frame both once the pin is close enough to share
         the shot — and keep following past the pin, since the ball can now be
         played back toward it. */
      const near = Math.abs(g.hole.pinX - g.ball.x) < span * 0.42
      const centre = Math.max(
        span / 2 - 12,
        near ? (g.ball.x + g.hole.pinX) / 2 : g.ball.x
      )
      const x0 = centre - span / 2
      const baseRow = Math.round(rows * 0.74)
      const wanted = Math.max(14, g.ball.y + 6) / Math.max(4, baseRow - 3)
      zoom.current += (wanted - zoom.current) * 0.06
      const mPerRow = zoom.current

      const toCol = (x: number) => ((x - x0) / span) * cols
      const toRow = (y: number) => baseRow - y / mPerRow
      const xAt = (c: number) => x0 + (c / cols) * span

      // Ground profile, one sample per column.
      const groundRow: number[] = new Array(cols)
      const lies: Lie[] = new Array(cols)
      for (let c = 0; c < cols; c++) {
        const x = xAt(c + 0.5)
        groundRow[c] = toRow(groundAt(g.hole, x))
        lies[c] = lieAt(g.hole, x)
      }

      /* Colour goes behind the cells and a glyph goes in every one of them,
         exactly as the wallpaper does it. A gradient and a filled ground path
         put smooth curves in the middle of a character scene, which read as a
         different picture pasted over the top. Every edge here is on the grid. */
      const skyFloor = Math.min(...groundRow)

      // Sky: graded by height, textured everywhere, with cloud banks drifting.
      for (let r = 0; r < rows; r++) {
        const k = Math.min(1, r / Math.max(1, skyFloor))
        const bg = `rgb(${(24 + k * 78) | 0}, ${(66 + k * 96) | 0}, ${(104 + k * 74) | 0})`
        for (let c = 0; c < cols; c++) {
          grid.back(c, r, bg)
          /* Thresholds set against this noise's real distribution, which runs
             0..0.5 with a median near 0.23 — not 0..1. Read as 0..1 it put
             cloud over a third of the sky and left no sky at all. */
          const n = vnoise(c * 0.06 - t * 0.3, r * 0.22)
          const cloud = Math.max(0, (n - 0.34) / 0.16)
          const texture = 0.18 + vnoise(c * 0.5, r * 0.9) * 0.5
          const ink = Math.min(1, texture * 0.5 + cloud * 0.95)
          const white = Math.min(1, cloud * 0.9)
          grid.put(
            c,
            r,
            ramp(SKY_RAMP, ink),
            `rgb(${(120 + white * 130 + k * 40) | 0}, ${(160 + white * 90 + k * 40) | 0}, ${
              (200 + white * 52 + k * 20) | 0
            })`
          )
        }
      }

      // Turf: dense grass to the surface, darkening into soil below it.
      for (let c = 0; c < cols; c++) {
        const turf = TURF[lies[c]]
        const top = Math.round(groundRow[c])
        for (let r = Math.max(0, top); r < rows; r++) {
          const depth = Math.min(1, (r - top) / 11)
          // A lit ridge along the surface, as on the wallpaper's hills.
          const crest = r === top ? 0.3 : 0
          const n = vnoise(c * 0.42, r * 0.55 + 30)
          const shade = mix(turf.rgb, SOIL, 0.3 + depth * 0.62 - crest)
          grid.back(c, r, rgb(shade))
          grid.put(
            c,
            r,
            ramp(GRASS_RAMP, 0.3 + n * 0.9 - depth * 0.25),
            rgb(lift(shade, 0.16 + crest * 0.7 + n * 0.3))
          )
        }
      }

      // The pin: stick, pennant and cup.
      const pinCol = Math.round(toCol(g.hole.pinX))
      const pinRow = Math.round(toRow(groundAt(g.hole, g.hole.pinX)))
      if (pinCol > -6 && pinCol < cols + 6) {
        grid.column(pinCol, pinRow - 6, pinRow - 1, "|", "#eef2ee")
        // The pennant lifts and falls with the wind.
        const flap = Math.sin(t * 3.1) * 0.5 + 0.5
        const dir = g.hole.wind >= 0 ? 1 : -1
        const tip = flap > 0.55 ? "\\" : "/"
        grid.text(pinCol + dir, pinRow - 6, dir > 0 ? "==" + tip : tip + "==", "#e0584a")
        grid.text(pinCol + dir, pinRow - 5, dir > 0 ? "=/" : "\\=", "#b8402f")
        grid.put(pinCol, pinRow, "U", "#14210f")
      } else {
        // The pin is out of shot; say which way it is and how far.
        const behind = facing(g) < 0
        const label = behind
          ? `<< ${Math.round(distanceToPin(g))}m`
          : `${Math.round(distanceToPin(g))}m >>`
        grid.text(behind ? 2 : cols - label.length - 2, 4, label, "rgba(255,240,180,0.75)")
      }

      // Tracer, oldest faintest.
      trail.current.forEach((p, i) => {
        const a = (i / trail.current.length) * 0.65
        if (a < 0.06) return
        const col = toCol(p.x)
        const row = toRow(p.y)
        grid!.back(col, row, `rgba(12, 22, 30, ${(a * 0.8).toFixed(2)})`)
        grid!.put(col, row, "o", `rgba(255,255,255,${(0.45 + a).toFixed(2)})`)
      })

      // Predicted arc while aiming: the same physics the swing will use.
      const ph = phaseRef.current
      if (ph === "power" || ph === "angle") {
        const angle = ((10 + meter.current.angle * 70) * Math.PI) / 180
        // The same speed the swing will produce, lie penalty and all, so the
        // guide is a promise rather than a decoration.
        const v = 46 * meter.current.power * LIE_POWER[lieAt(g.hole, g.ball.x)]
        const vx = Math.cos(angle) * v * facing(g)
        const vy = Math.sin(angle) * v
        for (let i = 1; i <= 30; i++) {
          const s = i * 0.055
          const px = g.ball.x + vx * s
          const py = g.ball.y + vy * s - 0.5 * GRAVITY * s * s
          if (py < groundAt(g.hole, px)) break
          const col = toCol(px)
          const row = toRow(py)
          grid.back(col, row, "rgba(10, 20, 28, 0.72)")
          grid.put(col, row, i % 2 === 0 ? "+" : "x", "#ffe07a")
        }
      }

      // Ball.
      grid.put(toCol(g.ball.x), toRow(g.ball.y) - (g.ball.moving ? 0 : 0.5), "o", "#ffffff")

      // Wind, blowing across the sky.
      const arrows = Math.abs(g.hole.wind) > 4 ? ">>>" : Math.abs(g.hole.wind) > 1.5 ? ">>" : ">"
      const drift = Math.floor(t * Math.abs(g.hole.wind) * 1.6)
      for (let i = 0; i < 3; i++) {
        const row = 2 + i * 2
        const raw = (i * 17 + drift) % (cols + 12)
        const col = g.hole.wind >= 0 ? raw - 6 : cols + 5 - raw
        grid.text(
          col,
          row,
          g.hole.wind >= 0 ? arrows : arrows.replace(/>/g, "<"),
          "rgba(210, 232, 240, 0.45)"
        )
      }

      grid.render(ctx, m)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const lie = lieAt(game.hole, game.ball.x)

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: "#0b1a22",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "8px 12px",
          borderBottom: "1px solid rgba(160,200,140,0.25)",
          fontSize: 12,
          color: "#cfe0c4",
          flexWrap: "wrap",
        }}
      >
        <span>hole {game.holeNumber} / {HOLES}</span>
        <span>par {game.hole.par}</span>
        <span>{Math.round(distanceToPin(game))} m to pin</span>
        <span>strokes {game.strokes}</span>
        <span style={{ marginLeft: "auto" }}>
          {game.completed.length > 0
            ? `${toPar(game) === 0 ? "E" : toPar(game) > 0 ? `+${toPar(game)}` : toPar(game)} thru ${game.completed.length}`
            : `on ${LIE_LABEL[lie]}`}
        </span>
      </div>

      <div ref={wrapRef} style={{ position: "relative", flex: "1 1 auto", minHeight: 180 }}>
        <canvas ref={canvasRef} aria-label="Golf hole" style={{ position: "absolute", inset: 0, display: "block" }} />
        {(phase === "holed" || phase === "round-over") && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(6, 22, 12, 0.6)",
            }}
          >
            <div style={{ textAlign: "center", color: "#e8f2e0" }}>
              <div style={{ fontSize: 26, letterSpacing: "0.06em" }}>
                {phase === "round-over"
                  ? "round complete"
                  : scoreName(game.strokes, game.hole.par)}
              </div>
              <div style={{ fontSize: 13, color: "#a8c49c", marginTop: 6 }}>
                {phase === "round-over"
                  ? `${game.completed.reduce((n, h) => n + h.strokes, 0)} strokes · ${
                      toPar(game) === 0 ? "even" : toPar(game) > 0 ? `+${toPar(game)}` : toPar(game)
                    }`
                  : `${game.strokes} stroke${game.strokes === 1 ? "" : "s"} · space to continue`}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(160,200,140,0.25)" }}>
        <Bar label="power" value={meter.current.power} active={phase === "power"} colour="#e0a94a" />
        <Bar label="loft" value={meter.current.angle} active={phase === "angle"} colour="#8fd0f5" />
      </div>

      <div
        style={{
          padding: "6px 12px",
          borderTop: "1px solid rgba(160,200,140,0.25)",
          fontSize: 12,
          color: "#8fa886",
          textAlign: "center",
        }}
      >
        {phase === "power"
          ? "space to set power"
          : phase === "angle"
            ? "space to set loft"
            : phase === "flying"
              ? "…"
              : phase === "holed"
                ? "space for the next tee"
                : "space to play again · r restarts"}
      </div>
    </div>
  )
}

function Bar({
  label,
  value,
  active,
  colour,
}: {
  label: string
  value: number
  active: boolean
  colour: string
}) {
  const pct = Math.max(0, Math.min(1, value))
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "3px 0",
        opacity: active ? 1 : 0.55,
      }}
    >
      <span style={{ width: 44, fontSize: 11, color: active ? "#e8f2e0" : "#8fa886" }}>
        {label}
      </span>
      <div
        style={{
          flex: "1 1 auto",
          height: 14,
          background: "rgba(0,0,0,0.45)",
          border: `1px solid ${active ? colour : "rgba(255,255,255,0.16)"}`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "0 auto 0 0",
            width: `${pct * 100}%`,
            background: colour,
            boxShadow: active ? `0 0 8px ${colour}` : undefined,
          }}
        />
      </div>
      <span
        style={{
          width: 34,
          fontSize: 11,
          textAlign: "right",
          color: active ? colour : "#8fa886",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Math.round(pct * 100)}
      </span>
    </div>
  )
}
