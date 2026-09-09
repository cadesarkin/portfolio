import { describe, it, expect } from "vitest"
import {
  WORLDS,
  ORIGIN,
  ARRIVE_RADIUS,
  createShip,
  worldById,
  setCourse,
  stepShip,
  heading,
  shipGlyph,
  distanceRemaining,
} from "./starmap"

describe("worlds", () => {
  it("gives every world a unique id", () => {
    expect(new Set(WORLDS.map((w) => w.id)).size).toBe(WORLDS.length)
  })

  it("keeps every world on the map", () => {
    for (const w of WORLDS) {
      expect(w.x).toBeGreaterThan(0)
      expect(w.x).toBeLessThan(1)
      expect(w.y).toBeGreaterThan(0)
      expect(w.y).toBeLessThan(1)
    }
  })

  it("gives every world a name and a blurb", () => {
    for (const w of WORLDS) {
      expect(w.name).toBeTruthy()
      expect(w.blurb).toBeTruthy()
    }
  })

  it("does not stack two worlds on top of each other", () => {
    for (let i = 0; i < WORLDS.length; i++) {
      for (let j = i + 1; j < WORLDS.length; j++) {
        const d = Math.hypot(WORLDS[i].x - WORLDS[j].x, WORLDS[i].y - WORLDS[j].y)
        expect(d, `${WORLDS[i].id} vs ${WORLDS[j].id}`).toBeGreaterThan(0.12)
      }
    }
  })

  it("looks a world up by id", () => {
    expect(worldById("links")?.name).toBe("THE LINKS")
    expect(worldById("nowhere")).toBeUndefined()
  })
})

describe("createShip", () => {
  it("starts adrift at the origin", () => {
    const s = createShip()
    expect(s.x).toBe(ORIGIN.x)
    expect(s.y).toBe(ORIGIN.y)
    expect(s.target).toBeNull()
    expect(s.landed).toBeNull()
  })
})

describe("setCourse", () => {
  it("sets a target", () => {
    expect(setCourse(createShip(), "links").target).toBe("links")
  })

  it("ignores an unknown world", () => {
    const s = createShip()
    expect(setCourse(s, "nowhere")).toBe(s)
  })

  it("clears the landing on departure — you cannot be on two worlds", () => {
    const landed = { ...createShip(), landed: "links" }
    expect(setCourse(landed, "lanes").landed).toBeNull()
  })
})

describe("stepShip", () => {
  it("does nothing without a target", () => {
    const s = createShip()
    expect(stepShip(s, 0.5)).toBe(s)
  })

  it("moves toward the target", () => {
    const s = setCourse(createShip(), "links")
    const before = distanceRemaining(s)
    const after = distanceRemaining(stepShip(s, 0.2))
    expect(after).toBeLessThan(before)
  })

  it("arrives and records the landing", () => {
    let s = setCourse(createShip(), "links")
    for (let i = 0; i < 200 && s.target; i++) s = stepShip(s, 0.05)
    expect(s.target).toBeNull()
    expect(s.landed).toBe("links")
    const w = worldById("links")!
    expect(s.x).toBeCloseTo(w.x, 6)
    expect(s.y).toBeCloseTo(w.y, 6)
  })

  /**
   * A step larger than the remaining distance must land, not overshoot and
   * then oscillate around the world forever.
   */
  it("does not overshoot on a large timestep", () => {
    const s = stepShip(setCourse(createShip(), "links"), 100)
    const w = worldById("links")!
    expect(s.x).toBeCloseTo(w.x, 6)
    expect(s.landed).toBe("links")
  })

  it("lands once inside the arrival radius", () => {
    const w = worldById("lanes")!
    const near = {
      ...createShip(),
      x: w.x + ARRIVE_RADIUS * 0.5,
      y: w.y,
      target: "lanes",
      landed: null,
    }
    expect(stepShip(near, 0.001).landed).toBe("lanes")
  })

  it("clears a target that no longer exists", () => {
    const bogus = { ...createShip(), target: "nowhere" }
    const s = stepShip(bogus, 0.1)
    expect(s.target).toBeNull()
  })

  it("can travel on from a world it has landed on", () => {
    let s = setCourse(createShip(), "links")
    for (let i = 0; i < 200 && s.target; i++) s = stepShip(s, 0.05)
    s = setCourse(s, "arcanum")
    for (let i = 0; i < 200 && s.target; i++) s = stepShip(s, 0.05)
    expect(s.landed).toBe("arcanum")
  })
})

describe("heading and glyph", () => {
  it("points at the target", () => {
    const w = worldById("lanes")!
    const s = { ...createShip(), x: w.x - 0.2, y: w.y, target: "lanes", landed: null }
    expect(heading(s)).toBeCloseTo(0, 3) // due east
  })

  it("returns a stable heading when adrift", () => {
    expect(heading(createShip())).toBeCloseTo(-Math.PI / 2, 6)
  })

  it("maps the compass to glyphs", () => {
    expect(shipGlyph(0)).toBe(">")
    expect(shipGlyph(Math.PI)).toBe("<")
    expect(shipGlyph(-Math.PI / 2)).toBe("^")
    expect(shipGlyph(Math.PI / 2)).toBe("v")
  })

  it("never returns an empty glyph for any angle", () => {
    for (let a = -Math.PI * 2; a <= Math.PI * 2; a += 0.13) {
      expect(shipGlyph(a)).toBeTruthy()
    }
  })
})
