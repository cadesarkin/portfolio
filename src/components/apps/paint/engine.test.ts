import { describe, it, expect } from "vitest"
import {
  createCanvas,
  paint,
  line,
  fill,
  clear,
  toText,
  isBlank,
  idx,
} from "./engine"

const at = (c: ReturnType<typeof createCanvas>, x: number, y: number) =>
  c.cells[idx(c, x, y)]

describe("createCanvas", () => {
  it("starts blank at the requested size", () => {
    const c = createCanvas(10, 4)
    expect(c.cells).toHaveLength(40)
    expect(isBlank(c)).toBe(true)
  })
})

describe("paint", () => {
  it("sets a cell", () => {
    const c = paint(createCanvas(8, 4), 2, 1, "#", 3)
    expect(at(c, 2, 1)).toEqual({ ch: "#", color: 3 })
  })

  it("ignores coordinates outside the canvas", () => {
    const c = createCanvas(8, 4)
    expect(paint(c, -1, 0, "#", 0)).toBe(c)
    expect(paint(c, 0, 9, "#", 0)).toBe(c)
    expect(paint(c, 8, 0, "#", 0)).toBe(c)
  })

  it("returns the same canvas when nothing would change", () => {
    const c = paint(createCanvas(8, 4), 1, 1, "#", 2)
    expect(paint(c, 1, 1, "#", 2)).toBe(c)
  })

  it("does not mutate the original", () => {
    const before = createCanvas(8, 4)
    paint(before, 1, 1, "#", 0)
    expect(isBlank(before)).toBe(true)
  })
})

describe("line", () => {
  it("draws a continuous horizontal run", () => {
    const c = line(createCanvas(10, 3), 1, 1, 5, 1, "-", 0)
    for (let x = 1; x <= 5; x++) expect(at(c, x, 1).ch).toBe("-")
    expect(at(c, 6, 1).ch).toBe(" ")
  })

  it("draws a continuous vertical run", () => {
    const c = line(createCanvas(4, 8), 2, 0, 2, 5, "|", 0)
    for (let y = 0; y <= 5; y++) expect(at(c, 2, y).ch).toBe("|")
  })

  /** The gap this prevents: a fast drag samples far-apart points. */
  it("leaves no gaps on a diagonal", () => {
    const c = line(createCanvas(12, 12), 0, 0, 9, 9, "*", 0)
    for (let i = 0; i <= 9; i++) expect(at(c, i, i).ch).toBe("*")
  })

  it("handles a line drawn backwards", () => {
    const c = line(createCanvas(10, 3), 7, 1, 3, 1, "-", 0)
    for (let x = 3; x <= 7; x++) expect(at(c, x, 1).ch).toBe("-")
  })

  it("draws a single cell when start equals end", () => {
    const c = line(createCanvas(6, 3), 2, 1, 2, 1, "o", 0)
    expect(at(c, 2, 1).ch).toBe("o")
  })

  it("clips to the canvas without throwing", () => {
    expect(() => line(createCanvas(6, 3), -4, -4, 20, 20, "x", 0)).not.toThrow()
  })
})

describe("fill", () => {
  it("fills a whole blank canvas", () => {
    const c = fill(createCanvas(6, 4), 0, 0, "#", 1)
    expect(c.cells.every((cell) => cell.ch === "#")).toBe(true)
  })

  it("stops at a boundary of different characters", () => {
    // A vertical wall down the middle splits the canvas in two.
    let c = createCanvas(7, 3)
    for (let y = 0; y < 3; y++) c = paint(c, 3, y, "|", 0)
    c = fill(c, 0, 0, ".", 0)
    expect(at(c, 0, 0).ch).toBe(".")
    expect(at(c, 2, 2).ch).toBe(".")
    expect(at(c, 3, 1).ch).toBe("|")
    expect(at(c, 4, 0).ch).toBe(" ")
  })

  it("does nothing when the target already matches", () => {
    const c = createCanvas(5, 3)
    expect(fill(c, 0, 0, " ", -1)).toBe(c)
  })

  it("ignores an out-of-bounds origin", () => {
    const c = createCanvas(5, 3)
    expect(fill(c, 9, 9, "#", 0)).toBe(c)
  })

  /** A recursive fill overflows the stack at this size. */
  it("fills a large canvas without blowing the stack", () => {
    const c = fill(createCanvas(160, 90), 0, 0, "#", 0)
    expect(c.cells.every((cell) => cell.ch === "#")).toBe(true)
  })
})

describe("toText", () => {
  it("renders rows as lines", () => {
    let c = createCanvas(5, 2)
    c = paint(c, 0, 0, "a", 0)
    c = paint(c, 1, 0, "b", 0)
    c = paint(c, 0, 1, "c", 0)
    expect(toText(c)).toBe("ab\nc")
  })

  it("trims trailing blanks from each row", () => {
    const c = paint(createCanvas(10, 1), 0, 0, "x", 0)
    expect(toText(c)).toBe("x")
  })

  it("drops trailing blank rows", () => {
    const c = paint(createCanvas(6, 8), 0, 0, "x", 0)
    expect(toText(c).split("\n")).toHaveLength(1)
  })

  it("keeps interior blank rows", () => {
    let c = createCanvas(6, 4)
    c = paint(c, 0, 0, "x", 0)
    c = paint(c, 0, 2, "y", 0)
    expect(toText(c)).toBe("x\n\ny")
  })

  it("returns an empty string for a blank canvas", () => {
    expect(toText(createCanvas(8, 4))).toBe("")
  })
})

describe("clear", () => {
  it("returns a blank canvas of the same size", () => {
    const c = clear(paint(createCanvas(9, 5), 2, 2, "#", 1))
    expect(c.w).toBe(9)
    expect(c.h).toBe(5)
    expect(isBlank(c)).toBe(true)
  })
})
