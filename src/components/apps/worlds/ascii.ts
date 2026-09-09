/**
 * A character grid to draw into.
 *
 * The worlds were first drawn with gradients and filled paths, which looked
 * nothing like the rest of the desktop. Everything visible here is a glyph in a
 * fixed grid, so a world program renders in the same language as the wallpaper
 * behind it.
 *
 * The buffer is pure — no canvas is touched until `render`, and every drawing
 * method is testable on its own.
 */

export interface Metrics {
  cols: number
  rows: number
  /** Character advance, in CSS pixels. */
  cw: number
  /** Line height, in CSS pixels. */
  ch: number
  font: string
}

const FAMILY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

/**
 * Sizes a grid to a box.
 *
 * The advance is measured rather than assumed: monospace metrics vary between
 * platforms, and guessing leaves either gaps or overlap in a solid fill.
 */
export function measure(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fontSize: number
): Metrics {
  const font = `${fontSize}px ${FAMILY}`
  ctx.font = font
  const cw = ctx.measureText("M").width || fontSize * 0.6
  const ch = Math.max(1, Math.round(fontSize * 1.06))
  return {
    cols: Math.max(1, Math.ceil(width / cw)),
    rows: Math.max(1, Math.ceil(height / ch)),
    cw,
    ch,
    font,
  }
}

/** Picks a glyph from a ramp, dark to light. */
export function ramp(chars: string, t: number): string {
  const k = t < 0 ? 0 : t > 1 ? 1 : t
  return chars.charAt(Math.round(k * (chars.length - 1)))
}

export class Grid {
  readonly cols: number
  readonly rows: number
  private readonly chars: string[]
  private readonly colors: string[]
  private readonly backs: string[]

  constructor(cols: number, rows: number) {
    this.cols = Math.max(0, Math.floor(cols))
    this.rows = Math.max(0, Math.floor(rows))
    const n = this.cols * this.rows
    this.chars = new Array<string>(n).fill(" ")
    this.colors = new Array<string>(n).fill("")
    this.backs = new Array<string>(n).fill("")
  }

  clear(): void {
    this.chars.fill(" ")
    this.colors.fill("")
    this.backs.fill("")
  }

  inside(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows
  }

  /** Writes one cell. Out-of-bounds writes are dropped, not clamped. */
  put(c: number, r: number, ch: string, color: string): void {
    const x = Math.round(c)
    const y = Math.round(r)
    if (!this.inside(x, y) || ch === "") return
    const i = y * this.cols + x
    this.chars[i] = ch
    this.colors[i] = color
  }

  /**
   * Sets a cell's background.
   *
   * Colour lives behind the glyphs rather than in a gradient painted under the
   * whole grid: a wash is a smooth shape, and a smooth shape in the middle of a
   * character scene reads as a different picture pasted in. Filling cells keeps
   * every edge on the grid.
   */
  back(c: number, r: number, color: string): void {
    const x = Math.round(c)
    const y = Math.round(r)
    if (!this.inside(x, y)) return
    this.backs[y * this.cols + x] = color
  }

  /** Fills a run of backgrounds in one row, clipped to the grid. */
  backRow(r: number, from: number, to: number, color: string): void {
    const lo = Math.max(0, Math.round(Math.min(from, to)))
    const hi = Math.min(this.cols - 1, Math.round(Math.max(from, to)))
    for (let c = lo; c <= hi; c++) this.back(c, r, color)
  }

  at(c: number, r: number): { ch: string; color: string; bg: string } {
    if (!this.inside(c, r)) return { ch: " ", color: "", bg: "" }
    const i = r * this.cols + c
    return { ch: this.chars[i], color: this.colors[i], bg: this.backs[i] }
  }

  text(c: number, r: number, s: string, color: string): void {
    for (let i = 0; i < s.length; i++) this.put(c + i, r, s[i], color)
  }

  /**
   * Stamps multi-line art, with spaces left transparent so a sprite does not
   * punch a rectangular hole in whatever it is standing on.
   */
  sprite(c: number, r: number, art: string[], color: string): void {
    for (let y = 0; y < art.length; y++) {
      const line = art[y]
      for (let x = 0; x < line.length; x++) {
        if (line[x] === " ") continue
        this.put(c + x, r + y, line[x], color)
      }
    }
  }

  /** A filled column span, used for bars and for solid terrain. */
  column(c: number, from: number, to: number, ch: string, color: string): void {
    const lo = Math.max(0, Math.round(Math.min(from, to)))
    const hi = Math.min(this.rows - 1, Math.round(Math.max(from, to)))
    for (let r = lo; r <= hi; r++) this.put(c, r, ch, color)
  }

  /** Bresenham, for trajectories and aiming guides. */
  line(c0: number, r0: number, c1: number, r1: number, ch: string, color: string): void {
    let x = Math.round(c0)
    let y = Math.round(r0)
    const x1 = Math.round(c1)
    const y1 = Math.round(r1)
    const dx = Math.abs(x1 - x)
    const dy = -Math.abs(y1 - y)
    const sx = x < x1 ? 1 : -1
    const sy = y < y1 ? 1 : -1
    let err = dx + dy
    // Bounded so a wild endpoint cannot spin here forever.
    for (let guard = 0; guard < 4096; guard++) {
      this.put(x, y, ch, color)
      if (x === x1 && y === y1) return
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
  }

  /** The grid as text, one row per line. For tests and for debugging. */
  toString(): string {
    const out: string[] = []
    for (let r = 0; r < this.rows; r++) {
      out.push(this.chars.slice(r * this.cols, (r + 1) * this.cols).join(""))
    }
    return out.join("\n")
  }

  /**
   * Paints the buffer.
   *
   * Runs of one colour are drawn as a single fillText: setting fillStyle per
   * cell is the expensive part of a grid this size, and a row of terrain is
   * usually one colour for many cells at a stretch.
   */
  render(ctx: CanvasRenderingContext2D, m: Metrics): void {
    ctx.font = m.font
    ctx.textBaseline = "top"
    for (let r = 0; r < this.rows; r++) {
      const y = r * m.ch
      const base = r * this.cols

      // Backgrounds first, as run-length spans, so a blank cell reads as sky
      // or soil rather than as a hole. The +1s close the seams between spans.
      let c = 0
      while (c < this.cols) {
        const bg = this.backs[base + c]
        let end = c + 1
        while (end < this.cols && this.backs[base + end] === bg) end++
        if (bg !== "") {
          ctx.fillStyle = bg
          ctx.fillRect(c * m.cw, y, (end - c) * m.cw + 1, m.ch + 1)
        }
        c = end
      }

      // Then the glyphs, batched into same-colour runs.
      let run = ""
      let runStart = 0
      let runColor = ""
      const flush = () => {
        if (run.trim() !== "") {
          ctx.fillStyle = runColor
          ctx.fillText(run, runStart * m.cw, y)
        }
        run = ""
      }
      for (let gc = 0; gc < this.cols; gc++) {
        const ch = this.chars[base + gc]
        const color = this.colors[base + gc]
        if (ch === " ") {
          flush()
          continue
        }
        if (run === "" || color !== runColor) {
          flush()
          runStart = gc
          runColor = color
        }
        run += ch
      }
      flush()
    }
  }
}

/** Sizes the backing store for the device, returning the CSS box. */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  rect: { width: number; height: number }
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.floor(rect.width * dpr))
  const h = Math.max(1, Math.floor(rect.height * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
