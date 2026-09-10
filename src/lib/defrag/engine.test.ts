import { describe, it, expect } from "vitest"
import {
  CELL_W,
  CELL_H,
  CHROME,
  parseFragment,
  placementAt,
  topAt,
  step,
  links,
  type Placement,
  type Player,
  type Viewport,
} from "./engine"

const VIEW: Viewport = { w: 1280, h: 720 }

/** A fragment window whose body starts at a grid cell. */
const at = (
  id: string,
  frag: ReturnType<typeof parseFragment>,
  col: number,
  row: number,
  z = 1
): Placement => placementAt(id, frag, col, row, z)

/* Two rooms that meet on a shared edge at row 1. */
const LEFT = parseFragment("left", ["#####", "#@...", "#####"])
const RIGHT = parseFragment("right", ["#####", "...>#", "#####"])
const frags = { left: LEFT, right: RIGHT }

describe("parsing a fragment", () => {
  it("finds its size", () => {
    expect(LEFT.cols).toBe(5)
    expect(LEFT.rows).toBe(3)
  })

  it("finds the start and the exit, and treats both as floor", () => {
    expect(LEFT.start).toEqual({ x: 1, y: 1 })
    expect(RIGHT.exit).toEqual({ x: 3, y: 1 })
    expect(LEFT.walkable(1, 1)).toBe(true)
    expect(RIGHT.walkable(3, 1)).toBe(true)
  })

  it("does not walk on walls, void, or outside the room", () => {
    const f = parseFragment("f", ["#. ", "..."])
    expect(f.walkable(0, 0)).toBe(false)
    expect(f.walkable(2, 0)).toBe(false)
    expect(f.walkable(9, 9)).toBe(false)
    expect(f.walkable(-1, 0)).toBe(false)
  })

  /** Ragged rows would make the right edge ambiguous. */
  it("rejects rows of different lengths", () => {
    expect(() => parseFragment("bad", ["###", "##"])).toThrow()
  })

  it("lists the floor tiles on its edges as ports", () => {
    expect(LEFT.ports).toEqual([{ x: 4, y: 1, dir: "right" }])
    expect(RIGHT.ports).toEqual([{ x: 0, y: 1, dir: "left" }])
  })
})

describe("placing a fragment window", () => {
  it("puts the body on the grid", () => {
    const p = at("a", LEFT, 3, 4)
    expect(p.body).toEqual({ x: 3 * CELL_W, y: 4 * CELL_H, w: 5 * CELL_W, h: 3 * CELL_H })
  })

  it("wraps the body in the window chrome", () => {
    const p = at("a", LEFT, 3, 4)
    expect(p.outer.x).toBe(p.body.x - CHROME.left)
    expect(p.outer.y).toBe(p.body.y - CHROME.top)
    expect(p.outer.w).toBe(p.body.w + CHROME.left + CHROME.right)
  })
})

describe("what is on top", () => {
  it("finds the highest window covering a point", () => {
    const low = at("low", LEFT, 0, 4, 1)
    const high = at("high", RIGHT, 0, 4, 2)
    expect(topAt([low, high], 10, 4 * CELL_H + 8)?.id).toBe("high")
  })

  it("finds nothing over bare desktop", () => {
    expect(topAt([at("a", LEFT, 0, 4)], 900, 600)).toBeUndefined()
  })
})

const player = (frag: string, x: number, y: number): Player => ({ frag, x, y })

describe("walking inside a room", () => {
  const layout = [at("left", LEFT, 2, 4), at("right", RIGHT, 30, 4)]

  it("moves onto floor", () => {
    const r = step(player("left", 1, 1), "right", layout, frags, VIEW)
    expect(r.player).toEqual(player("left", 2, 1))
    expect(r.moved).toBe(true)
  })

  it("stops at a wall", () => {
    const r = step(player("left", 1, 1), "up", layout, frags, VIEW)
    expect(r.moved).toBe(false)
    expect(r.blocked).toBe("wall")
  })
})

describe("crossing between windows", () => {
  /* Left's port is its tile (4,1); right's is (0,1). Put right's body one
     column past left's, on the same row, and the two rooms meet. */
  const joined = [at("left", LEFT, 2, 4), at("right", RIGHT, 7, 4)]

  it("crosses where the rooms line up", () => {
    const r = step(player("left", 4, 1), "right", joined, frags, VIEW)
    expect(r.player).toEqual(player("right", 0, 1))
  })

  it("does not cross when the rows are off by one", () => {
    const off = [at("left", LEFT, 2, 4), at("right", RIGHT, 7, 5)]
    const r = step(player("left", 4, 1), "right", off, frags, VIEW)
    expect(r.moved).toBe(false)
    expect(r.blocked).toBe("wall")
  })

  it("does not cross a gap", () => {
    const gap = [at("left", LEFT, 2, 4), at("right", RIGHT, 8, 4)]
    const r = step(player("left", 4, 1), "right", gap, frags, VIEW)
    expect(r.moved).toBe(false)
    expect(r.blocked).toBe("void")
  })

  it("crosses back the other way", () => {
    const r = step(player("right", 0, 1), "left", joined, frags, VIEW)
    expect(r.player).toEqual(player("left", 4, 1))
  })

  it("reports reaching the exit", () => {
    let p = player("left", 4, 1)
    let last = step(p, "right", joined, frags, VIEW)
    for (let i = 0; i < 3; i++) {
      expect(last.won).toBe(false)
      p = last.player
      last = step(p, "right", joined, frags, VIEW)
    }
    expect(last.player).toEqual(player("right", 3, 1))
    expect(last.won).toBe(true)
  })
})

describe("you can only walk where you can see", () => {
  it("will not step onto a tile another room covers", () => {
    const cover = parseFragment("cover", ["#####", "#####", "#####"])
    const layout = [
      at("left", LEFT, 2, 4, 1),
      at("right", RIGHT, 7, 4, 1),
      at("cover", cover, 6, 4, 5),
    ]
    const r = step(player("left", 3, 1), "right", layout, { ...frags, cover }, VIEW)
    expect(r.moved).toBe(false)
    expect(r.blocked).toBe("hidden")
  })

  /* Rooms join only edge to edge. If overlapping floor joined them, every
     level could be skipped by dropping the exit room on the start room. */
  it("does not walk into a room lying over this one, even onto floor", () => {
    const cover = parseFragment("cover", ["#####", ".....", "#####"])
    const layout = [at("left", LEFT, 2, 4, 1), at("cover", cover, 6, 4, 5)]
    const r = step(player("left", 3, 1), "right", layout, { ...frags, cover }, VIEW)
    expect(r.moved).toBe(false)
    expect(r.blocked).toBe("hidden")
  })

  it("does not walk into the middle of a room lying across the path", () => {
    const across = parseFragment("across", [".........", ".........", "........."])
    // Placed so the cell just past the port is its column 2: floor, but not
    // an edge, so the step hits the side of the room rather than entering it.
    const layout = [at("left", LEFT, 2, 4, 1), at("across", across, 5, 4, 2)]
    const r = step(player("left", 4, 1), "right", layout, { ...frags, across }, VIEW)
    expect(r.moved).toBe(false)
  })

  it("will not step under a title bar", () => {
    const cover = parseFragment("cover", [".....", ".....", "....."])
    // One row lower: the cover's title bar lies across the left room's row 1.
    const layout = [at("left", LEFT, 2, 4, 1), at("cover", cover, 6, 6, 5)]
    const r = step(player("left", 3, 1), "right", layout, { ...frags, cover }, VIEW)
    expect(r.moved).toBe(false)
    expect(r.blocked).toBe("hidden")
  })

  it("counts an ordinary window as cover too", () => {
    const terminal: Placement = {
      id: "/terminal",
      outer: { x: 7 * CELL_W - 1, y: 0, w: 200, h: 400 },
      body: { x: 7 * CELL_W, y: 34, w: 198, h: 365 },
      z: 9,
    }
    const layout = [at("left", LEFT, 2, 4), at("right", RIGHT, 7, 4), terminal]
    const r = step(player("left", 4, 1), "right", layout, frags, VIEW)
    expect(r.blocked).toBe("hidden")
  })

  it("will not step off the bottom of the screen", () => {
    const low = [at("left", LEFT, 2, 43)]
    const f = parseFragment("left", ["#####", "#@...", "#.###"])
    const r = step(player("left", 1, 1), "down", low, { left: f }, VIEW)
    expect(r.moved).toBe(false)
  })
})

describe("crossing vertically", () => {
  /* A window's title bar sits above its room, so a room directly below
     another has its title bar tucked under the upper room. Walking down
     only works if the upper window is on top. */
  const UPPER = parseFragment("upper", ["#####", "#@..#", "##.##"])
  const LOWER = parseFragment("lower", ["##.##", "#..>#", "#####"])
  const both = { upper: UPPER, lower: LOWER }

  it("crosses down when the upper window is on top", () => {
    const layout = [at("upper", UPPER, 4, 4, 2), at("lower", LOWER, 4, 7, 1)]
    const r = step(player("upper", 2, 2), "down", layout, both, VIEW)
    expect(r.player).toEqual(player("lower", 2, 0))
  })

  it("is blocked when the lower window's title bar covers the way", () => {
    const layout = [at("upper", UPPER, 4, 4, 1), at("lower", LOWER, 4, 7, 2)]
    // The upper room's bottom row is under the lower window's title bar.
    const r = step(player("upper", 2, 1), "down", layout, both, VIEW)
    expect(r.moved).toBe(false)
    expect(r.blocked).toBe("hidden")
  })
})

describe("links", () => {
  it("lights a port that meets floor in another room", () => {
    const joined = [at("left", LEFT, 2, 4), at("right", RIGHT, 7, 4)]
    expect(links("left", joined, frags, VIEW)).toEqual(["4,1"])
    expect(links("right", joined, frags, VIEW)).toEqual(["0,1"])
  })

  it("lights nothing when the rooms are apart", () => {
    const apart = [at("left", LEFT, 2, 4), at("right", RIGHT, 30, 4)]
    expect(links("left", apart, frags, VIEW)).toEqual([])
  })
})
