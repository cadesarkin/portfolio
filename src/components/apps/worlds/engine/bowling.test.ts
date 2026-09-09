import { describe, it, expect } from "vitest"
import {
  createGame,
  roll,
  scorecard,
  total,
  resolveRoll,
  isStrike,
  isSpare,
  PIN_COUNT,
  PIN_LAYOUT,
  HIT_RADIUS,
  type Game,
  type Roll,
} from "./bowling"

/** Rolls `n` pins, choosing any n that are still standing. */
function rollPins(g: Game, n: number): Game {
  const felled = new Array(PIN_COUNT).fill(false)
  let left = n
  for (let i = 0; i < PIN_COUNT && left > 0; i++) {
    if (g.standing[i]) {
      felled[i] = true
      left--
    }
  }
  return roll(g, felled)
}

const play = (...counts: number[]): Game =>
  counts.reduce((g, n) => rollPins(g, n), createGame())

describe("scoring", () => {
  it("adds open frames", () => {
    // 3+4 then 2+5 = 14
    const g = play(3, 4, 2, 5)
    expect(scorecard(g)[0]).toBe(7)
    expect(scorecard(g)[1]).toBe(14)
  })

  /** The rule that a naive implementation gets wrong. */
  it("adds the next two rolls to a strike", () => {
    const g = play(10, 4, 3)
    // Frame 1: 10 + 4 + 3 = 17. Frame 2: 17 + 7 = 24.
    expect(scorecard(g)[0]).toBe(17)
    expect(scorecard(g)[1]).toBe(24)
  })

  it("adds the next roll to a spare", () => {
    const g = play(7, 3, 5, 2)
    // Frame 1: 10 + 5 = 15. Frame 2: 15 + 7 = 22.
    expect(scorecard(g)[0]).toBe(15)
    expect(scorecard(g)[1]).toBe(22)
  })

  it("chains consecutive strikes", () => {
    const g = play(10, 10, 10, 4, 2)
    // F1: 10+10+10 = 30. F2: 30 + (10+10+4) = 54. F3: 54 + (10+4+2) = 70.
    expect(scorecard(g)[0]).toBe(30)
    expect(scorecard(g)[1]).toBe(54)
    expect(scorecard(g)[2]).toBe(70)
  })

  /** Showing a provisional total for an unresolved strike would be a lie. */
  it("leaves a frame unscored until its bonus arrives", () => {
    const g = play(10)
    expect(scorecard(g)[0]).toBeNull()
    const g2 = play(10, 4)
    expect(scorecard(g2)[0]).toBeNull()
    const g3 = play(10, 4, 3)
    expect(scorecard(g3)[0]).toBe(17)
  })

  it("leaves an incomplete open frame unscored", () => {
    expect(scorecard(play(4))[0]).toBeNull()
  })

  it("scores a perfect game as 300", () => {
    const g = play(...Array(12).fill(10))
    expect(g.over).toBe(true)
    expect(total(g)).toBe(300)
  })

  it("scores all spares with a five bonus as 150", () => {
    // 21 rolls of 5: every frame is a spare worth 15.
    const g = play(...Array(21).fill(5))
    expect(g.over).toBe(true)
    expect(total(g)).toBe(150)
  })

  it("scores a gutter game as 0", () => {
    const g = play(...Array(20).fill(0))
    expect(g.over).toBe(true)
    expect(total(g)).toBe(0)
  })

  it("scores a nine-and-miss game as 90", () => {
    const g = play(...Array(10).fill([9, 0]).flat())
    expect(total(g)).toBe(90)
  })
})

describe("frame progression", () => {
  it("advances after two rolls", () => {
    expect(play(3, 4).current).toBe(1)
  })

  it("advances immediately on a strike", () => {
    expect(play(10).current).toBe(1)
  })

  it("resets the rack between frames", () => {
    expect(play(3, 4).standing.every(Boolean)).toBe(true)
  })

  it("keeps the rack standing between the two rolls of a frame", () => {
    const g = play(3)
    expect(g.standing.filter(Boolean).length).toBe(PIN_COUNT - 3)
  })

  it("ends after ten open frames", () => {
    const g = play(...Array(20).fill(4))
    expect(g.over).toBe(true)
    expect(g.frames.every((f) => f.rolls.length === 2)).toBe(true)
  })

  it("ignores rolls once the game is over", () => {
    const g = play(...Array(20).fill(0))
    expect(rollPins(g, 5)).toBe(g)
  })
})

describe("the tenth frame", () => {
  it("grants a third roll after a strike", () => {
    const g = play(...Array(18).fill(0), 10, 5)
    expect(g.over).toBe(false)
    const done = rollPins(g, 3)
    expect(done.over).toBe(true)
    expect(done.frames[9].rolls).toEqual([10, 5, 3])
  })

  it("grants a third roll after a spare", () => {
    const g = play(...Array(18).fill(0), 6, 4)
    expect(g.over).toBe(false)
    expect(rollPins(g, 7).over).toBe(true)
  })

  it("stops at two rolls on an open tenth", () => {
    expect(play(...Array(18).fill(0), 4, 3).over).toBe(true)
  })

  /** A bonus roll needs pins to knock down. */
  it("re-racks after a strike so the bonus rolls have pins", () => {
    const g = play(...Array(18).fill(0), 10)
    expect(g.standing.every(Boolean)).toBe(true)
  })
})

describe("isStrike and isSpare", () => {
  it("recognises a strike", () => {
    expect(isStrike({ rolls: [10] })).toBe(true)
    expect(isStrike({ rolls: [9, 1] })).toBe(false)
  })

  it("recognises a spare, and does not call a strike one", () => {
    expect(isSpare({ rolls: [9, 1] })).toBe(true)
    expect(isSpare({ rolls: [10] })).toBe(false)
    expect(isSpare({ rolls: [4, 5] })).toBe(false)
  })
})

describe("pin layout", () => {
  it("racks ten pins in four rows", () => {
    expect(PIN_LAYOUT).toHaveLength(PIN_COUNT)
    expect(new Set(PIN_LAYOUT.map((p) => p.y)).size).toBe(4)
  })

  it("puts the head pin at the front and centre", () => {
    expect(PIN_LAYOUT[0].x).toBeCloseTo(0, 6)
    expect(PIN_LAYOUT[0].y).toBeCloseTo(0, 6)
  })
})

describe("resolveRoll", () => {
  const full = () => new Array(PIN_COUNT).fill(true)
  const seeded = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  it("fells nothing on a gutter ball", () => {
    expect(resolveRoll(full(), -5, seeded(1)).filter(Boolean)).toHaveLength(0)
  })

  it("fells pins on a hit down the middle", () => {
    expect(resolveRoll(full(), 0, seeded(1)).filter(Boolean).length).toBeGreaterThan(0)
  })

  it("never fells a pin that is already down", () => {
    const standing = full()
    standing[0] = false
    expect(resolveRoll(standing, 0, seeded(2))[0]).toBe(false)
  })

  it("can strike from a pocket hit", () => {
    let struck = false
    for (let s = 1; s <= 60 && !struck; s++) {
      if (resolveRoll(full(), 0.05, seeded(s)).every(Boolean)) struck = true
    }
    expect(struck, "a pocket hit should sometimes strike").toBe(true)
  })

  it("does not always strike — the game needs spares to exist", () => {
    let opens = 0
    for (let s = 1; s <= 60; s++) {
      if (!resolveRoll(full(), 0.05, seeded(s)).every(Boolean)) opens++
    }
    expect(opens).toBeGreaterThan(0)
  })

  it("never returns more fallen pins than were standing", () => {
    const standing = full()
    standing[3] = false
    standing[7] = false
    for (let s = 1; s <= 30; s++) {
      const felled = resolveRoll(standing, 0, seeded(s))
      for (let i = 0; i < PIN_COUNT; i++) {
        if (!standing[i]) expect(felled[i]).toBe(false)
      }
    }
  })
})

describe("how often a roll strikes", () => {
  const full = () => new Array(PIN_COUNT).fill(true)

  /** Strike rate over many random deliveries of the same shape. */
  const strikeRate = (roll: Roll, n = 4000): number => {
    let strikes = 0
    for (let i = 0; i < n; i++) {
      if (resolveRoll(full(), roll).every(Boolean)) strikes++
    }
    return strikes / n
  }

  /* The bug this pins down: chaining neighbours at a flat probability cleared
     the rack on ~88% of deliveries, and on 70% of ones aimed well off line. */
  it("does not strike on most throws", () => {
    expect(strikeRate({ x: 0.09 })).toBeLessThan(0.55)
  })

  it("still strikes often enough to be worth aiming for", () => {
    expect(strikeRate({ x: 0.09 })).toBeGreaterThan(0.2)
  })

  it("rewards the pocket over a ball out by the corner", () => {
    expect(strikeRate({ x: 0.09 })).toBeGreaterThan(strikeRate({ x: 0.38 }) * 2)
  })

  it("almost never strikes from the edge of the rack", () => {
    expect(strikeRate({ x: 0.38 })).toBeLessThan(0.2)
  })

  it("never strikes from a ball that misses the rack entirely", () => {
    expect(strikeRate({ x: 0.9 })).toBe(0)
  })

  it("carries more pins at full power than at a crawl", () => {
    const hard = strikeRate({ x: 0.09, power: 1 })
    const soft = strikeRate({ x: 0.09, power: 0.15 })
    expect(hard).toBeGreaterThan(soft)
  })
})

describe("curve", () => {
  const full = () => new Array(PIN_COUNT).fill(true)
  const avgPins = (roll: Roll, n = 4000): number => {
    let total = 0
    for (let i = 0; i < n; i++) total += resolveRoll(full(), roll).filter(Boolean).length
    return total / n
  }

  it("bends a wide ball back into the rack", () => {
    // Starting outside the pins, hooking in beats holding the line.
    expect(avgPins({ x: 0.3, curve: -0.35 })).toBeGreaterThan(avgPins({ x: 0.3, curve: 0 }))
  })

  it("takes a good line away when it hooks the wrong way", () => {
    expect(avgPins({ x: 0.2, curve: 0.45 })).toBeLessThan(avgPins({ x: 0.2, curve: 0 }))
  })

  it("treats a bare number as a straight ball", () => {
    const seeded = (seed: number) => () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    expect(resolveRoll(full(), 0.09, seeded(4))).toEqual(
      resolveRoll(full(), { x: 0.09, curve: 0, power: 1 }, seeded(4))
    )
  })
})

describe("HIT_RADIUS", () => {
  it("is narrower than the gap between two pins", () => {
    const gap = Math.abs(PIN_LAYOUT[1].x - PIN_LAYOUT[2].x)
    expect(HIT_RADIUS).toBeLessThan(gap)
  })
})
