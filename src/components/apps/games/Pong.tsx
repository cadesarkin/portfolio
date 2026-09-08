"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
import { useTheme } from "@/components/desktop/theme-context"
import { GAME_COLORS } from "@/lib/theme"
import { useCanvasSize, useGameLoop } from "./useGameShell"
import { GameFrame, TouchPad } from "./GameFrame"

const PADDLE_H = 0.22 // fraction of court height
const PADDLE_W = 8 // px
const BALL = 6 // px
const WIN_SCORE = 5
/**
 * Capped so the AI is beatable. Tracking the ball perfectly would make it
 * unloseable, which is not a game.
 */
const AI_SPEED = 0.62

interface State {
  ballX: number
  ballY: number
  vx: number
  vy: number
  playerY: number
  aiY: number
  playerScore: number
  aiScore: number
}

function serve(toPlayer: boolean): Pick<State, "ballX" | "ballY" | "vx" | "vy"> {
  return {
    ballX: 0.5,
    ballY: 0.5,
    vx: (toPlayer ? -1 : 1) * 0.42,
    vy: (Math.random() * 2 - 1) * 0.26,
  }
}

function initial(): State {
  return {
    ...serve(Math.random() < 0.5),
    playerY: 0.5,
    aiY: 0.5,
    playerScore: 0,
    aiScore: 0,
  }
}

export default function Pong({
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
  const [scores, setScores] = useState({ player: 0, ai: 0 })
  const [running, setRunning] = useState(false)

  const over =
    scores.player >= WIN_SCORE || scores.ai >= WIN_SCORE

  const restart = useCallback(() => {
    state.current = initial()
    setScores({ player: 0, ai: 0 })
    setRunning(true)
  }, [])

  const nudge = useCallback((dy: number) => {
    const s = state.current
    s.playerY = Math.max(PADDLE_H / 2, Math.min(1 - PADDLE_H / 2, s.playerY + dy))
  }, [])

  useWindowKeys(winId, (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      if (!running || over) restart()
      return
    }
    if (e.key === "ArrowUp" || e.key === "w") {
      e.preventDefault()
      nudge(-0.09)
    } else if (e.key === "ArrowDown" || e.key === "s") {
      e.preventDefault()
      nudge(0.09)
    }
  })

  useGameLoop(running && !over, (dt) => {
    const s = state.current

    s.ballX += s.vx * dt
    s.ballY += s.vy * dt

    // Walls.
    if (s.ballY < 0.02) {
      s.ballY = 0.02
      s.vy = Math.abs(s.vy)
    } else if (s.ballY > 0.98) {
      s.ballY = 0.98
      s.vy = -Math.abs(s.vy)
    }

    // AI drifts toward the ball at a capped rate.
    const aiTarget = s.ballY
    const delta = aiTarget - s.aiY
    s.aiY += Math.sign(delta) * Math.min(Math.abs(delta), AI_SPEED * dt)
    s.aiY = Math.max(PADDLE_H / 2, Math.min(1 - PADDLE_H / 2, s.aiY))

    const hits = (paddleY: number) => Math.abs(s.ballY - paddleY) < PADDLE_H / 2

    // Player paddle on the left.
    if (s.ballX < 0.045 && s.vx < 0) {
      if (hits(s.playerY)) {
        s.ballX = 0.045
        s.vx = Math.abs(s.vx) * 1.06
        // Contact point steers the return, so the player has real control.
        s.vy += (s.ballY - s.playerY) * 0.9
      } else if (s.ballX < -0.03) {
        s.aiScore += 1
        setScores({ player: s.playerScore, ai: s.aiScore })
        Object.assign(s, serve(false))
      }
    }

    // AI paddle on the right.
    if (s.ballX > 0.955 && s.vx > 0) {
      if (hits(s.aiY)) {
        s.ballX = 0.955
        s.vx = -Math.abs(s.vx) * 1.06
        s.vy += (s.ballY - s.aiY) * 0.9
      } else if (s.ballX > 1.03) {
        s.playerScore += 1
        setScores({ player: s.playerScore, ai: s.aiScore })
        Object.assign(s, serve(true))
      }
    }

    // Keep the rally from becoming unplayably fast.
    s.vx = Math.max(-1.1, Math.min(1.1, s.vx))
    s.vy = Math.max(-0.8, Math.min(0.8, s.vy))
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx || w === 0 || h === 0) return

    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const s = state.current

      const C = GAME_COLORS[theme]
      ctx.fillStyle = C.court
      ctx.fillRect(0, 0, w, h)

      // Centre line.
      ctx.strokeStyle = C.courtLine
      ctx.setLineDash([5, 7])
      ctx.beginPath()
      ctx.moveTo(w / 2, 0)
      ctx.lineTo(w / 2, h)
      ctx.stroke()
      ctx.setLineDash([])

      const ph = PADDLE_H * h
      ctx.fillStyle = C.player
      ctx.fillRect(6, s.playerY * h - ph / 2, PADDLE_W, ph)
      ctx.fillStyle = C.cubeTop
      ctx.fillRect(w - 6 - PADDLE_W, s.aiY * h - ph / 2, PADDLE_W, ph)

      ctx.fillStyle = C.ball
      ctx.fillRect(s.ballX * w - BALL / 2, s.ballY * h - BALL / 2, BALL, BALL)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [w, h, theme])

  // Mouse controls the paddle directly — the most natural Pong input.
  const onPointerMove = (e: React.PointerEvent) => {
    if (isMobile) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = (e.clientY - rect.top) / rect.height
    state.current.playerY = Math.max(
      PADDLE_H / 2,
      Math.min(1 - PADDLE_H / 2, y)
    )
  }

  return (
    <GameFrame
      status={
        <>
          <span>you {scores.player}</span>
          <span style={{ color: "var(--ink-faint)" }}>
            {over
              ? scores.player > scores.ai
                ? "you win — space to play again"
                : "you lose — space to play again"
              : !running
                ? "space to start"
                : `first to ${WIN_SCORE}`}
          </span>
          <span>cpu {scores.ai}</span>
        </>
      }
      hint={isMobile ? "tap the pad to move" : "move the mouse · ↑ ↓ also work · space to start"}
      controls={
        isMobile ? (
          <TouchPad
            buttons={[
              { label: "↑", onPress: () => nudge(-0.1) },
              {
                label: running && !over ? "•" : "start",
                onPress: () => (!running || over) && restart(),
              },
              { label: "↓", onPress: () => nudge(0.1) },
            ]}
          />
        ) : undefined
      }
    >
      <div
        ref={wrapRef}
        style={{ width: "100%", height: "100%", minHeight: 200 }}
        onPointerMove={onPointerMove}
        onClick={() => (!running || over) && restart()}
      >
        <canvas
          ref={canvasRef}
          aria-label="Pong"
          style={{
            display: "block",
            border: "1px solid var(--win-rule)",
            cursor: isMobile ? "default" : "none",
          }}
        />
      </div>
    </GameFrame>
  )
}
