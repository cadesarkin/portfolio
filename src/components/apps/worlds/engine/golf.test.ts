import { describe, it, expect } from "vitest"
import {
  createGame,
  createHole,
  groundAt,
  lieAt,
  swing,
  step,
  distanceToPin,
  nextHole,
  toPar,
  scoreName,
  HOLES,
  CUP_RADIUS,
  CUP_SPEED,
  LIE_POWER,
  facing,
  type Game,
} from "./golf"

/** Runs the simulation until the ball comes to rest, with a safety cap. */
function settle(g: Game, maxSteps = 4000): Game {
  let out = g
  for (let i = 0; i < maxSteps && out.ball.moving; i++) out = step(out, 0.016)
  return out
}

describe("holes", () => {
  it("builds a hole for every number", () => {
    for (let n = 1; n <= HOLES; n++) {
      const h = createHole(n)
      expect(h.length).toBeGreaterThan(50)
      expect([3, 4, 5]).toContain(h.par)
      expect(h.pinX).toBe(h.length)
    }
  })

  it("makes par-5s longer than par-3s", () => {
    const threes = [2, 5, 8].map(createHole)
    const fives = [3, 6, 9].map(createHole)
    const avg = (xs: { length: number }[]) =>
      xs.reduce((n, h) => n + h.length, 0) / xs.length
    expect(avg(fives)).toBeGreaterThan(avg(threes))
  })

  /** A course that reshuffles under you is not a course. */
  it("generates identical terrain for the same hole every time", () => {
    const a = createHole(4)
    const b = createHole(4)
    for (const x of [0, 20, 55, 90, 140]) {
      expect(groundAt(a, x)).toBeCloseTo(groundAt(b, x), 10)
    }
  })

  it("gives different holes different terrain", () => {
    const a = createHole(1)
    const b = createHole(2)
    const differs = [10, 30, 50, 70].some(
      (x) => Math.abs(groundAt(a, x) - groundAt(b, x)) > 0.01
    )
    expect(differs).toBe(true)
  })

  it("flattens the green so putting is not a coin flip", () => {
    const h = createHole(1)
    const onGreen = Math.abs(groundAt(h, h.pinX) - groundAt(h, h.pinX + 4))
    const offGreen = Math.abs(groundAt(h, h.length * 0.4) - groundAt(h, h.length * 0.4 + 4))
    expect(onGreen).toBeLessThan(offGreen)
  })
})

describe("lies", () => {
  it("starts on the tee and finishes on the green", () => {
    const h = createHole(1)
    expect(lieAt(h, 0)).toBe("tee")
    expect(lieAt(h, h.pinX)).toBe("green")
  })

  it("penalises a bunker and rough more than the fairway", () => {
    expect(LIE_POWER.bunker).toBeLessThan(LIE_POWER.fairway)
    expect(LIE_POWER.rough).toBeLessThan(LIE_POWER.fairway)
  })

  it("puts a bunker somewhere on every hole", () => {
    for (let n = 1; n <= HOLES; n++) {
      const h = createHole(n)
      let found = false
      for (let x = 0; x < h.length && !found; x += 1) {
        if (lieAt(h, x) === "bunker") found = true
      }
      expect(found, `hole ${n}`).toBe(true)
    }
  })
})

describe("swing", () => {
  it("counts a stroke and sets the ball moving", () => {
    const g = swing(createGame(1), 0.8, 35)
    expect(g.strokes).toBe(1)
    expect(g.ball.moving).toBe(true)
  })

  it("refuses to swing while the ball is still moving", () => {
    const g = swing(createGame(1), 0.8, 35)
    expect(swing(g, 0.5, 40)).toBe(g)
  })

  it("hits harder with more power", () => {
    const soft = settle(swing(createGame(1), 0.3, 35))
    const hard = settle(swing(createGame(1), 0.9, 35))
    expect(hard.ball.x).toBeGreaterThan(soft.ball.x)
  })

  it("gets less out of a bunker than a fairway lie", () => {
    expect(LIE_POWER.bunker).toBeLessThan(1)
  })

  it("clamps power outside 0..1", () => {
    const over = settle(swing(createGame(1), 5, 35))
    const full = settle(swing(createGame(1), 1, 35))
    expect(over.ball.x).toBeCloseTo(full.ball.x, 4)
  })
})

describe("flight", () => {
  it("comes to rest", () => {
    const g = settle(swing(createGame(1), 0.8, 35))
    expect(g.ball.moving).toBe(false)
  })

  it("lands on the ground, not through it", () => {
    const g = settle(swing(createGame(1), 0.8, 35))
    expect(g.ball.y).toBeCloseTo(groundAt(g.hole, g.ball.x), 1)
  })

  it("travels forward on a normal swing", () => {
    const g = settle(swing(createGame(1), 0.75, 40))
    expect(g.ball.x).toBeGreaterThan(20)
  })

  it("never leaves the ball behind the tee", () => {
    const g = settle(swing(createGame(1), 0.6, 170))
    expect(g.ball.x).toBeGreaterThanOrEqual(0)
  })

  it("does nothing when stepped at rest", () => {
    const g = createGame(1)
    expect(step(g, 0.016)).toBe(g)
  })

  it("carries further with a tailwind than a headwind", () => {
    const base = createGame(1)
    const tail = { ...base, hole: { ...base.hole, wind: 9 } }
    const head = { ...base, hole: { ...base.hole, wind: -9 } }
    expect(settle(swing(tail, 0.8, 40)).ball.x).toBeGreaterThan(
      settle(swing(head, 0.8, 40)).ball.x
    )
  })
})

describe("holing out", () => {
  it("drops when the ball stops within the cup radius", () => {
    const base = createGame(1)
    const atPin: Game = {
      ...base,
      ball: {
        x: base.hole.pinX,
        y: groundAt(base.hole, base.hole.pinX),
        vx: 0.05,
        vy: 0,
        moving: true,
      },
    }
    expect(step(atPin, 0.016).holed).toBe(true)
  })

  it("does not drop from outside the cup", () => {
    const base = createGame(1)
    const away: Game = {
      ...base,
      ball: {
        x: base.hole.pinX - CUP_RADIUS * 4,
        y: groundAt(base.hole, base.hole.pinX - CUP_RADIUS * 4),
        vx: 0.05,
        vy: 0,
        moving: true,
      },
    }
    expect(step(away, 0.016).holed).toBe(false)
  })

  /* The bug: the ball had to come to rest inside a 1.6 m window, which
     friction almost never arranged, so putts rolled over the hole forever. */
  it("drops when the ball rolls slowly over the cup", () => {
    const base = createGame(1)
    const rolling: Game = {
      ...base,
      ball: {
        x: base.hole.pinX,
        y: groundAt(base.hole, base.hole.pinX),
        vx: CUP_SPEED * 0.5,
        vy: 0,
        moving: true,
      },
    }
    expect(step(rolling, 0.016).holed).toBe(true)
  })

  it("lips out when the ball is travelling too fast", () => {
    const base = createGame(1)
    const quick: Game = {
      ...base,
      ball: {
        x: base.hole.pinX,
        y: groundAt(base.hole, base.hole.pinX),
        vx: CUP_SPEED * 3,
        vy: 0,
        moving: true,
      },
    }
    expect(step(quick, 0.016).holed).toBe(false)
  })

  /** A ball flying over the pin at height is not in the hole. */
  it("does not drop from the air above the cup", () => {
    const base = createGame(1)
    const airborne: Game = {
      ...base,
      ball: {
        x: base.hole.pinX,
        y: groundAt(base.hole, base.hole.pinX) + 9,
        vx: 1,
        vy: 0,
        moving: true,
      },
    }
    expect(step(airborne, 0.016).holed).toBe(false)
  })

  it("can be holed out by actually playing the hole", () => {
    // Walk the ball in from the fringe with putts until it drops.
    let g = createGame(1)
    g = { ...g, ball: { ...g.ball, x: g.hole.pinX - 18, y: groundAt(g.hole, g.hole.pinX - 18) } }
    for (let i = 0; i < 40 && !g.holed; i++) {
      const d = distanceToPin(g)
      g = settle(swing(g, Math.min(0.5, 0.06 + d * 0.011), 12))
    }
    expect(g.holed, `${distanceToPin(g).toFixed(2)} m from the pin`).toBe(true)
  })

  it("refuses further swings once holed", () => {
    const g = { ...createGame(1), holed: true }
    expect(swing(g, 0.5, 30)).toBe(g)
  })

  it("reports the distance left to the pin", () => {
    const g = createGame(1)
    expect(distanceToPin(g)).toBeCloseTo(g.hole.pinX, 6)
  })
})

describe("the round", () => {
  it("banks the score and moves on", () => {
    const g = { ...createGame(1), strokes: 4, holed: true }
    const next = nextHole(g)
    expect(next.holeNumber).toBe(2)
    expect(next.completed).toEqual([{ strokes: 4, par: g.hole.par }])
    expect(next.strokes).toBe(0)
    expect(next.holed).toBe(false)
  })

  it("stops advancing after the last hole", () => {
    const g = { ...createGame(HOLES), strokes: 4, holed: true }
    const next = nextHole(g)
    expect(next.holeNumber).toBe(HOLES)
    expect(next.completed).toHaveLength(1)
  })

  it("totals strokes against par", () => {
    const g: Game = {
      ...createGame(1),
      completed: [
        { strokes: 3, par: 4 },
        { strokes: 6, par: 5 },
        { strokes: 3, par: 3 },
      ],
    }
    expect(toPar(g)).toBe(0)
  })
})

describe("scoreName", () => {
  it("names the usual scores", () => {
    expect(scoreName(1, 4)).toBe("hole in one")
    expect(scoreName(2, 4)).toBe("eagle")
    expect(scoreName(3, 4)).toBe("birdie")
    expect(scoreName(4, 4)).toBe("par")
    expect(scoreName(5, 4)).toBe("bogey")
    expect(scoreName(6, 4)).toBe("double bogey")
  })

  it("calls a one an ace even on a par 5", () => {
    expect(scoreName(1, 5)).toBe("hole in one")
  })

  it("falls back to a number for a blow-up hole", () => {
    expect(scoreName(9, 4)).toBe("+5")
  })
})

describe("facing", () => {
  it("plays up the hole from the tee", () => {
    expect(facing(createGame(1))).toBe(1)
  })

  /* The bug: every shot went right, so overshooting the green left the hole
     unplayable — you could only hit further past it. */
  it("turns round once the ball is past the pin", () => {
    const g = createGame(1)
    const past = { ...g, ball: { ...g.ball, x: g.hole.pinX + 30 } }
    expect(facing(past)).toBe(-1)
  })

  it("sends the ball back toward the pin when it has overshot", () => {
    const g = createGame(1)
    const past = {
      ...g,
      ball: { ...g.ball, x: g.hole.pinX + 30, y: groundAt(g.hole, g.hole.pinX + 30) },
    }
    expect(swing(past, 0.5, 30).ball.vx).toBeLessThan(0)
  })

  it("closes on the pin from beyond it", () => {
    const g = createGame(1)
    const start = g.hole.pinX + 40
    const past = { ...g, ball: { ...g.ball, x: start, y: groundAt(g.hole, start) } }
    const after = settle(swing(past, 0.32, 24))
    expect(distanceToPin(after)).toBeLessThan(distanceToPin(past))
  })
})
