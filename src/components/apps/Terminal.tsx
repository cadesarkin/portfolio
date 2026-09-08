"use client"

import { useEffect, useRef, useState } from "react"
import { useWindows } from "@/components/desktop/window-manager"
import { resolve } from "@/lib/vfs-utils"
import { run, completeInput, type Line } from "./terminal/commands"

const PROMPT_USER = "cade@portfolio"
const HISTORY_KEY = "sarkin.history"
const HISTORY_MAX = 100

function displayCwd(cwd: string) {
  return cwd === "/" ? "~" : `~${cwd}`
}

const BANNER: Line[] = [
  { text: "sarkin-sh — a real shell over this filesystem", tone: "accent" },
  { text: "type 'help' for commands, 'neofetch' for the tour", tone: "dim" },
  { text: "" },
]

interface Props {
  winId: string
  isMobile: boolean
  onReboot: () => void
}

export default function Terminal({ winId, isMobile, onReboot }: Props) {
  const { open, close } = useWindows()
  const [lines, setLines] = useState<Line[]>(BANNER)
  const [cwd, setCwd] = useState("/")
  const [input, setInput] = useState("")
  const [history, setHistory] = useState<string[]>([])
  /** -1 means "not browsing history"; otherwise an index from the end. */
  const [histIdx, setHistIdx] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // History survives across sessions, which is most of what makes the shell
  // feel real rather than a toy.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) setHistory(JSON.parse(saved))
    } catch {
      // Corrupt or unavailable storage: start with an empty history.
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines])

  const push = (next: Line[]) => setLines((prev) => [...prev, ...next])

  const submit = (raw: string) => {
    const trimmed = raw.trim()
    push([{ text: `${PROMPT_USER}:${displayCwd(cwd)}$ ${raw}`, tone: "prompt" }])

    if (trimmed !== "") {
      const next = [...history, trimmed].slice(-HISTORY_MAX)
      setHistory(next)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        // Non-fatal; history simply will not persist.
      }
    }

    const result = run(trimmed, cwd)

    if (result.clear) {
      setLines([])
    } else if (result.lines?.length) {
      push(result.lines)
    }

    if (result.cwd) setCwd(result.cwd)
    if (result.open) {
      const node = resolve(result.open, "/")
      if (node) {
        if (node.kind === "link") {
          window.open(node.url, "_blank", "noopener,noreferrer")
        } else {
          open(node)
        }
      }
    }
    if (result.reboot) onReboot()
    if (result.closeWin) close(winId)

    setInput("")
    setHistIdx(-1)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      submit(input)
      return
    }

    if (e.key === "Tab") {
      e.preventDefault()
      const { value, candidates } = completeInput(input, cwd)
      setInput(value)
      if (candidates.length > 1) {
        push([
          { text: `${PROMPT_USER}:${displayCwd(cwd)}$ ${input}`, tone: "prompt" },
          { text: candidates.join("  "), tone: "dim" },
        ])
      }
      return
    }

    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (history.length === 0) return
      const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1)
      setHistIdx(next)
      setInput(history[next])
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (histIdx < 0) return
      const next = histIdx + 1
      if (next >= history.length) {
        setHistIdx(-1)
        setInput("")
      } else {
        setHistIdx(next)
        setInput(history[next])
      }
      return
    }

    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault()
      setLines([])
      return
    }

    if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault()
      push([{ text: `${PROMPT_USER}:${displayCwd(cwd)}$ ${input}^C`, tone: "dim" }])
      setInput("")
      setHistIdx(-1)
    }
  }

  const toneColor = (tone?: string) =>
    tone === "err"
      ? "#c0392b"
      : tone === "dim"
        ? "var(--ink-faint)"
        : tone === "accent"
          ? "var(--accent)"
          : tone === "prompt"
            ? "var(--ink-muted)"
            : "var(--ink)"

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
      onClick={() => inputRef.current?.focus()}
    >
      <div
        ref={scrollRef}
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          padding: "10px 12px 0",
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {lines.map((l, i) =>
          l.right !== undefined ? (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <span style={{ flex: "0 0 150px", color: "var(--ink)" }}>
                {l.text === "" ? " " : l.text}
              </span>
              <span style={{ flex: "1 1 auto", color: toneColor(l.tone) }}>
                {l.right === "" ? " " : l.right}
              </span>
            </div>
          ) : (
            <div key={i} style={{ color: toneColor(l.tone) }}>
              {l.text === "" ? " " : l.text}
            </div>
          )
        )}

        <div style={{ display: "flex", gap: 6, padding: "2px 0 10px" }}>
          <span style={{ color: "var(--accent)", flex: "0 0 auto", fontSize: 12 }}>
            {PROMPT_USER}:{displayCwd(cwd)}$
          </span>
          <input
            ref={inputRef}
            value={input}
            autoFocus
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Terminal input"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              font: "inherit",
              fontSize: 12,
              color: "var(--ink)",
              background: "transparent",
              border: 0,
              outline: "none",
              padding: 0,
            }}
          />
        </div>
      </div>

      {/* Tab, arrows and Ctrl+C have no equivalent on a soft keyboard. */}
      {isMobile && (
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "6px 8px",
            borderTop: "1px solid var(--win-rule)",
          }}
        >
          {(
            [
              ["tab", "Tab"],
              ["↑", "ArrowUp"],
              ["↓", "ArrowDown"],
              ["^C", "ctrl-c"],
            ] as const
          ).map(([label, key]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                const el = inputRef.current
                if (!el) return
                el.focus()
                const fake = {
                  key: key === "ctrl-c" ? "c" : key,
                  ctrlKey: key === "ctrl-c",
                  preventDefault: () => {},
                } as React.KeyboardEvent<HTMLInputElement>
                onKeyDown(fake)
              }}
              style={{
                font: "inherit",
                fontSize: 12,
                padding: "5px 12px",
                color: "var(--ink-muted)",
                background: "none",
                border: "1px solid var(--win-rule)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
