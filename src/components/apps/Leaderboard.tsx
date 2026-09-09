"use client"

import { useCallback, useEffect, useState } from "react"
import { formatScore, type Board, type Entry } from "@/lib/leaderboard"

interface BoardWithEntries extends Board {
  entries: Entry[]
}

const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"]

function BoardTable({ board }: { board: BoardWithEntries }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2
        style={{
          fontSize: 12,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--ink-muted)",
          margin: "0 0 8px",
          paddingBottom: 6,
          borderBottom: "1px solid var(--win-rule)",
        }}
      >
        {board.label}
      </h2>

      {board.entries.length === 0 ? (
        <p style={{ margin: 0, color: "var(--ink-faint)", fontSize: 13 }}>
          no scores yet — be the first
        </p>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {board.entries.map((e, i) => (
            <li
              key={`${e.initials}-${e.at}-${i}`}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 14,
                padding: "4px 0",
                fontVariantNumeric: "tabular-nums",
                color: i === 0 ? "var(--accent)" : "var(--ink)",
                fontWeight: i === 0 ? 700 : 400,
              }}
            >
              <span style={{ flex: "0 0 40px", color: "var(--ink-faint)" }}>
                {ORDINAL[i] ?? `${i + 1}th`}
              </span>
              <span style={{ flex: "0 0 4ch", letterSpacing: "0.14em" }}>
                {e.initials}
              </span>
              <span style={{ flex: "1 1 auto" }}>
                {formatScore(board, e.score)}
              </span>
              <span
                style={{
                  flex: "0 0 auto",
                  color: "var(--ink-faint)",
                  fontSize: 12,
                }}
              >
                {e.at ? new Date(e.at).toLocaleDateString() : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default function Leaderboard() {
  const [boards, setBoards] = useState<BoardWithEntries[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBoards(data.boards)
    } catch {
      setError("could not reach the leaderboard")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div style={{ padding: "18px 22px", maxWidth: "70ch" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 18, margin: 0, letterSpacing: "0.04em" }}>
          high scores
        </h1>
        <button type="button" className="seg" onClick={load}>
          refresh
        </button>
      </div>

      {error && (
        <p style={{ color: "#c0392b", fontSize: 13 }}>
          {error} — <button type="button" className="seg" onClick={load}>retry</button>
        </p>
      )}

      {!boards && !error && (
        <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>loading…</p>
      )}

      {boards?.map((b) => (
        <BoardTable key={b.id} board={b} />
      ))}

      {boards && (
        <p
          style={{
            color: "var(--ink-faint)",
            fontSize: 12,
            borderTop: "1px solid var(--win-rule)",
            paddingTop: 10,
            margin: 0,
          }}
        >
          beat a top ten score in any game and you will be asked for three
          letters.
        </p>
      )}
    </div>
  )
}
