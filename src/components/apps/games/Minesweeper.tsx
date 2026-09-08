"use client"

import { useEffect, useRef, useState } from "react"
import {
  createBoard,
  reveal,
  toggleFlag,
  chord,
  flagsUsed,
  type Board,
} from "./engine/minesweeper"
import { GameFrame } from "./GameFrame"
import { useTheme } from "@/components/desktop/theme-context"

const LEVELS = {
  beginner: { w: 9, h: 9, mines: 10 },
  intermediate: { w: 16, h: 16, mines: 40 },
  expert: { w: 30, h: 16, mines: 99 },
} as const

type Level = keyof typeof LEVELS
const LEVEL_KEY = "sarkin.ms.level"

/**
 * Classic Minesweeper number colours.
 *
 * The night set is lifted and desaturated: the daylight blues and purples
 * fall below readable contrast on a dark cell.
 */
const NUM_COLOR: Record<"day" | "night", string[]> = {
  day: ["", "#1d6fd0", "#2c7a3f", "#c0392b", "#5b3fa8", "#a8631f", "#158b8b", "#0d1b26", "#6b7b88"],
  night: ["", "#6ab7ff", "#6ed08a", "#ff7a6b", "#c0a2ff", "#f0b24d", "#5fd6d6", "#dbe9f5", "#93a7b8"],
}

export default function Minesweeper({ isMobile }: { isMobile: boolean }) {
  const { theme } = useTheme()
  const numColor = NUM_COLOR[theme]
  const [level, setLevel] = useState<Level>("beginner")
  const { w: W, h: H, mines: MINES } = LEVELS[level]
  const [board, setBoard] = useState<Board>(() =>
    createBoard(LEVELS.beginner.w, LEVELS.beginner.h, LEVELS.beginner.mines)
  )
  const [elapsed, setElapsed] = useState(0)
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const playing = board.status === "playing"

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setElapsed((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [playing])

  // Restore the last level played, then keep it in step with the board.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LEVEL_KEY)
      if (saved && saved in LEVELS) {
        const l = saved as Level
        setLevel(l)
        setBoard(createBoard(LEVELS[l].w, LEVELS[l].h, LEVELS[l].mines))
      }
    } catch {
      // Storage unavailable; beginner is a fine default.
    }
  }, [])

  const restart = (next: Level = level) => {
    setLevel(next)
    setBoard(createBoard(LEVELS[next].w, LEVELS[next].h, LEVELS[next].mines))
    setElapsed(0)
    try {
      localStorage.setItem(LEVEL_KEY, next)
    } catch {
      // Non-fatal.
    }
  }

  const onCell = (i: number) => {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    setBoard((b) =>
      b.cells[i].state === "revealed" ? chord(b, i) : reveal(b, i)
    )
  }

  const face =
    board.status === "lost" ? "x_x" : board.status === "won" ? "^_^" : ":-)"

  return (
    <GameFrame
      status={
        <>
          <span>mines {String(MINES - flagsUsed(board)).padStart(2, "0")}</span>
          <button type="button" onClick={() => restart()} className="ms-face">
            {face}
          </button>
          <span>{String(Math.min(elapsed, 999)).padStart(3, "0")}s</span>
        </>
      }
      hint={
        isMobile
          ? "tap to reveal · hold to flag"
          : "click to reveal · right-click to flag · click a number to chord"
      }
    >
      <div
        style={{
          display: "flex",
          gap: 6,
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        {(Object.keys(LEVELS) as Level[]).map((l) => (
          <button
            key={l}
            type="button"
            className="seg"
            data-active={level === l ? "" : undefined}
            onClick={() => restart(l)}
          >
            {l}
          </button>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${W}, 1fr)`,
          gap: 1,
          // Sized from the grid so expert (30x16) stays square-celled and
          // fits the window instead of stretching.
          width: `min(100%, ${W * 30}px)`,
          aspectRatio: `${W} / ${H}`,
          margin: "0 auto",
          background: "var(--win-rule)",
          border: "1px solid var(--win-border)",
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {board.cells.map((cell, i) => {
          const shown = cell.state === "revealed"
          return (
            <button
              key={i}
              type="button"
              aria-label={`cell ${(i % W) + 1}, ${Math.floor(i / W) + 1}`}
              onClick={() => onCell(i)}
              onContextMenu={(e) => {
                e.preventDefault()
                setBoard((b) => toggleFlag(b, i))
              }}
              onPointerDown={() => {
                if (!isMobile) return
                didLongPress.current = false
                longPress.current = setTimeout(() => {
                  didLongPress.current = true
                  setBoard((b) => toggleFlag(b, i))
                }, 400)
              }}
              onPointerUp={() => {
                if (longPress.current) clearTimeout(longPress.current)
              }}
              onPointerLeave={() => {
                if (longPress.current) clearTimeout(longPress.current)
              }}
              style={{
                font: "inherit",
                fontSize: W > 20 ? 11 : 13,
                fontWeight: 700,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                cursor: "pointer",
                touchAction: "manipulation",
                color:
                  cell.mine && shown
                    ? numColor[3]
                    : numColor[cell.adj] || "var(--ink)",
                // Hidden cells sit clearly darker and raised; revealed ones go
                // flat and near-white. At closer values the two states were
                // hard to tell apart at a glance, which is the whole game.
                background: shown
                  ? cell.mine
                    ? "rgba(192,57,43,0.22)"
                    : "var(--cell-shown)"
                  : "var(--cell-hidden)",
                border: shown
                  ? "1px solid rgba(20,40,60,0.08)"
                  : "1px solid rgba(255,255,255,0.9)",
                borderRightColor: shown ? undefined : "rgba(20,40,60,0.30)",
                borderBottomColor: shown ? undefined : "rgba(20,40,60,0.30)",
              }}
            >
              {cell.state === "flagged"
                ? "!"
                : shown
                  ? cell.mine
                    ? "*"
                    : cell.adj > 0
                      ? cell.adj
                      : ""
                  : ""}
            </button>
          )
        })}
      </div>

      {board.status === "won" && (
        <p style={{ textAlign: "center", color: "#2c7a3f", margin: "10px 0 0" }}>
          cleared in {elapsed}s
        </p>
      )}
      {board.status === "lost" && (
        <p style={{ textAlign: "center", color: "#c0392b", margin: "10px 0 0" }}>
          boom. click the face to try again
        </p>
      )}
    </GameFrame>
  )
}
