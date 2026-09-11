import { describe, it, expect } from "vitest"
import { cropBy, type Crop } from "./window-crop"
import type { WinGrid } from "./window-reducer"

const grid: WinGrid = {
  cw: 10,
  ch: 20,
  cols: 10,
  rows: 6,
  max: { cols: 20, rows: 10 },
  min: { cols: 6, rows: 2 },
}
const whole: Crop = { ox: 0, oy: 0, cols: 20, rows: 10 }
const middle: Crop = { ox: 4, oy: 2, cols: 10, rows: 6 }

describe("cropping from an edge", () => {
  it("cuts from the left by moving the crop, not the content", () => {
    expect(cropBy(grid, whole, "w", 3, 0)).toEqual({ ox: 3, oy: 0, cols: 17, rows: 10 })
  })

  it("cuts from the right by narrowing alone", () => {
    expect(cropBy(grid, whole, "e", -5, 0)).toEqual({ ox: 0, oy: 0, cols: 15, rows: 10 })
  })

  it("cuts from the top and bottom the same way", () => {
    expect(cropBy(grid, whole, "n", 0, 2)).toEqual({ ox: 0, oy: 2, cols: 20, rows: 8 })
    expect(cropBy(grid, whole, "s", 0, -3)).toEqual({ ox: 0, oy: 0, cols: 20, rows: 7 })
  })

  it("moves both edges a corner touches", () => {
    expect(cropBy(grid, middle, "nw", -2, -1)).toEqual({ ox: 2, oy: 1, cols: 12, rows: 7 })
    expect(cropBy(grid, middle, "se", 2, 1)).toEqual({ ox: 4, oy: 2, cols: 12, rows: 7 })
  })

  it("uncovers no further than the content goes", () => {
    expect(cropBy(grid, middle, "w", -99, 0)).toEqual({ ox: 0, oy: 2, cols: 14, rows: 6 })
    expect(cropBy(grid, middle, "e", 99, 0)).toEqual({ ox: 4, oy: 2, cols: 16, rows: 6 })
    expect(cropBy(grid, middle, "n", 0, -99)).toEqual({ ox: 4, oy: 0, cols: 10, rows: 8 })
    expect(cropBy(grid, middle, "s", 0, 99)).toEqual({ ox: 4, oy: 2, cols: 10, rows: 8 })
  })

  it("cuts no smaller than the minimum", () => {
    expect(cropBy(grid, middle, "w", 99, 0)).toEqual({ ox: 8, oy: 2, cols: 6, rows: 6 })
    expect(cropBy(grid, middle, "e", -99, 0)).toEqual({ ox: 4, oy: 2, cols: 6, rows: 6 })
    expect(cropBy(grid, middle, "n", 0, 99)).toEqual({ ox: 4, oy: 6, cols: 10, rows: 2 })
  })

  it("never cuts out the cell it has to keep", () => {
    const keep = { ...grid, keep: { x: 6, y: 3 } }
    expect(cropBy(keep, middle, "w", 5, 0).ox).toBe(6)
    expect(cropBy(keep, middle, "e", -8, 0)).toMatchObject({ ox: 4, cols: 6 })
    expect(cropBy(keep, middle, "n", 0, 3).oy).toBe(3)
    const low = { ...grid, keep: { x: 6, y: 7 } }
    expect(cropBy(low, middle, "s", 0, -4).rows).toBe(6)
  })
})
