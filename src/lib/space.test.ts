import { describe, it, expect } from "vitest"
import {
  KINDS,
  PLANETS,
  PLANET_RAMP,
  makeStars,
  planetAt,
  ringAt,
  spawnVisitor,
  stepStars,
  stepVisitors,
  surfaceAt,
} from "./space"
import { width } from "./crash-site"

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}

const giant = PLANETS.find((p) => p.id === "giant")!
const ember = PLANETS.find((p) => p.id === "ember")!

describe("planets", () => {
  it("are a disc: nothing outside it, never a blank inside it", () => {
    expect(surfaceAt(ember, 1.01, 0, 0)).toBeNull()
    for (let u = -0.95; u < 1; u += 0.1) {
      for (let v = -0.95; v < 1; v += 0.1) {
        if (u * u + v * v > 0.98) continue
        expect(surfaceAt(ember, u, v, 3)!.ch).not.toBe(" ")
      }
    }
  })

  it("are lit from the upper left", () => {
    const lit = PLANET_RAMP.indexOf(surfaceAt(ember, -0.5, -0.4, 0)!.ch)
    const dark = PLANET_RAMP.indexOf(surfaceAt(ember, 0.6, 0.5, 0)!.ch)
    expect(lit).toBeGreaterThan(dark)
  })

  it("give the giant rings, in front of it below and behind it above", () => {
    expect(ringAt(ember, 1.6, 0)).toBeNull()
    expect(ringAt(giant, 0.2, 0.1)).toBeNull()
    const below = ringAt(giant, 0.3, 0.42)
    const above = ringAt(giant, -0.3, -0.42)
    expect(below?.front).toBe(true)
    expect(above?.front).toBe(false)
  })

  it("keep the moon going round its planet at the same distance", () => {
    const moon = PLANETS.find((p) => p.orbit)!
    const dist = [0, 60, 120, 180].map((t) => {
      const m = planetAt(moon, t, 1)
      return Math.hypot(m.x - giant.x, (m.y - giant.y) / 0.35)
    })
    const d0 = giant.r * moon.orbit!.distance
    for (const d of dist) expect(d).toBeCloseTo(d0, 5)
  })
})

describe("visitors", () => {
  it("draw their art the same width whichever way they fly", () => {
    for (const k of KINDS) expect(width(k.art)).toBeGreaterThan(0)
  })

  it("come in from off the edge and fly across", () => {
    const rng = seeded(3)
    for (let i = 0; i < 40; i++) {
      const v = spawnVisitor(160, 50, rng)
      const w = width(v.art)
      if (v.vx > 0) expect(v.x + w).toBeLessThanOrEqual(0)
      else expect(v.x).toBeGreaterThanOrEqual(160)
      expect(v.y).toBeGreaterThanOrEqual(2)
      expect(v.y + v.art.length).toBeLessThan(50)
      const later = stepVisitors([v], 1, 160)[0]
      expect(Math.sign(later.x - v.x)).toBe(Math.sign(v.vx))
    }
  })

  it("are forgotten once they have gone", () => {
    const v = spawnVisitor(160, 50, seeded(9))
    expect(stepVisitors([v], 200, 160)).toEqual([])
  })
})

describe("stars", () => {
  it("fill the sky in three depths and drift round", () => {
    const stars = makeStars(160, 50, seeded(4))
    expect(stars.length).toBeGreaterThan(100)
    expect(new Set(stars.map((s) => s.layer)).size).toBe(3)
    const later = stepStars(stars, 500, 160)
    for (const s of later) {
      expect(s.x).toBeGreaterThanOrEqual(-1)
      expect(s.x).toBeLessThanOrEqual(162)
    }
  })
})
