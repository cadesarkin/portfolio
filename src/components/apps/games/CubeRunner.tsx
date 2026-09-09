"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
import { useTheme } from "@/components/desktop/theme-context"
import { GAME_COLORS } from "@/lib/theme"
import { useCanvasSize, useGameLoop, useHighScore } from "./useGameShell"
import { GameFrame, TouchPad } from "./GameFrame"
import { useHighScoreEntry } from "./useHighScoreEntry"

/** Half-width of the playable strip, in world units either side of centre. */
const TRACK = 7.2
const CUBE = 0.4
const FAR = 36
/** Where the player sits along z. Cubes are drawn with the same projection. */
const PLAYER_Z = 1.0
const HIT_Z = 0.55
const START_SPEED = 8
const MAX_SPEED = 26
/** Metres between obstacle rows. */
const ROW_GAP = 8

/**
 * Steering is velocity-based, not positional.
 *
 * Holding a direction accelerates sideways up to a cap and releasing coasts
 * to a stop, which is how the arcade original feels. Snapping between fixed
 * lanes made the field read as seven slots rather than open ground.
 */
const STRAFE_ACCEL = 15
const STRAFE_MAX = 6.2
const STRAFE_DRAG = 9

interface Cube {
  x: number
  z: number
}

interface State {
  x: number
  /** Sideways velocity, world units per second. */
  vx: number
  /** -1, 0 or 1 — whichever direction is currently held. */
  input: number
  speed: number
  distance: number
  nextRow: number
  cubes: Cube[]
  dead: boolean
}

function initial(): State {
  return {
    x: 0,
    vx: 0,
    input: 0,
    speed: START_SPEED,
    distance: 0,
    nextRow: 16,
    cubes: [],
    dead: false,
  }
}

/**
 * Builds one row of cubes around a guaranteed gap.
 *
 * The gap is a continuous span rather than an open lane, and it narrows
 * with difficulty. Placing cubes freely can produce walls the player cannot
 * physically reach through, which reads as the game cheating.
 */
function spawnRow(z: number, difficulty: number): Cube[] {
  const gapHalf = 2.6 - difficulty * 1.1
  const gapAt = (Math.random() * 2 - 1) * (TRACK - gapHalf)
  const spacing = CUBE * 2.5

  const cubes: Cube[] = []
  for (let x = -TRACK; x <= TRACK; x += spacing) {
    if (Math.abs(x - gapAt) < gapHalf) continue
    // Sparser rows early on, and a little jitter so rows are not combs.
    if (Math.random() > 0.5 + difficulty * 0.45) continue
    cubes.push({ x: x + (Math.random() - 0.5) * spacing * 0.5, z })
  }
  return cubes
}

export default function CubeRunner({
  winId,
  isMobile,
}: {
  winId: string
  isMobile: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const { w, h } = useCanvasSize(canvasRef, wrapRef)
  const { theme } = useTheme()

  const state = useRef<State>(initial())
  const [score, setScore] = useState(0)
  const [dead, setDead] = useState(false)
  const [started, setStarted] = useState(false)
  const { best, submit } = useHighScore("cube-runner")
  const entry = useHighScoreEntry("cube-runner")

  const restart = useCallback(() => {
    state.current = initial()
    setScore(0)
    setDead(false)
    setStarted(true)
  }, [])

  /** Holds a direction until released. Touch buttons call hold(d)/hold(0). */
  const hold = useCallback((dir: -1 | 0 | 1) => {
    state.current.input = dir
  }, [])

  useWindowKeys(winId, (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      if (!started || state.current.dead) restart()
      return
    }
    if (e.key === "ArrowLeft" || e.key === "a") {
      e.preventDefault()
      hold(-1)
    } else if (e.key === "ArrowRight" || e.key === "d") {
      e.preventDefault()
      hold(1)
    }
  })

  // Keyup is not part of the focus-scoped delegation, which only forwards
  // keydown. Steering has to know when a key is released, so it listens
  // directly — guarded by the window being focused.
  useEffect(() => {
    const onUp = (e: KeyboardEvent) => {
      const left = e.key === "ArrowLeft" || e.key === "a"
      const right = e.key === "ArrowRight" || e.key === "d"
      if (!left && !right) return
      if (state.current.input === (left ? -1 : 1)) state.current.input = 0
    }
    window.addEventListener("keyup", onUp)
    return () => window.removeEventListener("keyup", onUp)
  }, [])

  useGameLoop(started && !dead, (dt) => {
    const s = state.current
    if (s.dead) return

    s.speed = Math.min(MAX_SPEED, s.speed + dt * 0.5)
    s.distance += s.speed * dt

    // Held input accelerates; releasing coasts to a stop through drag.
    if (s.input !== 0) {
      s.vx += s.input * STRAFE_ACCEL * dt
      s.vx = Math.max(-STRAFE_MAX, Math.min(STRAFE_MAX, s.vx))
    } else {
      const drag = STRAFE_DRAG * dt
      s.vx = Math.abs(s.vx) <= drag ? 0 : s.vx - Math.sign(s.vx) * drag
    }
    s.x += s.vx * dt
    // The edges are solid: stop dead rather than wrapping or dying.
    if (s.x < -TRACK) {
      s.x = -TRACK
      s.vx = 0
    } else if (s.x > TRACK) {
      s.x = TRACK
      s.vx = 0
    }

    const difficulty = Math.min(1, s.distance / 900)
    while (s.distance + FAR > s.nextRow) {
      s.cubes.push(...spawnRow(s.nextRow - s.distance + PLAYER_Z, difficulty))
      s.nextRow += ROW_GAP
    }

    for (const c of s.cubes) c.z -= s.speed * dt
    s.cubes = s.cubes.filter((c) => c.z > PLAYER_Z - 2)

    for (const c of s.cubes) {
      if (Math.abs(c.z - PLAYER_Z) < HIT_Z && Math.abs(c.x - s.x) < CUBE + 0.28) {
        s.dead = true
        setDead(true)
        submit(Math.floor(s.distance))
        entry.offer(Math.floor(s.distance))
        break
      }
    }

    setScore(Math.floor(s.distance))
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx || w === 0 || h === 0) return

    const horizon = h * 0.38
    // Projection: screen offset scales with 1/z from the horizon. F sets how
    // fast objects fall toward the bottom, K how wide the track opens out.
    const F = h * 0.62
    // Narrower than the visual track: the field is now twice as wide in
    // world units, so the same constant would push the edges off screen.
    const K = w * 0.075

    const project = (x: number, z: number) => {
      const d = Math.max(z, 0.3)
      const s = 1 / d
      return { sx: w / 2 + x * K * s, sy: horizon + F * s, s }
    }

    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const s = state.current

      // Sky and ground.
      const C = GAME_COLORS[theme]
      const sky = ctx.createLinearGradient(0, 0, 0, horizon)
      sky.addColorStop(0, C.skyTop)
      sky.addColorStop(1, C.skyBottom)
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, horizon)

      const ground = ctx.createLinearGradient(0, horizon, 0, h)
      ground.addColorStop(0, C.groundTop)
      ground.addColorStop(1, C.groundBottom)
      ctx.fillStyle = ground
      ctx.fillRect(0, horizon, w, h - horizon)

      ctx.lineWidth = 1

      // Transverse lines, scrolling with distance so speed is legible.
      const phase = s.distance % 2.5
      for (let i = 0; i < 40; i++) {
        const z = i * 2.5 - phase + PLAYER_Z
        if (z < 0.35) continue
        const { sy } = project(0, z)
        if (sy > h) continue
        const l = project(-TRACK - 0.9, z)
        const r = project(TRACK + 0.9, z)
        ctx.strokeStyle = C.gridLine
        ctx.globalAlpha = Math.max(0, 1 - (z - PLAYER_Z) / FAR)
        ctx.beginPath()
        ctx.moveTo(l.sx, sy)
        ctx.lineTo(r.sx, sy)
        ctx.stroke()
      }

      // Track edges.
      ctx.globalAlpha = 0.85
      ctx.strokeStyle = C.trackEdge
      ctx.lineWidth = 2
      for (const edge of [-TRACK - 0.9, TRACK + 0.9]) {
        const near = project(edge, 0.35)
        const far = project(edge, FAR)
        ctx.beginPath()
        ctx.moveTo(near.sx, near.sy)
        ctx.lineTo(far.sx, far.sy)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.lineWidth = 1

      // Cubes, far to near so nearer ones occlude correctly.
      const sorted = [...s.cubes].sort((a, b) => b.z - a.z)
      for (const c of sorted) {
        if (c.z <= 0.35) continue
        const base = project(c.x, c.z)
        const size = CUBE * K * base.s
        if (size < 0.7) continue

        const fade = Math.max(0.15, 1 - (c.z - PLAYER_Z) / FAR)
        ctx.globalAlpha = fade

        const top = base.sy - size * 1.9
        // Front face.
        ctx.fillStyle = C.cubeFace
        ctx.strokeStyle = C.cubeEdge
        ctx.beginPath()
        ctx.rect(base.sx - size, top, size * 2, size * 1.9)
        ctx.fill()
        ctx.stroke()
        // Top face, offset toward the horizon for a hint of solidity.
        const inset = size * 0.42
        ctx.fillStyle = C.cubeTop
        ctx.beginPath()
        ctx.moveTo(base.sx - size, top)
        ctx.lineTo(base.sx - size + inset, top - inset)
        ctx.lineTo(base.sx + size + inset, top - inset)
        ctx.lineTo(base.sx + size, top)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // Player, projected the same way so it shares the cubes' geometry.
      const p = project(s.x, PLAYER_Z)
      const psize = CUBE * K * p.s * 1.15
      ctx.fillStyle = s.dead ? C.playerDead : C.player
      ctx.strokeStyle = C.cubeEdge
      ctx.beginPath()
      ctx.moveTo(p.sx, p.sy - psize * 1.7)
      ctx.lineTo(p.sx + psize, p.sy)
      ctx.lineTo(p.sx, p.sy - psize * 0.45)
      ctx.lineTo(p.sx - psize, p.sy)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [w, h, theme])

  return (
    <GameFrame
      status={
        <>
          <span>{score} m</span>
          <span style={{ color: "var(--ink-faint)" }}>
            {dead
              ? "crashed — space to retry"
              : !started
                ? "space to start"
                : ""}
          </span>
          <span>best {best} m</span>
        </>
      }
      hint={
        isMobile
          ? "hold left or right to steer"
          : "hold ← → or a/d to steer · space to start"
      }
      controls={
        isMobile ? (
          <TouchPad
            buttons={[
              { label: "←", onPress: () => hold(-1), onRelease: () => hold(0) },
              {
                label: started && !dead ? "•" : "start",
                onPress: () => (!started || dead) && restart(),
              },
              { label: "→", onPress: () => hold(1), onRelease: () => hold(0) },
            ]}
          />
        ) : undefined
      }
    >
      <div
        ref={wrapRef}
        style={{
          width: "100%",
          height: "100%",
          minHeight: 240,
          position: "relative",
        }}
        onClick={() => (!started || dead) && restart()}
      >
        <canvas
          ref={canvasRef}
          aria-label="Cube Runner"
          style={{ display: "block", border: "1px solid var(--win-rule)" }}
        />
        {entry.prompt}
      </div>
    </GameFrame>
  )
}
