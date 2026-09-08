import { describe, it, expect } from "vitest"
import { cropToSprite, step, spriteSize, SPRITE_CELL_W, SPRITE_CELL_H } from "./sprite"
import { createCanvas, paint } from "@/components/apps/paint/engine"

/** Deterministic rng so placement and velocity are reproducible. */
const fixed = (v: number) => () => v

const text = (s: NonNullable<ReturnType<typeof cropToSprite>>) =>
  s.rows.map((r) => r.map((run) => run.text).join("")).join("\n")

describe("cropToSprite", () => {
  it("returns null for a blank canvas", () => {
    expect(cropToSprite(createCanvas(10, 5), "a", { w: 800, h: 600 })).toBeNull()
  })

  it("crops to the drawn bounding box", () => {
    let c = createCanvas(20, 10)
    c = paint(c, 5, 3, "#", 0)
    c = paint(c, 7, 4, "#", 0)
    const s = cropToSprite(c, "a", { w: 800, h: 600 }, fixed(0))!
    expect(s.w).toBe(3)
    expect(s.h).toBe(2)
  })

  it("keeps the drawing's shape", () => {
    let c = createCanvas(20, 10)
    c = paint(c, 2, 2, "a", 0)
    c = paint(c, 3, 2, "b", 0)
    c = paint(c, 2, 3, "c", 0)
    const s = cropToSprite(c, "a", { w: 800, h: 600 }, fixed(0))!
    expect(text(s)).toBe("ab\nc ")
  })

  it("groups a row into runs by colour", () => {
    let c = createCanvas(10, 3)
    c = paint(c, 0, 0, "x", 1)
    c = paint(c, 1, 0, "y", 1)
    c = paint(c, 2, 0, "z", 4)
    const s = cropToSprite(c, "a", { w: 800, h: 600 }, fixed(0))!
    expect(s.rows[0]).toEqual([
      { text: "xy", color: 1 },
      { text: "z", color: 4 },
    ])
  })

  it("handles a single painted cell", () => {
    const c = paint(createCanvas(12, 6), 4, 4, "*", 0)
    const s = cropToSprite(c, "a", { w: 800, h: 600 }, fixed(0))!
    expect(s.w).toBe(1)
    expect(s.h).toBe(1)
    expect(text(s)).toBe("*")
  })

  it("places the sprite inside the given bounds", () => {
    const c = paint(createCanvas(12, 6), 1, 1, "*", 0)
    const s = cropToSprite(c, "a", { w: 400, h: 300 }, fixed(0.999))!
    const { w, h } = spriteSize(s)
    expect(s.x).toBeLessThanOrEqual(400 - w)
    expect(s.y).toBeLessThanOrEqual(300 - h)
    expect(s.x).toBeGreaterThanOrEqual(0)
    expect(s.y).toBeGreaterThanOrEqual(0)
  })

  it("gives it a non-zero velocity", () => {
    const c = paint(createCanvas(12, 6), 1, 1, "*", 0)
    const s = cropToSprite(c, "a", { w: 400, h: 300 }, fixed(0.3))!
    expect(Math.hypot(s.vx, s.vy)).toBeGreaterThan(0)
  })
})

describe("step", () => {
  const base = {
    id: "a",
    rows: [[{ text: "##", color: 0 }]],
    w: 2,
    h: 1,
    phase: 0,
  }
  const bounds = { w: 400, h: 300 }

  it("moves by velocity times elapsed time", () => {
    const s = step({ ...base, x: 100, y: 100, vx: 50, vy: -20 }, 0.5, bounds)
    expect(s.x).toBeCloseTo(125)
    expect(s.y).toBeCloseTo(90)
  })

  it("bounces off the left edge", () => {
    const s = step({ ...base, x: 2, y: 100, vx: -60, vy: 0 }, 0.5, bounds)
    expect(s.x).toBe(0)
    expect(s.vx).toBeGreaterThan(0)
  })

  it("bounces off the top edge", () => {
    const s = step({ ...base, x: 100, y: 1, vx: 0, vy: -60 }, 0.5, bounds)
    expect(s.y).toBe(0)
    expect(s.vy).toBeGreaterThan(0)
  })

  it("bounces off the right edge, accounting for sprite width", () => {
    const maxX = bounds.w - 2 * SPRITE_CELL_W
    const s = step({ ...base, x: maxX - 1, y: 100, vx: 90, vy: 0 }, 0.5, bounds)
    expect(s.x).toBe(maxX)
    expect(s.vx).toBeLessThan(0)
  })

  it("bounces off the bottom edge, accounting for sprite height", () => {
    const maxY = bounds.h - 1 * SPRITE_CELL_H
    const s = step({ ...base, x: 10, y: maxY - 1, vx: 0, vy: 90 }, 0.5, bounds)
    expect(s.y).toBe(maxY)
    expect(s.vy).toBeLessThan(0)
  })

  /**
   * A sprite left outside the viewport by a resize must be pulled back, not
   * left drifting further away from an edge it can never reach.
   */
  it("clamps a sprite that starts outside the bounds", () => {
    const s = step({ ...base, x: 9999, y: 9999, vx: 30, vy: 30 }, 0.1, bounds)
    const { w, h } = spriteSize(s)
    expect(s.x).toBe(bounds.w - w)
    expect(s.y).toBe(bounds.h - h)
  })

  it("survives bounds smaller than the sprite without going negative", () => {
    const s = step({ ...base, x: 5, y: 5, vx: 30, vy: 30 }, 0.1, { w: 4, h: 4 })
    expect(s.x).toBe(0)
    expect(s.y).toBe(0)
  })

  it("keeps speed constant across a bounce", () => {
    const before = { ...base, x: 1, y: 100, vx: -40, vy: 30 }
    const after = step(before, 0.5, bounds)
    expect(Math.hypot(after.vx, after.vy)).toBeCloseTo(
      Math.hypot(before.vx, before.vy)
    )
  })
})
