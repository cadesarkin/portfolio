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

const W = 9
const H = 9
const MINES = 10

/** Classic Minesweeper number colours, restated in the site's ink palette. */
const NUM_COLOR = [
  "",
  "#1d6fd0",
  "#2c7a3f",
  "#c0392b",
  "#5b3fa8",
  "#a8631f",
  "#158b8b",
  "#0d1b26",
  "#6b7b88",
]

export default function Minesweeper({ isMobile }: { isMobile: boolean }) {
  const [board, setBoard] = useState<Board>(() => createBoard(W, H, MINES))
  const [elapsed, setElapsed] = useState(0)
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  const playing = board.status === "playing"

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setElapsed((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [playing])

  const restart = () => {
    setBoard(createBoard(W, H, MINES))
    setElapsed(0)
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
          <button type="button" onClick={restart} className="ms-face">
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
          display: "grid",
          gridTemplateColumns: `repeat(${W}, 1fr)`,
          gap: 1,
          width: "min(100%, 320px)",
          aspectRatio: "1",
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
                fontSize: 13,
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
                    ? "#c0392b"
                    : NUM_COLOR[cell.adj] || "var(--ink)",
                // Hidden cells sit clearly darker and raised; revealed ones go
                // flat and near-white. At closer values the two states were
                // hard to tell apart at a glance, which is the whole game.
                background: shown
                  ? cell.mine
                    ? "rgba(192,57,43,0.22)"
                    : "rgba(255,255,255,0.78)"
                  : "rgba(176,197,216,0.95)",
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
