"use client"

import { useCallback, useRef, useState } from "react"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
import {
  createCanvas,
  paint,
  line,
  fill,
  clear,
  toText,
  isBlank,
  idx,
  BRUSHES,
  BOX,
  PALETTE,
  type Canvas,
} from "./paint/engine"

const COLS = 64
const ROWS = 26
const CELL_W = 9
const CELL_H = 16
const UNDO_DEPTH = 40

type Tool = "draw" | "erase" | "fill"

export default function AsciiPaint({
  winId,
  isMobile,
}: {
  winId: string
  isMobile: boolean
}) {
  const [canvas, setCanvas] = useState<Canvas>(() => createCanvas(COLS, ROWS))
  const [brush, setBrush] = useState("#")
  const [color, setColor] = useState(0)
  const [tool, setTool] = useState<Tool>("draw")
  const [copied, setCopied] = useState(false)

  const undoStack = useRef<Canvas[]>([])
  const drawing = useRef(false)
  const lastCell = useRef<{ x: number; y: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const pushUndo = useCallback((c: Canvas) => {
    undoStack.current.push(c)
    if (undoStack.current.length > UNDO_DEPTH) undoStack.current.shift()
  }, [])

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (prev) setCanvas(prev)
  }, [])

  /** Pointer position to grid cell. */
  const cellAt = (e: React.PointerEvent): { x: number; y: number } | null => {
    const el = gridRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * COLS)
    const y = Math.floor(((e.clientY - r.top) / r.height) * ROWS)
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null
    return { x, y }
  }

  const apply = (x: number, y: number, from?: { x: number; y: number }) => {
    const ch = tool === "erase" ? " " : brush
    const col = tool === "erase" ? -1 : color

    setCanvas((c) => {
      if (tool === "fill") return fill(c, x, y, ch, col)
      // Join to the previous sample so a fast drag stays continuous.
      if (from) return line(c, from.x, from.y, x, y, ch, col)
      return paint(c, x, y, ch, col)
    })
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const cell = cellAt(e)
    if (!cell) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    pushUndo(canvas)
    drawing.current = true
    lastCell.current = cell
    apply(cell.x, cell.y)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current || tool === "fill") return
    const cell = cellAt(e)
    if (!cell) return
    const from = lastCell.current
    if (from && from.x === cell.x && from.y === cell.y) return
    apply(cell.x, cell.y, from ?? undefined)
    lastCell.current = cell
  }

  const endStroke = () => {
    drawing.current = false
    lastCell.current = null
  }

  useWindowKeys(winId, (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault()
      undo()
    } else if (e.key === "e") {
      setTool("erase")
    } else if (e.key === "b") {
      setTool("draw")
    } else if (e.key === "g") {
      setTool("fill")
    }
  })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toText(canvas))
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // Clipboard is unavailable over plain http; download still works.
    }
  }

  const download = () => {
    const blob = new Blob([toText(canvas)], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "sketch.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  const swatchStyle = (active: boolean): React.CSSProperties => ({
    font: "inherit",
    fontSize: 13,
    width: 26,
    height: 26,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    background: active ? "var(--accent-wash)" : "var(--cell-shown)",
    border: `1px solid ${active ? "var(--accent)" : "var(--win-border)"}`,
  })

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Tools */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          padding: "8px 12px",
          borderBottom: "1px solid var(--win-rule)",
        }}
      >
        {(["draw", "erase", "fill"] as Tool[]).map((t) => (
          <button
            key={t}
            type="button"
            className="seg"
            data-active={tool === t ? "" : undefined}
            onClick={() => setTool(t)}
          >
            {t}
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: "var(--win-rule)" }} />
        <button type="button" className="seg" onClick={undo}>
          undo
        </button>
        <button
          type="button"
          className="seg"
          onClick={() => {
            pushUndo(canvas)
            setCanvas(clear(canvas))
          }}
        >
          clear
        </button>
        <span style={{ flex: "1 1 auto" }} />
        <button
          type="button"
          className="seg"
          onClick={copy}
          disabled={isBlank(canvas)}
        >
          {copied ? "copied" : "copy text"}
        </button>
        <button
          type="button"
          className="seg"
          onClick={download}
          disabled={isBlank(canvas)}
        >
          .txt
        </button>
      </div>

      {/* Character and colour palettes */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          padding: "8px 12px",
          borderBottom: "1px solid var(--win-rule)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {(BRUSHES.trim() + BOX).split("").map((ch) => (
            <button
              key={ch}
              type="button"
              aria-label={`brush ${ch}`}
              onClick={() => {
                setBrush(ch)
                setTool("draw")
              }}
              style={swatchStyle(brush === ch && tool !== "erase")}
            >
              {ch}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {PALETTE.map((c, i) => (
            <button
              key={c}
              type="button"
              aria-label={`colour ${i}`}
              onClick={() => setColor(i)}
              style={{
                ...swatchStyle(color === i),
                background: c,
                borderWidth: color === i ? 2 : 1,
              }}
            />
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "auto",
          display: "grid",
          placeItems: "center",
          padding: 10,
        }}
      >
        <div
          ref={gridRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
          style={{
            width: COLS * CELL_W,
            height: ROWS * CELL_H,
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, ${CELL_W}px)`,
            gridAutoRows: `${CELL_H}px`,
            background: "var(--cell-shown)",
            border: "1px solid var(--win-border)",
            cursor: "crosshair",
            touchAction: "none",
            userSelect: "none",
            lineHeight: `${CELL_H}px`,
            fontSize: 13,
          }}
        >
          {canvas.cells.map((cell, i) => (
            <span
              key={i}
              style={{
                textAlign: "center",
                color: cell.color >= 0 ? PALETTE[cell.color] : "var(--ink)",
              }}
            >
              {cell.ch === " " ? "" : cell.ch}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: "6px 12px",
          borderTop: "1px solid var(--win-rule)",
          color: "var(--ink-faint)",
          fontSize: 12,
          textAlign: "center",
        }}
      >
        {isMobile
          ? "drag to draw · pick a character above"
          : "drag to draw · b draw · e erase · g fill · ctrl+z undo"}
      </div>
    </div>
  )
}

export { idx }
