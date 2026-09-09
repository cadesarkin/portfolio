/** ASCII canvas model. Pure — no DOM, no React. */

export interface Cell {
  ch: string
  /** Index into the palette, or -1 for the default ink. */
  color: number
}

export interface Canvas {
  w: number
  h: number
  cells: Cell[]
}

const BLANK: Cell = { ch: " ", color: -1 }

/** Ink colours. Index 0 is "default", which follows the theme. */
export const PALETTE = [
  "var(--ink)",
  "#1d6fd0",
  "#2c7a3f",
  "#c0392b",
  "#a8631f",
  "#5b3fa8",
  "#158b8b",
  "#d4a017",
]

/**
 * Brushes, ordered light to heavy.
 *
 * The same ramp the wallpaper uses, so a drawing made here sits in the same
 * visual language as the desktop behind it.
 */
export const BRUSHES = " .,:;irsXA253hMHGS#9B&@"
export const BOX = "|-+/\\_<>^v*o=[]()"

export const idx = (c: { w: number }, x: number, y: number) => y * c.w + x

export function createCanvas(w = 64, h = 28): Canvas {
  return { w, h, cells: Array.from({ length: w * h }, () => ({ ...BLANK })) }
}

function inBounds(c: Canvas, x: number, y: number) {
  return x >= 0 && y >= 0 && x < c.w && y < c.h
}

export function paint(
  canvas: Canvas,
  x: number,
  y: number,
  ch: string,
  color: number
): Canvas {
  if (!inBounds(canvas, x, y)) return canvas
  const i = idx(canvas, x, y)
  const cur = canvas.cells[i]
  if (cur.ch === ch && cur.color === color) return canvas

  const cells = canvas.cells.slice()
  cells[i] = { ch, color }
  return { ...canvas, cells }
}

/**
 * Bresenham line, so a fast drag does not leave gaps.
 *
 * Pointer events fire far apart during a quick stroke; painting only the
 * sampled points draws a dotted line rather than a continuous one.
 */
export function line(
  canvas: Canvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ch: string,
  color: number
): Canvas {
  let next = canvas
  let x = x0
  let y = y0
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy

  for (;;) {
    next = paint(next, x, y, ch, color)
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
  return next
}

/**
 * Flood fill over cells matching the origin's character.
 *
 * Iterative: a fill across a large empty canvas visits every cell, which is
 * enough to overflow a recursive implementation.
 */
export function fill(
  canvas: Canvas,
  x: number,
  y: number,
  ch: string,
  color: number
): Canvas {
  if (!inBounds(canvas, x, y)) return canvas
  const start = canvas.cells[idx(canvas, x, y)]
  if (start.ch === ch && start.color === color) return canvas

  const cells = canvas.cells.slice()
  const stack = [[x, y] as const]
  const seen = new Set<number>()

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!
    if (!inBounds(canvas, cx, cy)) continue
    const i = idx(canvas, cx, cy)
    if (seen.has(i)) continue
    if (cells[i].ch !== start.ch) continue
    seen.add(i)
    cells[i] = { ch, color }
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
  }

  return { ...canvas, cells }
}

export function clear(canvas: Canvas): Canvas {
  return createCanvas(canvas.w, canvas.h)
}

/** The drawing as plain text, with trailing blanks trimmed off each row. */
export function toText(canvas: Canvas): string {
  const rows: string[] = []
  for (let y = 0; y < canvas.h; y++) {
    let row = ""
    for (let x = 0; x < canvas.w; x++) row += canvas.cells[idx(canvas, x, y)].ch
    rows.push(row.replace(/\s+$/, ""))
  }
  // Drop trailing blank lines too, so a small sketch does not export a page
  // of empty rows.
  while (rows.length > 0 && rows[rows.length - 1] === "") rows.pop()
  return rows.join("\n")
}

export function isBlank(canvas: Canvas): boolean {
  return canvas.cells.every((c) => c.ch === " ")
}
