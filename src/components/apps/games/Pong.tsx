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
 * The AI predicts where the ball will arrive, then aims imperfectly.
 *
 * The old version tracked the ball's current y at a capped speed, which
 * made it purely a function of ball speed: trivial while the rally was slow,
 * impossible once it was fast, and never wrong in an interesting way.
 * Predicting the landing point and then missing it on purpose gives it a
 * difficulty that can actually be tuned.
 */
const AI_SPEED = 1.15
/** Fraction of the court the AI can be off by, before ramping. */
const AI_ERROR = 0.17
/** Seconds before it reacts to a change of direction. */
const AI_REACTION = 0.18

interface State {
  ballX: number
  ballY: number
  vx: number
  vy: number
  playerY: number
  aiY: number
  playerScore: number
  aiScore: number
  /** Where the AI currently believes the ball will arrive. */
  aiTarget: number
  /** Counts down before it re-aims, so it cannot react instantly. */
  aiDelay: number
}

/**
 * Simulates the ball forward to the AI paddle, reflecting off the walls.
 *
 * Closed form rather than stepped: fold the straight-line travel into the
 * range [0, 2) and mirror the second half, which is what a bounce does.
 */
function predict(s: State): number {
  if (s.vx <= 0) return 0.5
  const dx = 0.955 - s.ballX
  const y = s.ballY + (s.vy / s.vx) * dx
  const folded = ((y % 2) + 2) % 2
  return folded > 1 ? 2 - folded : folded
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
    aiTarget: 0.5,
    aiDelay: 0,
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

    // Re-aim after the reaction delay, and only while the ball is incoming.
    s.aiDelay -= dt
    if (s.vx > 0 && s.aiDelay <= 0) {
      // Error shrinks as the AI falls behind, so a blowout self-corrects
      // rather than running away.
      const behind = Math.max(0, s.playerScore - s.aiScore)
      const spread = AI_ERROR * Math.max(0.25, 1 - behind * 0.28)
      s.aiTarget = predict(s) + (Math.random() * 2 - 1) * spread
      s.aiDelay = AI_REACTION
    } else if (s.vx < 0 && s.aiDelay <= 0) {
      // Ball heading away: drift back toward the middle like a real player.
      s.aiTarget = 0.5
      s.aiDelay = AI_REACTION * 2
    }

    const delta = s.aiTarget - s.aiY
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
        s.aiDelay = AI_REACTION
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
        s.aiDelay = AI_REACTION
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
      ctx.fillStyle = C.opponent
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
