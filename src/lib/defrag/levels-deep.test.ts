import { describe, it, expect } from "vitest"
import { LEVELS, lightsJoins } from "./levels"
import { hunt } from "./hunt"

/** Generous to the hunter: the biggest screen gives it the most room to find a shortcut. */
const BIG = { w: 1920, h: 1080 }

const deep = LEVELS.filter((l) => !lightsJoins(l))

describe("the deep end", () => {
  it("is there, and every level of it says how hard it should be", () => {
    expect(deep.length).toBeGreaterThan(0)
    for (const l of deep) expect(l.par, l.id).toBeGreaterThanOrEqual(3)
  })

  it("gets no easier as it goes on, chapter by chapter", () => {
    const byChapter = new Map<number, number[]>()
    for (const l of deep) byChapter.set(l.chapter, [...(byChapter.get(l.chapter) ?? []), l.par!])
    const chapters = [...byChapter.keys()].sort()
    for (let i = 1; i < chapters.length; i++) {
      const before = Math.max(...byChapter.get(chapters[i - 1])!)
      const after = Math.max(...byChapter.get(chapters[i])!)
      expect(after).toBeGreaterThanOrEqual(before)
    }
  })

  /* The point of par: the first chapters could be finished in two or three
     drags each, which is why they took minutes. Here the hunter looks for
     anything shorter than par, and a level it can beat has to be redesigned. */
  for (const level of deep) {
    it(`${level.name}: no shortcut under par ${level.par}`, () => {
      const r = hunt(level, { view: BIG, maxMoves: level.par! - 1 })
      expect(r.solved, JSON.stringify(r.moves)).toBe(false)
    }, 120_000)
  }
})
