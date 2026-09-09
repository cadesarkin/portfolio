import { describe, it, expect } from "vitest"
import {
  createFire,
  stepFire,
  emberCell,
  FLAME_RAMP,
  SMOKE_RAMP,
  MAX_EMBERS,
  type Fire,
} from "./embers"

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const CX = 80
const CY = 40

/** Runs the fire for a while so it reaches a steady state. */
function settle(seconds: number, seed = 1): Fire {
  let f = createFire()
  const rng = seeded(seed)
  for (let i = 0; i < seconds / 0.033; i++) f = stepFire(f, 0.033, CX, CY, rng)
  return f
}

describe("createFire", () => {
  it("starts empty and ready to spawn", () => {
    const f = createFire()
    expect(f.embers).toEqual([])
    expect(f.next).toBeLessThanOrEqual(0)
  })
})

describe("stepFire", () => {
  it("spawns embers", () => {
    expect(stepFire(createFire(), 0.1, CX, CY, seeded(1)).embers.length).toBeGreaterThan(0)
  })

  it("reaches a steady population rather than growing forever", () => {
    const short = settle(2)
    const long = settle(30)
    expect(long.embers.length).toBeLessThanOrEqual(MAX_EMBERS)
    expect(short.embers.length).toBeGreaterThan(0)
  })

  /** A tab left in the background delivers one enormous dt on return. */
  it("does not spawn unboundedly on a huge timestep", () => {
    const f = stepFire(createFire(), 30, CX, CY, seeded(2))
    expect(f.embers.length).toBeLessThanOrEqual(MAX_EMBERS)
    expect(f.next).toBeGreaterThan(0)
  })

  it("retires embers once their life runs out", () => {
    let f = settle(2)
    const before = f.embers.length
    expect(before).toBeGreaterThan(0)
    // Step with no further spawning by exhausting the population.
    for (let i = 0; i < 200; i++) {
      f = { embers: f.embers, next: 999 }
      f = stepFire(f, 0.05, CX, CY, seeded(3))
    }
    expect(f.embers.length).toBe(0)
  })

  it("spawns every kind over time", () => {
    const kinds = new Set(settle(6).embers.map((e) => e.kind))
    expect(kinds.size).toBeGreaterThan(1)
  })

  it("starts embers near the crater, not scattered across the screen", () => {
    for (const e of settle(0.4).embers) {
      expect(Math.abs(e.x - CX)).toBeLessThan(8)
      expect(Math.abs(e.y - CY)).toBeLessThan(8)
    }
  })

  it("sends flames and smoke upward", () => {
    const rising = settle(3).embers.filter((e) => e.kind !== "spark")
    expect(rising.length).toBeGreaterThan(0)
    for (const e of rising) expect(e.y).toBeLessThanOrEqual(CY + 1)
  })

  it("arcs sparks back down", () => {
    // A spark launched upward must eventually be moving downward again.
    let f: Fire = {
      embers: [
        { x: CX, y: CY, vx: 2, vy: -8, life: 5, span: 5, kind: "spark", phase: 0 },
      ],
      next: 999,
    }
    for (let i = 0; i < 40; i++) f = stepFire(f, 0.033, CX, CY, seeded(4))
    expect(f.embers[0].vy).toBeGreaterThan(0)
  })

  it("does not mutate the input", () => {
    const f = settle(1)
    const x0 = f.embers[0].x
    stepFire(f, 0.1, CX, CY, seeded(5))
    expect(f.embers[0].x).toBe(x0)
  })
})

describe("emberCell", () => {
  const base = { x: 10.4, y: 20.2, vx: 0, vy: -3, phase: 0 }

  it("gives a flame a ramp glyph and a warm colour", () => {
    const c = emberCell({ ...base, life: 0.9, span: 1, kind: "flame" }, 0, false)
    expect(FLAME_RAMP).toContain(c.ch)
    expect(c.color).toMatch(/^rgba\(255,/)
  })

  it("cools a flame as it ages", () => {
    const young = emberCell({ ...base, life: 0.95, span: 1, kind: "flame" }, 0, false)
    const old = emberCell({ ...base, life: 0.1, span: 1, kind: "flame" }, 0, false)
    const g = (s: string) => Number(s.split(",")[1])
    expect(g(old.color)).toBeLessThan(g(young.color))
  })

  it("gives smoke a smoke glyph", () => {
    const c = emberCell({ ...base, life: 3, span: 3.6, kind: "smoke" }, 0, false)
    expect(SMOKE_RAMP).toContain(c.ch)
  })

  it("lightens smoke at night so it reads against a dark sky", () => {
    const day = emberCell({ ...base, life: 3, span: 3.6, kind: "smoke" }, 0, false)
    const night = emberCell({ ...base, life: 3, span: 3.6, kind: "smoke" }, 0, true)
    const v = (s: string) => Number(s.slice(5).split(",")[0])
    expect(v(night.color)).toBeGreaterThan(v(day.color))
  })

  it("returns whole-number grid coordinates", () => {
    for (const kind of ["flame", "smoke", "spark"] as const) {
      const c = emberCell({ ...base, life: 0.5, span: 1, kind }, 1.3, false)
      expect(Number.isInteger(c.col)).toBe(true)
      expect(Number.isInteger(c.row)).toBe(true)
    }
  })

  it("keeps alpha within range across a whole lifetime", () => {
    for (const kind of ["flame", "smoke", "spark"] as const) {
      for (const life of [1, 0.75, 0.5, 0.25, 0.01]) {
        const c = emberCell({ ...base, life, span: 1, kind }, 0, false)
        const alpha = Number(c.color.split(",")[3].replace(")", ""))
        expect(alpha).toBeGreaterThanOrEqual(0)
        expect(alpha).toBeLessThanOrEqual(1)
      }
    }
  })
})
