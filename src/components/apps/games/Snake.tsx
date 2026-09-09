"use client"

import { useEffect, useRef, useState } from "react"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
import { createGame, tick, turn, type Dir, type Game } from "./engine/snake"
import { useHighScore } from "./useGameShell"
import { GameFrame, TouchPad } from "./GameFrame"
import { useHighScoreEntry } from "./useHighScoreEntry"

const W = 26
const H = 16
/** Milliseconds per step. Speeds up as the snake grows. */
const BASE_MS = 130
const MIN_MS = 62

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
}

export default function Snake({
  winId,
  isMobile,
}: {
  winId: string
  isMobile: boolean
}) {
  const [game, setGame] = useState<Game>(() => createGame(W, H))
  const [paused, setPaused] = useState(false)
  const { best, submit } = useHighScore("snake")
  const entry = useHighScoreEntry("snake")
  const gameRef = useRef(game)
  gameRef.current = game

  useEffect(() => {
    if (!game.dead) return
    submit(game.score)
    if (game.score > 0) entry.offer(game.score)
  }, [game.dead, game.score, submit, entry])

  /**
   * Fixed-step loop, independent of frame rate.
   *
   * The snake must move on a grid at a steady cadence; driving it straight
   * from rAF would tie its speed to the display's refresh rate.
   */
  useEffect(() => {
    if (game.dead || paused) return
    const ms = Math.max(MIN_MS, BASE_MS - gameRef.current.score * 3)
    const id = setInterval(() => setGame((g) => tick(g)), ms)
    return () => clearInterval(id)
  }, [game.dead, game.score, paused])

  // Pause when the tab is hidden rather than letting the snake run unseen.
  useEffect(() => {
    const onVis = () => document.hidden && setPaused(true)
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [])

  const steer = (dir: Dir) => {
    setPaused(false)
    setGame((g) => turn(g, dir))
  }

  const restart = () => {
    setGame(createGame(W, H))
    setPaused(false)
  }

  useWindowKeys(winId, (e) => {
    if (e.key === " ") {
      e.preventDefault()
      if (gameRef.current.dead) restart()
      else setPaused((p) => !p)
      return
    }
    if (e.key === "r") {
      e.preventDefault()
      restart()
      return
    }
    const dir = KEY_DIR[e.key]
    if (dir) {
      e.preventDefault()
      steer(dir)
    }
  })

  // Rendered as a character grid so the game reads as terminal output.
  const rows: string[] = []
  for (let y = 0; y < H; y++) {
    let row = ""
    for (let x = 0; x < W; x++) {
      const isHead = game.snake[0][0] === x && game.snake[0][1] === y
      const isBody = !isHead && game.snake.some((s) => s[0] === x && s[1] === y)
      const isFood = game.food[0] === x && game.food[1] === y
      row += isHead ? "@" : isBody ? "o" : isFood ? "*" : "."
    }
    rows.push(row)
  }

  return (
    <GameFrame
      status={
        <>
          <span>score {game.score}</span>
          <span style={{ color: "var(--ink-faint)" }}>
            {game.dead ? "dead — space to restart" : paused ? "paused" : ""}
          </span>
          <span>best {best}</span>
        </>
      }
      hint={isMobile ? "tap the pad to steer" : "arrows or wasd · space pauses · r restarts"}
      controls={
        isMobile ? (
          <TouchPad
            buttons={[
              { label: "←", onPress: () => steer("left") },
              { label: "↑", onPress: () => steer("up") },
              { label: "↓", onPress: () => steer("down") },
              { label: "→", onPress: () => steer("right") },
            ]}
          />
        ) : undefined
      }
    >
      {entry.prompt}
      <pre
        aria-label={`snake, score ${game.score}`}
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: "clamp(9px, 2.2vw, 14px)",
          lineHeight: 1.15,
          letterSpacing: "0.14em",
          color: game.dead ? "var(--ink-faint)" : "var(--ink)",
          userSelect: "none",
        }}
      >
        {rows.join("\n")}
      </pre>
    </GameFrame>
  )
}
