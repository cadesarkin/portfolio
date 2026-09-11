import { describe, it, expect } from "vitest"
import {
  CELL_W,
  CELL_H,
  CHROME,
  applyEvents,
  edgeTiles,
  links,
  newWorld,
  parseFragment,
  passable,
  placementAt,
  step,
  tileAt,
  topAt,
  type Placement,
  type Player,
  type Viewport,
  type World,
} from "./engine"

const VIEW: Viewport = { w: 1280, h: 720 }
const W0 = newWorld()

const at = (
  id: string,
  frag: ReturnType<typeof parseFragment>,
  col: number,
  row: number,
  z = 1,
  view?: { ox: number; oy: number; cols: number; rows: number }
): Placement => placementAt(id, frag, col, row, z, view)

/* Two rooms that meet on a shared edge at row 1. */
const LEFT = parseFragment("left", ["#####", "#@...", "#####"])
const RIGHT = parseFragment("right", ["#####", "...>#", "#####"])
const frags = { left: LEFT, right: RIGHT }
const player = (frag: string, x: number, y: number): Player => ({ frag, x, y })
const go = (
  p: Player,
  dir: "up" | "down" | "left" | "right",
  layout: Placement[],
  fs = frags as Record<string, ReturnType<typeof parseFragment>>,
  world: World = W0
) => step(p, dir, layout, fs, VIEW, world)

describe("parsing a room", () => {
  it("finds its size, its start and its exit", () => {
    expect(LEFT.cols).toBe(5)
    expect(LEFT.rows).toBe(3)
    expect(LEFT.start).toEqual({ x: 1, y: 1 })
    expect(RIGHT.exit).toEqual({ x: 3, y: 1 })
  })

  it("treats the start as floor", () => {
    expect(tileAt(LEFT, 1, 1, W0)).toBe(".")
  })

  /** Ragged rows would make the right edge ambiguous. */
  it("rejects rows of different lengths", () => {
    expect(() => parseFragment("bad", ["###", "##"])).toThrow()
  })
})

describe("what can be stood on", () => {
  const f = parseFragment("f", ["#. $%^?+=>"])
  it("walls, void and outside are not", () => {
    expect(passable(f, 0, 0, W0)).toBe(false)
    expect(passable(f, 2, 0, W0)).toBe(false)
    expect(passable(f, 99, 0, W0)).toBe(false)
  })

  it("floor, keys, switches, notes and the exit are", () => {
    for (const x of [1, 3, 5, 6, 9]) expect(passable(f, x, 0, W0), `x=${x}`).toBe(true)
  })

  it("a door needs a key", () => {
    expect(passable(f, 4, 0, W0)).toBe(false)
    expect(passable(f, 4, 0, { ...W0, keys: 1 })).toBe(true)
  })

  it("the two kinds of gate are opposite, and a switch flips both", () => {
    expect(passable(f, 7, 0, W0)).toBe(false)
    expect(passable(f, 8, 0, W0)).toBe(true)
    const flipped = { ...W0, gates: true }
    expect(passable(f, 7, 0, flipped)).toBe(true)
    expect(passable(f, 8, 0, flipped)).toBe(false)
  })

  it("a used tile is plain floor", () => {
    const opened = { ...W0, used: ["f:4,0"] }
    expect(tileAt(f, 4, 0, opened)).toBe(".")
    expect(passable(f, 4, 0, opened)).toBe(true)
  })
})

describe("placing a room window", () => {
  it("puts the body on the grid and wraps it in chrome", () => {
    const p = at("a", LEFT, 3, 4)
    expect(p.body).toEqual({ x: 3 * CELL_W, y: 4 * CELL_H, w: 5 * CELL_W, h: 3 * CELL_H })
    expect(p.outer.y).toBe(p.body.y - CHROME.top)
  })

  it("sizes a cropped window to its crop", () => {
    const p = at("a", LEFT, 3, 4, 1, { ox: 1, oy: 0, cols: 3, rows: 2 })
    expect(p.body.w).toBe(3 * CELL_W)
    expect(p.body.h).toBe(2 * CELL_H)
    expect(p.ox).toBe(1)
  })
})

describe("what is on top", () => {
  it("finds the highest window covering a point", () => {
    const low = at("low", LEFT, 0, 4, 1)
    const high = at("high", RIGHT, 0, 4, 2)
    expect(topAt([low, high], 5, 4 * CELL_H + 8)?.id).toBe("high")
  })

  it("finds nothing over bare desktop", () => {
    expect(topAt([at("a", LEFT, 0, 4)], 900, 600)).toBeUndefined()
  })
})

describe("walking", () => {
  const apart = [at("left", LEFT, 2, 4), at("right", RIGHT, 30, 4)]
  const joined = [at("left", LEFT, 2, 4), at("right", RIGHT, 7, 4)]

  it("moves onto floor and stops at walls", () => {
    expect(go(player("left", 1, 1), "right", apart).player).toEqual(player("left", 2, 1))
    expect(go(player("left", 1, 1), "up", apart).blocked).toBe("wall")
  })

  it("crosses where the rooms line up, and back", () => {
    expect(go(player("left", 4, 1), "right", joined).player).toEqual(player("right", 0, 1))
    expect(go(player("right", 0, 1), "left", joined).player).toEqual(player("left", 4, 1))
  })

  it("does not cross when the rows are off by one, or across a gap", () => {
    const off = [at("left", LEFT, 2, 4), at("right", RIGHT, 7, 5)]
    expect(go(player("left", 4, 1), "right", off).blocked).toBe("wall")
    const gap = [at("left", LEFT, 2, 4), at("right", RIGHT, 8, 4)]
    expect(go(player("left", 4, 1), "right", gap).blocked).toBe("void")
  })

  it("reports reaching the exit", () => {
    let p = player("right", 0, 1)
    p = go(p, "right", joined).player
    p = go(p, "right", joined).player
    const last = go(p, "right", joined)
    expect(last.player).toEqual(player("right", 3, 1))
    expect(last.won).toBe(true)
  })
})

describe("you can only walk where you can see", () => {
  it("will not step onto a tile another window covers", () => {
    const cover = parseFragment("cover", ["#####", ".....", "#####"])
    const layout = [at("left", LEFT, 2, 4, 1), at("cover", cover, 6, 4, 5)]
    const r = go(player("left", 3, 1), "right", layout, { ...frags, cover })
    expect(r.blocked).toBe("hidden")
  })

  it("will not step under a title bar", () => {
    const cover = parseFragment("cover", [".....", ".....", "....."])
    const layout = [at("left", LEFT, 2, 4, 1), at("cover", cover, 6, 6, 5)]
    expect(go(player("left", 3, 1), "right", layout, { ...frags, cover }).blocked).toBe("hidden")
  })

  it("counts an ordinary window as cover too", () => {
    const terminal: Placement = {
      id: "/terminal",
      outer: { x: 7 * CELL_W - 1, y: 0, w: 200, h: 400 },
      body: { x: 7 * CELL_W, y: 34, w: 198, h: 365 },
      z: 9,
    }
    const layout = [at("left", LEFT, 2, 4), at("right", RIGHT, 7, 4), terminal]
    expect(go(player("left", 4, 1), "right", layout).blocked).toBe("hidden")
  })

  it("will not step off the bottom of the screen", () => {
    const f = parseFragment("left", ["#####", "#@...", "#.###"])
    const r = go(player("left", 1, 1), "down", [at("left", f, 2, 34)], { left: f })
    expect(r.moved).toBe(false)
  })
})

describe("rooms join only at their edges", () => {
  /* If overlapping floor joined rooms, every level could be skipped by
     dropping the exit room onto the start room. */
  it("does not walk into a room lying across the path", () => {
    const across = parseFragment("across", [".........", ".........", "........."])
    const layout = [at("left", LEFT, 2, 4, 1), at("across", across, 5, 4, 2)]
    expect(go(player("left", 4, 1), "right", layout, { ...frags, across }).moved).toBe(false)
  })
})

describe("crossing vertically", () => {
  const UPPER = parseFragment("upper", ["#####", "#@..#", "##.##"])
  const LOWER = parseFragment("lower", ["##.##", "#..>#", "#####"])
  const both = { upper: UPPER, lower: LOWER }

  it("crosses down when the upper window is on top", () => {
    const layout = [at("upper", UPPER, 4, 4, 2), at("lower", LOWER, 4, 7, 1)]
    expect(go(player("upper", 2, 2), "down", layout, both).player).toEqual(player("lower", 2, 0))
  })

  it("is blocked when the lower window's title bar covers the way", () => {
    const layout = [at("upper", UPPER, 4, 4, 1), at("lower", LOWER, 4, 7, 2)]
    expect(go(player("upper", 2, 1), "down", layout, both).blocked).toBe("hidden")
  })
})

describe("cropping: the window's edge is the room's edge", () => {
  /* A corridor running right, with a wall after it. Whole, the room is sealed
     on the right; cropped just before the wall, the corridor runs out of the
     window's edge and becomes an opening. */
  const SEALED = parseFragment("sealed", ["######", "#@..##", "######"])
  const fs = { sealed: SEALED, right: RIGHT }

  it("is sealed when whole", () => {
    const layout = [at("sealed", SEALED, 2, 4), at("right", RIGHT, 8, 4)]
    let p = player("sealed", 1, 1)
    p = go(p, "right", layout, fs).player
    p = go(p, "right", layout, fs).player
    expect(go(p, "right", layout, fs).moved).toBe(false)
  })

  it("opens where the crop cuts through floor", () => {
    const crop = { ox: 0, oy: 0, cols: 4, rows: 3 }
    const layout = [at("sealed", SEALED, 2, 4, 1, crop), at("right", RIGHT, 6, 4)]
    let p = player("sealed", 1, 1)
    p = go(p, "right", layout, fs).player
    p = go(p, "right", layout, fs).player
    expect(go(p, "right", layout, fs).player).toEqual(player("right", 0, 1))
  })

  it("crops from the left without moving the room", () => {
    const WIDE = parseFragment("wide", ["######", "##..@#", "######"])
    const fsw = { wide: WIDE, left: LEFT }
    // Tiles 0 and 1 cut away: the window starts at the room's column 2.
    const crop = { ox: 2, oy: 0, cols: 4, rows: 3 }
    const layout = [at("left", LEFT, 0, 4), at("wide", WIDE, 5, 4, 1, crop)]
    let p = player("wide", 4, 1)
    p = go(p, "left", layout, fsw).player
    p = go(p, "left", layout, fsw).player
    expect(p).toEqual(player("wide", 2, 1))
    expect(go(p, "left", layout, fsw).player).toEqual(player("left", 4, 1))
  })

  it("will not walk onto a tile cropped out of the window", () => {
    const crop = { ox: 0, oy: 0, cols: 3, rows: 3 }
    const layout = [at("sealed", SEALED, 2, 4, 1, crop)]
    expect(go(player("sealed", 2, 1), "right", layout, fs).moved).toBe(false)
  })

  it("lists the tiles along the crop's edges", () => {
    const p = at("sealed", SEALED, 2, 4, 1, { ox: 1, oy: 0, cols: 2, rows: 3 })
    const right = edgeTiles(p).filter((t) => t.dir === "right")
    expect(right.map((t) => `${t.x},${t.y}`)).toEqual(["2,0", "2,1", "2,2"])
  })
})

describe("keys, doors, switches and notes", () => {
  const ROOM = parseFragment("room", ["#######", "#@$%^?#", "#######"])
  const fs = { room: ROOM }
  const layout = [at("room", ROOM, 2, 4)]

  it("picks up a key", () => {
    const r = go(player("room", 1, 1), "right", layout, fs)
    expect(r.events).toEqual([{ kind: "key", at: "room:2,1" }])
    const w = applyEvents(W0, r.events)
    expect(w.keys).toBe(1)
    expect(tileAt(ROOM, 2, 1, w)).toBe(".")
  })

  it("refuses a door without a key, and says it is a door", () => {
    expect(go(player("room", 2, 1), "right", layout, fs).blocked).toBe("door")
  })

  it("opens a door with a key, for good, spending the key", () => {
    const w1 = { ...W0, keys: 1 }
    const r = go(player("room", 2, 1), "right", layout, fs, w1)
    expect(r.events).toEqual([{ kind: "door", at: "room:3,1" }])
    const w2 = applyEvents(w1, r.events)
    expect(w2.keys).toBe(0)
    expect(passable(ROOM, 3, 1, w2)).toBe(true)
  })

  it("fires a switch's triggers", () => {
    const triggers = {
      "room:4,1": [{ kind: "gates" as const }, { kind: "unlock" as const, frag: "b" }],
    }
    const w = applyEvents(W0, [{ kind: "switch", at: "room:4,1" }], triggers)
    expect(w.gates).toBe(true)
    expect(w.unlocked).toEqual(["b"])
    // Stepping on it again flips the gates back but unlocks nothing twice.
    const w2 = applyEvents(w, [{ kind: "switch", at: "room:4,1" }], triggers)
    expect(w2.gates).toBe(false)
    expect(w2.unlocked).toEqual(["b"])
  })

  it("records a note as read", () => {
    const w = { ...W0, keys: 1, used: ["room:3,1"] }
    const r = go(player("room", 4, 1), "right", layout, fs, w)
    expect(r.events).toEqual([{ kind: "note", at: "room:5,1" }])
    expect(applyEvents(w, r.events).read).toEqual(["room:5,1"])
  })
})

describe("lit edges", () => {
  it("lights an edge that meets floor in another room", () => {
    const joined = [at("left", LEFT, 2, 4), at("right", RIGHT, 7, 4)]
    expect(links("left", joined, frags, VIEW, W0)).toEqual(["4,1"])
    expect(links("right", joined, frags, VIEW, W0)).toEqual(["0,1"])
  })

  it("lights nothing when the rooms are apart", () => {
    const apart = [at("left", LEFT, 2, 4), at("right", RIGHT, 30, 4)]
    expect(links("left", apart, frags, VIEW, W0)).toEqual([])
  })

  it("lights an edge a crop has just opened", () => {
    const SEALED = parseFragment("sealed", ["######", "#@..##", "######"])
    const crop = { ox: 0, oy: 0, cols: 4, rows: 3 }
    const layout = [at("sealed", SEALED, 2, 4, 1, crop), at("right", RIGHT, 6, 4)]
    expect(links("sealed", layout, { sealed: SEALED, right: RIGHT }, VIEW, W0)).toEqual(["3,1"])
  })
})
