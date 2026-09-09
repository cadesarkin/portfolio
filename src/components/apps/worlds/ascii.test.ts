import { describe, it, expect } from "vitest"
import { Grid, ramp } from "./ascii"

describe("Grid", () => {
  it("starts blank", () => {
    expect(new Grid(3, 2).toString()).toBe("   \n   ")
  })

  it("writes and reads a cell", () => {
    const g = new Grid(4, 2)
    g.put(1, 1, "#", "red")
    expect(g.at(1, 1)).toEqual({ ch: "#", color: "red" })
  })

  it("rounds fractional positions to the nearest cell", () => {
    const g = new Grid(4, 2)
    g.put(1.6, 0.4, "#", "red")
    expect(g.at(2, 0).ch).toBe("#")
  })

  /** Clamping would smear anything off-screen along the edge. */
  it("drops out-of-bounds writes rather than clamping them", () => {
    const g = new Grid(3, 2)
    g.put(-1, 0, "#", "red")
    g.put(9, 0, "#", "red")
    g.put(0, -4, "#", "red")
    expect(g.toString()).toBe("   \n   ")
  })

  it("writes text left to right", () => {
    const g = new Grid(6, 1)
    g.text(1, 0, "abc", "red")
    expect(g.toString()).toBe(" abc  ")
  })

  it("clips text at the edge instead of wrapping", () => {
    const g = new Grid(4, 2)
    g.text(2, 0, "abcdef", "red")
    expect(g.toString()).toBe("  ab\n    ")
  })

  it("clears back to blank", () => {
    const g = new Grid(3, 1)
    g.text(0, 0, "abc", "red")
    g.clear()
    expect(g.toString()).toBe("   ")
    expect(g.at(0, 0).color).toBe("")
  })
})

describe("Grid.sprite", () => {
  it("stamps multi-line art", () => {
    const g = new Grid(5, 3)
    g.sprite(1, 0, ["ab", "cd"], "red")
    expect(g.toString()).toBe(" ab  \n cd  \n     ")
  })

  /** A sprite is a shape, not a rectangle: spaces must show what is behind. */
  it("leaves spaces in the art transparent", () => {
    const g = new Grid(4, 2)
    g.text(0, 0, "####", "red")
    g.sprite(0, 0, ["a a"], "blue")
    expect(g.toString()).toBe("a#a#\n    ")
    expect(g.at(1, 0).color).toBe("red")
  })
})

describe("Grid.line", () => {
  it("draws a horizontal run", () => {
    const g = new Grid(5, 1)
    g.line(0, 0, 4, 0, "-", "red")
    expect(g.toString()).toBe("-----")
  })

  it("draws a vertical run", () => {
    const g = new Grid(1, 3)
    g.line(0, 0, 0, 2, "|", "red")
    expect(g.toString()).toBe("|\n|\n|")
  })

  it("draws a diagonal", () => {
    const g = new Grid(3, 3)
    g.line(0, 0, 2, 2, "\\", "red")
    expect(g.toString()).toBe("\\  \n \\ \n  \\")
  })

  it("draws the same cells in either direction", () => {
    const a = new Grid(6, 4)
    const b = new Grid(6, 4)
    a.line(0, 0, 5, 3, "*", "red")
    b.line(5, 3, 0, 0, "*", "red")
    expect(a.toString()).toBe(b.toString())
  })

  /** An endpoint far outside the grid must not hang the frame. */
  it("terminates when the line runs off the grid", () => {
    const g = new Grid(4, 4)
    g.line(0, 0, 100000, 3, "*", "red")
    expect(g.at(3, 0).ch).toBe("*")
  })
})

describe("Grid.column", () => {
  it("fills between two rows inclusive", () => {
    const g = new Grid(1, 4)
    g.column(0, 1, 2, "#", "red")
    expect(g.toString()).toBe(" \n#\n#\n ")
  })

  it("accepts the bounds in either order", () => {
    const g = new Grid(1, 4)
    g.column(0, 3, 1, "#", "red")
    expect(g.toString()).toBe(" \n#\n#\n#")
  })

  it("clips to the grid", () => {
    const g = new Grid(1, 3)
    g.column(0, -5, 99, "#", "red")
    expect(g.toString()).toBe("#\n#\n#")
  })
})

describe("ramp", () => {
  it("maps the ends of the range to the ends of the ramp", () => {
    expect(ramp(" .:-=+*#", 0)).toBe(" ")
    expect(ramp(" .:-=+*#", 1)).toBe("#")
  })

  it("clamps out-of-range values", () => {
    expect(ramp(" .:#", -3)).toBe(" ")
    expect(ramp(" .:#", 7)).toBe("#")
  })

  it("picks a middle glyph in between", () => {
    expect(ramp("abcde", 0.5)).toBe("c")
  })
})
