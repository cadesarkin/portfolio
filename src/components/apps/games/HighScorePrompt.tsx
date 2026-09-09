"use client"

import { useEffect, useRef, useState } from "react"
import {
  boardById,
  formatScore,
  validateInitials,
  type Entry,
} from "@/lib/leaderboard"

/**
 * Arcade initials entry, shown when a run earns a place on a board.
 *
 * Three letters is the whole moderation strategy: the input physically cannot
 * accept anything but A-Z, so there is no free text to filter.
 */
export default function HighScorePrompt({
  boardId,
  score,
  onDone,
}: {
  boardId: string
  score: number
  onDone: (entries: Entry[] | null) => void
}) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const board = boardById(boardId)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  if (!board) return null

  const submit = async () => {
    const check = validateInitials(value)
    if (!check.ok) {
      setError(check.error ?? "try again")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ board: boardId, initials: check.value, score }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "could not save")
        setSaving(false)
        return
      }
      onDone(data.entries ?? [])
    } catch {
      setError("could not reach the leaderboard")
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 3,
        display: "grid",
        placeItems: "center",
        background: "rgba(6, 22, 38, 0.55)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "var(--win-fill-focus)",
          border: "1px solid var(--win-border-focus)",
          padding: "20px 24px",
          textAlign: "center",
          minWidth: 260,
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--ink-muted)",
          }}
        >
          new high score
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: "8px 0 2px",
            color: "var(--accent)",
          }}
        >
          {formatScore(board, score)}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
          {board.label}
        </div>

        <input
          ref={inputRef}
          value={value}
          maxLength={3}
          inputMode="text"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label="Your initials, three letters"
          // Non-letters are stripped as you type, so the field can never hold
          // anything the server would reject.
          onChange={(e) => {
            setValue(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
            setError(null)
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Enter") submit()
          }}
          style={{
            display: "block",
            width: "5ch",
            margin: "16px auto 6px",
            padding: "6px 0",
            font: "inherit",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "0.32em",
            textAlign: "center",
            textIndent: "0.32em",
            color: "var(--ink)",
            background: "var(--cell-shown)",
            border: `1px solid ${error ? "#c0392b" : "var(--win-border)"}`,
            outline: "none",
          }}
        />

        <div
          style={{
            minHeight: 18,
            fontSize: 12,
            color: error ? "#c0392b" : "var(--ink-faint)",
          }}
        >
          {error ?? "three letters"}
        </div>

        <div
          style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}
        >
          <button
            type="button"
            className="seg"
            onClick={submit}
            disabled={saving || value.length !== 3}
          >
            {saving ? "saving" : "submit"}
          </button>
          <button
            type="button"
            className="seg"
            onClick={() => onDone(null)}
            disabled={saving}
          >
            skip
          </button>
        </div>
      </div>
    </div>
  )
}
