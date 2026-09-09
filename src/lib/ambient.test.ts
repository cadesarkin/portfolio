import { describe, it, expect } from "vitest"
import {
  createAmbient,
  stepAmbient,
  birdGlyph,
  starCells,
  FLOCK_MIN,
  FLOCK_MAX,
  type Ambient,
} from "./ambient"

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const COLS = 120
const ROWS = 60

describe("createAmbient", () => {
  it("makes a flock within the expected size", () => {
    for (let s = 1; s <= 20; s++) {
      const a = createAmbient(COLS, ROWS, seeded(s))
      expect(a.birds.length).toBeGreaterThanOrEqual(FLOCK_MIN)
      expect(a.birds.length).toBeLessThanOrEqual(FLOCK_MAX)
    }
  })

  it("starts with no shooting stars and a pending one", () => {
    const a = createAmbient(COLS, ROWS, seeded(1))
    expect(a.stars).toEqual([])
    expect(a.nextStar).toBeGreaterThan(0)
  })

  it("flies the whole flock in one direction", () => {
    const a = createAmbient(COLS, ROWS, seeded(4))
    const dirs = new Set(a.birds.map((b) => Math.sign(b.vx)))
    expect(dirs.size).toBe(1)
  })

  it("keeps the flock in the sky, not the ground", () => {
    for (let s = 1; s <= 20; s++) {
      const a = createAmbient(COLS, ROWS, seeded(s))
      for (const b of a.birds) expect(b.y).toBeLessThan(ROWS * 0.45)
    }
  })

  it("gives each bird its own wingbeat phase", () => {
    const a = createAmbient(COLS, ROWS, seeded(7))
    expect(new Set(a.birds.map((b) => b.phase)).size).toBe(a.birds.length)
  })
})

describe("stepAmbient — birds", () => {
  it("moves birds by day", () => {
    const a = createAmbient(COLS, ROWS, seeded(2))
    const b = stepAmbient(a, 0.5, COLS, ROWS, false, seeded(2))
    expect(b.birds[0].x).not.toBe(a.birds[0].x)
  })

  it("leaves birds untouched at night", () => {
    const a = createAmbient(COLS, ROWS, seeded(2))
    const b = stepAmbient(a, 0.5, COLS, ROWS, true, seeded(2))
    expect(b.birds).toBe(a.birds)
  })

  it("wraps a bird that flies off the right edge", () => {
    const a: Ambient = {
      birds: [{ x: COLS + 3.9, y: 5, vx: 4, phase: 0, rate: 3 }],
      stars: [],
      nextStar: 99,
    }
    const b = stepAmbient(a, 0.5, COLS, ROWS, false, seeded(1))
    expect(b.birds[0].x).toBeLessThan(0)
  })

  it("wraps a bird that flies off the left edge", () => {
    const a: Ambient = {
      birds: [{ x: -3.9, y: 5, vx: -4, phase: 0, rate: 3 }],
      stars: [],
      nextStar: 99,
    }
    const b = stepAmbient(a, 0.5, COLS, ROWS, false, seeded(1))
    expect(b.birds[0].x).toBeGreaterThan(COLS)
  })

  it("does not mutate the input", () => {
    const a = createAmbient(COLS, ROWS, seeded(3))
    const x0 = a.birds[0].x
    stepAmbient(a, 1, COLS, ROWS, false, seeded(3))
    expect(a.birds[0].x).toBe(x0)
  })
})

describe("stepAmbient — shooting stars", () => {
  const bare = (): Ambient => ({ birds: [], stars: [], nextStar: 0.01 })

  it("spawns one at night once the timer elapses", () => {
    const a = stepAmbient(bare(), 0.5, COLS, ROWS, true, seeded(5))
    expect(a.stars).toHaveLength(1)
    expect(a.nextStar).toBeGreaterThan(0)
  })

  it("never spawns one by day", () => {
    const a = stepAmbient(bare(), 5, COLS, ROWS, false, seeded(5))
    expect(a.stars).toHaveLength(0)
  })

  it("always travels downward and sideways", () => {
    for (let s = 1; s <= 25; s++) {
      const a = stepAmbient(bare(), 0.5, COLS, ROWS, true, seeded(s))
      const st = a.stars[0]
      expect(st.vy, `seed ${s}`).toBeGreaterThan(0)
      expect(Math.abs(st.vx), `seed ${s}`).toBeGreaterThan(0)
    }
  })

  it("starts in the upper sky", () => {
    for (let s = 1; s <= 25; s++) {
      const a = stepAmbient(bare(), 0.5, COLS, ROWS, true, seeded(s))
      expect(a.stars[0].y).toBeLessThan(ROWS * 0.4)
    }
  })

  it("expires a star once its life runs out", () => {
    let a = stepAmbient(bare(), 0.5, COLS, ROWS, true, seeded(6))
    expect(a.stars).toHaveLength(1)
    a = { ...a, nextStar: 999 }
    for (let i = 0; i < 40; i++) {
      a = stepAmbient(a, 0.1, COLS, ROWS, true, seeded(6))
    }
    expect(a.stars).toHaveLength(0)
  })

  it("does not pile up stars without bound", () => {
    let a = bare()
    for (let i = 0; i < 400; i++) {
      a = stepAmbient(a, 0.1, COLS, ROWS, true, seeded(i + 1))
    }
    expect(a.stars.length).toBeLessThan(8)
  })
})

describe("birdGlyph", () => {
  it("alternates between two frames over time", () => {
    const bird = { x: 0, y: 0, vx: 1, phase: 0, rate: 3 }
    const frames = new Set(
      Array.from({ length: 40 }, (_, i) => birdGlyph(bird, i * 0.1))
    )
    expect(frames).toEqual(new Set(["v", "-"]))
  })
})

describe("starCells", () => {
  const star = {
    x: 40,
    y: 10,
    vx: 30,
    vy: 12,
    life: 0.5,
    span: 1,
    tail: 6,
  }

  it("returns one cell per tail segment", () => {
    expect(starCells(star)).toHaveLength(6)
  })

  it("puts the bright head first", () => {
    expect(starCells(star)[0].ch).toBe("*")
  })

  it("trails behind the direction of travel", () => {
    const cells = starCells(star)
    // Moving right and down, so the tail runs up and to the left.
    expect(cells[cells.length - 1].col).toBeLessThan(cells[0].col)
    expect(cells[cells.length - 1].row).toBeLessThanOrEqual(cells[0].row)
  })

  it("fades along the tail", () => {
    const cells = starCells(star)
    expect(cells[0].alpha).toBeGreaterThan(cells[cells.length - 1].alpha)
  })

  it("keeps every alpha in range", () => {
    for (const life of [1, 0.75, 0.5, 0.25, 0.02]) {
      for (const c of starCells({ ...star, life })) {
        expect(c.alpha).toBeGreaterThanOrEqual(0)
        expect(c.alpha).toBeLessThanOrEqual(1)
      }
    }
  })

  it("survives a zero-velocity star without dividing by zero", () => {
    const cells = starCells({ ...star, vx: 0, vy: 0 })
    expect(cells.every((c) => Number.isFinite(c.col) && Number.isFinite(c.row))).toBe(true)
  })
})
