"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
import { useTheme } from "@/components/desktop/theme-context"
import { GAME_COLORS } from "@/lib/theme"
import { useCanvasSize, useGameLoop, useHighScore } from "./useGameShell"
import { GameFrame, TouchPad } from "./GameFrame"

/** Half-width of the playable strip, in world units either side of centre. */
const TRACK = 3.4
/** Lanes the player and the obstacles snap to. */
const LANES = 7
const LANE_W = (TRACK * 2) / (LANES - 1)
const CUBE = 0.34
const FAR = 34
/** Where the player sits along z. Cubes are drawn with the same projection. */
const PLAYER_Z = 1.0
const HIT_Z = 0.55
const START_SPEED = 8
const MAX_SPEED = 24
/** Metres between obstacle rows. */
const ROW_GAP = 7

interface Cube {
  lane: number
  z: number
}

interface State {
  lane: number
  x: number
  speed: number
  distance: number
  nextRow: number
  cubes: Cube[]
  dead: boolean
}

const laneX = (lane: number) => -TRACK + lane * LANE_W

function initial(): State {
  return {
    lane: (LANES - 1) / 2,
    x: 0,
    speed: START_SPEED,
    distance: 0,
    nextRow: 14,
    cubes: [],
    dead: false,
  }
}

/**
 * Builds one row of cubes with at least one gap.
 *
 * Rows rather than scattered cubes, and a guaranteed gap, so every row is
 * passable. Randomly placed obstacles can produce walls the player cannot
 * physically get through, which reads as the game cheating.
 */
function spawnRow(z: number, difficulty: number): Cube[] {
  const gaps = difficulty > 0.6 ? 1 : 2
  const open = new Set<number>()
  while (open.size < gaps) open.add(Math.floor(Math.random() * LANES))

  const cubes: Cube[] = []
  for (let lane = 0; lane < LANES; lane++) {
    if (open.has(lane)) continue
    // Sparser rows early on.
    if (Math.random() > 0.45 + difficulty * 0.5) continue
    cubes.push({ lane, z })
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

  const restart = useCallback(() => {
    state.current = initial()
    setScore(0)
    setDead(false)
    setStarted(true)
  }, [])

  const steer = useCallback((dir: -1 | 1) => {
    const s = state.current
    if (s.dead) return
    s.lane = Math.max(0, Math.min(LANES - 1, s.lane + dir))
  }, [])

  useWindowKeys(winId, (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      if (!started || state.current.dead) restart()
      return
    }
    if (e.key === "ArrowLeft" || e.key === "a") {
      e.preventDefault()
      steer(-1)
    } else if (e.key === "ArrowRight" || e.key === "d") {
      e.preventDefault()
      steer(1)
    }
  })

  useGameLoop(started && !dead, (dt) => {
    const s = state.current
    if (s.dead) return

    s.speed = Math.min(MAX_SPEED, s.speed + dt * 0.5)
    s.distance += s.speed * dt

    // Ease toward the target lane so the strafe reads as movement.
    const target = laneX(s.lane)
    s.x += (target - s.x) * Math.min(1, dt * 11)

    const difficulty = Math.min(1, s.distance / 900)
    while (s.distance + FAR > s.nextRow) {
      s.cubes.push(...spawnRow(s.nextRow - s.distance + PLAYER_Z, difficulty))
      s.nextRow += ROW_GAP
    }

    for (const c of s.cubes) c.z -= s.speed * dt
    s.cubes = s.cubes.filter((c) => c.z > PLAYER_Z - 2)

    for (const c of s.cubes) {
      if (
        Math.abs(c.z - PLAYER_Z) < HIT_Z &&
        Math.abs(laneX(c.lane) - s.x) < CUBE + 0.3
      ) {
        s.dead = true
        setDead(true)
        submit(Math.floor(s.distance))
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
    const K = w * 0.13

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
      const phase = s.distance % 2
      for (let i = 0; i < 40; i++) {
        const z = i * 2 - phase + PLAYER_Z
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
        const x = laneX(c.lane)
        const base = project(x, c.z)
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
          ? "tap left or right to dodge"
          : "← → or a/d to dodge · space to start"
      }
      controls={
        isMobile ? (
          <TouchPad
            buttons={[
              { label: "←", onPress: () => steer(-1) },
              {
                label: started && !dead ? "•" : "start",
                onPress: () => (!started || dead) && restart(),
              },
              { label: "→", onPress: () => steer(1) },
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
      </div>
    </GameFrame>
  )
}
