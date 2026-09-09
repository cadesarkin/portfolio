"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
import { vnoise } from "@/lib/scene"
import { Grid, fitCanvas, measure, ramp, type Metrics } from "./ascii"
import {
  createGame,
  roll,
  resolveRoll,
  scorecard,
  total,
  isStrike,
  isSpare,
  PIN_LAYOUT,
  PIN_COUNT,
  FRAMES,
  type Game,
} from "./engine/bowling"

type Phase = "aim" | "power" | "rolling" | "settled"

/** Lane geometry, in the same -1..1 lane units the engine uses. */
const LANE_HALF = 0.62

/**
 * How far up the lane the rack is drawn.
 *
 * Not 0: at the vanishing point ten pins collapse into a couple of characters.
 * Standing the rack a little way down the lane keeps it legible as a triangle.
 */
const RACK_Z = 0.3

export default function Bowling({ winId }: { winId: string; isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [game, setGame] = useState<Game>(createGame)
  const [phase, setPhase] = useState<Phase>("aim")
  const [message, setMessage] = useState<string | null>(null)

  /** Oscillating meters and the live ball, kept out of state to avoid churn. */
  const meter = useRef({ aim: 0, power: 0, dir: 1 })
  const ball = useRef({ x: 0, z: 1, rolling: false })
  const lockedAim = useRef(0)
  const gameRef = useRef(game)
  gameRef.current = game
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const restart = useCallback(() => {
    setGame(createGame())
    setPhase("aim")
    setMessage(null)
    ball.current = { x: 0, z: 1, rolling: false }
  }, [])

  const throwBall = useCallback((aim: number, power: number) => {
    setPhase("rolling")
    // Power bends the path: a hard ball runs straighter, a soft one drifts.
    const drift = (1 - power) * 0.22 * (aim >= 0 ? 1 : -1)
    ball.current = { x: aim, z: 1, rolling: true }
    lockedAim.current = aim + drift
  }, [])

  const advance = useCallback(() => {
    if (phase === "aim") {
      lockedAim.current = meter.current.aim
      meter.current.power = 0
      meter.current.dir = 1
      setPhase("power")
      return
    }
    if (phase === "power") {
      throwBall(lockedAim.current, meter.current.power)
      return
    }
    if (phase === "settled") {
      if (gameRef.current.over) restart()
      else {
        setPhase("aim")
        setMessage(null)
      }
    }
  }, [phase, throwBall, restart])

  useWindowKeys(winId, (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      advance()
    } else if (e.key === "r") {
      e.preventDefault()
      restart()
    }
  })

  // Meters and ball travel.
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      if (phase === "aim") {
        meter.current.aim += meter.current.dir * dt * 0.9
        if (meter.current.aim > LANE_HALF) {
          meter.current.aim = LANE_HALF
          meter.current.dir = -1
        } else if (meter.current.aim < -LANE_HALF) {
          meter.current.aim = -LANE_HALF
          meter.current.dir = 1
        }
      } else if (phase === "power") {
        meter.current.power += meter.current.dir * dt * 1.15
        if (meter.current.power > 1) {
          meter.current.power = 1
          meter.current.dir = -1
        } else if (meter.current.power < 0.05) {
          meter.current.power = 0.05
          meter.current.dir = 1
        }
      } else if (phase === "rolling" && ball.current.rolling) {
        // z runs 1 (foul line) to 0 (the rack).
        ball.current.z -= dt * 0.75
        // The ball tracks toward its final line as it travels.
        ball.current.x += (lockedAim.current - ball.current.x) * dt * 1.6
        if (ball.current.z <= 0) {
          ball.current.rolling = false
          const felled = resolveRoll(gameRef.current.standing, ball.current.x)
          const knocked = felled.filter(Boolean).length
          const next = roll(gameRef.current, felled)
          const frame = next.frames[Math.min(gameRef.current.current, FRAMES - 1)]
          setGame(next)
          setMessage(
            isStrike(frame) && frame.rolls.length === 1
              ? "STRIKE"
              : isSpare(frame)
                ? "SPARE"
                : knocked === 0
                  ? "gutter"
                  : `${knocked} down`
          )
          setPhase("settled")
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
      const g = gameRef.current
      const phaseNow = phaseRef.current

      ctx.fillStyle = "#0d0906"
      ctx.fillRect(0, 0, rect.width, rect.height)

      /* Perspective. z is 1 at the foul line and 0 at the pit; the rack sits at
         RACK_Z rather than at the vanishing point, because a rack drawn at the
         vanishing point collapses to two characters and stops being ten pins. */
      const deck = Math.round(rows * 0.1)
      const foul = rows - 1
      const rowFor = (z: number) => deck + (foul - deck) * z
      const scaleFor = (z: number) => 1 - (1 - z) * 0.78
      const mid = cols / 2
      const colFor = (x: number, z: number) => mid + x * cols * 0.42 * scaleFor(z)
      const halfFor = (z: number) => Math.abs(colFor(LANE_HALF, z) - mid)

      /* A wash under the boards, in the same spirit as the wallpaper filling a
         colour behind each cell: the glyphs alone are too sparse to read as a
         lit, polished lane. */
      const px = (c: number) => c * m!.cw
      const py = (r: number) => r * m!.ch
      ctx.beginPath()
      ctx.moveTo(px(colFor(-LANE_HALF, 0)), py(deck))
      ctx.lineTo(px(colFor(LANE_HALF, 0)), py(deck))
      ctx.lineTo(px(colFor(LANE_HALF, 1)), py(foul + 1))
      ctx.lineTo(px(colFor(-LANE_HALF, 1)), py(foul + 1))
      ctx.closePath()
      const boards = ctx.createLinearGradient(0, py(deck), 0, py(foul + 1))
      boards.addColorStop(0, "#241708")
      boards.addColorStop(1, "#5c3d1c")
      ctx.fillStyle = boards
      ctx.fill()

      // The pin deck sits in shadow, so cream pins read against the boards.
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)"
      ctx.fillRect(0, py(deck), rect.width, py(rowFor(RACK_Z) + 2) - py(deck))

      // The back wall behind the pit.
      for (let r = 0; r < deck; r++) {
        for (let c = 0; c < cols; c++) {
          const n = vnoise(c * 0.22, r * 0.6 + 3)
          if (n > 0.34) grid.put(c, r, ramp(".:-", (n - 0.34) * 4), "rgba(96,70,48,0.5)")
        }
      }

      // Lane and gutters.
      for (let r = deck; r <= foul; r++) {
        const z = (r - deck) / Math.max(1, foul - deck)
        const half = Math.max(1, halfFor(z))
        for (let c = Math.floor(mid - half * 1.2); c <= Math.ceil(mid + half * 1.2); c++) {
          const u = (c - mid) / half
          if (Math.abs(u) > 1.16) continue
          if (Math.abs(u) > 1.0) {
            grid.put(c, r, "~", "rgba(78,58,40,0.9)")
            continue
          }
          const grain = vnoise(u * 26, r * 0.9)
          // A highlight running down the lane, as light off a polished board.
          const sheen = Math.exp(-Math.pow((u + 0.12) / 0.55, 2)) * 0.4
          const lum = Math.max(0, Math.min(1, 0.2 + grain * 0.3 + sheen + z * 0.2))
          grid.put(
            c,
            r,
            ramp(".::--=+", lum),
            `rgb(${(120 + lum * 110) | 0}, ${(84 + lum * 92) | 0}, ${(44 + lum * 70) | 0})`
          )
        }
      }

      // Every fifth board, drawn the length of the lane.
      for (let i = -2; i <= 2; i++) {
        const x = (i / 2) * LANE_HALF * 0.92
        for (let r = deck; r <= foul; r++) {
          const z = (r - deck) / Math.max(1, foul - deck)
          grid.put(colFor(x, z), r, "|", "rgba(248,214,158,0.45)")
        }
      }

      // The seven aiming arrows.
      for (let i = -3; i <= 3; i++) {
        const z = 0.62
        grid.put(colFor((i / 3) * LANE_HALF * 0.72, z), rowFor(z), "^", "rgba(120,84,46,0.95)")
      }

      // Foul line.
      const foulHalf = halfFor(1)
      grid.line(mid - foulHalf, foul, mid + foulHalf, foul, "=", "rgba(230,196,140,0.55)")

      // Aiming line, running from the foul line to the head pin.
      if (phaseNow === "aim" || phaseNow === "power") {
        const x = phaseNow === "aim" ? meter.current.aim : lockedAim.current
        const colour = phaseNow === "aim" ? "rgba(255,209,102,0.85)" : "rgba(255,209,102,0.4)"
        // The dashes march up the lane, so the guide reads as live.
        const phase = Math.floor(t * 7) % 2
        for (let r = Math.round(rowFor(RACK_Z)) + phase; r <= foul; r += 2) {
          const z = (r - deck) / Math.max(1, foul - deck)
          grid.put(colFor(x, z), r, ":", colour)
        }
      }

      /* Pins. The head pin is nearest the bowler and the back row furthest, so
         z falls as the rack deepens. */
      for (let i = 0; i < PIN_COUNT; i++) {
        if (!g.standing[i]) continue
        const pin = PIN_LAYOUT[i]
        const z = RACK_Z - pin.y * 0.3
        const c = Math.round(colFor(pin.x, z))
        const r = Math.round(rowFor(z))
        grid.put(c, r - 1, "o", "#f7eede")
        grid.put(c, r, "A", "#ded0b4")
        // Reflected in the boards.
        grid.put(c, r + 1, "'", "rgba(247,238,222,0.16)")
      }

      // Ball, drawn larger the closer it is.
      if (ball.current.rolling || phaseNow === "settled") {
        const bz = RACK_Z + Math.max(0, ball.current.z) * (1 - RACK_Z)
        const c = Math.round(colFor(ball.current.x, bz))
        const r = Math.round(rowFor(bz))
        if (bz > 0.72) grid.sprite(c - 2, r - 1, [" __ ", "(::)"], "#5b93e0")
        else if (bz > 0.48) grid.text(c - 1, r, "(:)", "#4d86d6")
        else grid.put(c, r, "0", "#4d86d6")
      }

      grid.render(ctx, m)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const card = scorecard(game)

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: "#0d0906",
      }}
    >
      <div ref={wrapRef} style={{ position: "relative", flex: "1 1 auto", minHeight: 180 }}>
        <canvas ref={canvasRef} aria-label="Bowling lane" style={{ position: "absolute", inset: 0, display: "block" }} />
        {message && (
          <div
            style={{
              position: "absolute",
              top: "38%",
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: message === "STRIKE" || message === "SPARE" ? 30 : 17,
              letterSpacing: "0.2em",
              color: message === "STRIKE" ? "#ffd166" : message === "SPARE" ? "#8fe0a0" : "#c9bfae",
              textShadow: "0 2px 10px rgba(0,0,0,0.9)",
              pointerEvents: "none",
            }}
          >
            {message}
          </div>
        )}
      </div>

      {/* Meters */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(180,140,90,0.28)" }}>
        <Meter
          label="aim"
          value={(meter.current.aim / LANE_HALF + 1) / 2}
          active={phase === "aim"}
          colour="#ffd166"
        />
        <Meter
          label="power"
          value={meter.current.power}
          active={phase === "power"}
          colour="#e07a63"
        />
      </div>

      {/* Scorecard */}
      <div
        style={{
          display: "flex",
          borderTop: "1px solid rgba(180,140,90,0.28)",
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
          overflowX: "auto",
        }}
      >
        {game.frames.map((f, i) => (
          <div
            key={i}
            style={{
              flex: "1 0 auto",
              minWidth: 40,
              borderRight: "1px solid rgba(180,140,90,0.18)",
              background: i === game.current && !game.over ? "rgba(255,209,102,0.12)" : "transparent",
              padding: "3px 4px",
              textAlign: "center",
              color: "#c9bfae",
            }}
          >
            <div style={{ fontSize: 9, color: "#8a7c68" }}>{i + 1}</div>
            <div style={{ letterSpacing: "0.08em" }}>
              {f.rolls
                .map((r, j) =>
                  r === PIN_COUNT && (j === 0 || i === FRAMES - 1)
                    ? "X"
                    : j > 0 && f.rolls[j - 1] + r === PIN_COUNT && f.rolls[j - 1] !== PIN_COUNT
                      ? "/"
                      : r === 0
                        ? "-"
                        : String(r)
                )
                .join(" ") || " "}
            </div>
            <div style={{ color: "#f1e6d2" }}>{card[i] ?? " "}</div>
          </div>
        ))}
        <div style={{ flex: "0 0 auto", padding: "3px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#8a7c68" }}>total</div>
          <div style={{ fontSize: 17, color: "#ffd166" }}>{total(game)}</div>
        </div>
      </div>

      <div
        style={{
          padding: "6px 12px",
          borderTop: "1px solid rgba(180,140,90,0.28)",
          fontSize: 12,
          color: "#8a7c68",
          textAlign: "center",
        }}
      >
        {game.over
          ? `final score ${total(game)} — space to bowl again`
          : phase === "aim"
            ? "space to lock your line"
            : phase === "power"
              ? "space to set power"
              : phase === "rolling"
                ? "…"
                : "space for the next ball"}
      </div>
    </div>
  )
}

function Meter({
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
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 0", opacity: active ? 1 : 0.32 }}>
      <span style={{ width: 44, fontSize: 11, color: "#8a7c68" }}>{label}</span>
      <div style={{ flex: "1 1 auto", height: 9, background: "rgba(255,255,255,0.07)", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${Math.max(0, Math.min(1, value)) * 100}%`,
            background: colour,
          }}
        />
      </div>
    </div>
  )
}
