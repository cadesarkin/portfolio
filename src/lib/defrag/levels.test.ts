import { describe, it, expect } from "vitest"
import { CONTROLLER_W, LEVELS, MIN_VIEW, fragmentsOf, startOf, type Level } from "./levels"
import {
  CELL_W,
  CELL_H,
  CHROME,
  TASKBAR_H,
  placementAt,
  step,
  type Dir,
  type Placement,
  type Player,
} from "./engine"

const VIEW = { w: 1280, h: 720 }
const DIRS: Dir[] = ["up", "down", "left", "right"]

/** Every window of a level laid out, with an optional stacking order. */
function layout(
  level: Level,
  where: "start" | "solution",
  order?: string[]
): Placement[] {
  const frags = fragmentsOf(level)
  return level.fragments.map((f, i) => {
    const cell =
      where === "solution" && !f.locked ? (level.solution.at[f.id] ?? f.at) : f.at
    const rank = order ? order.indexOf(f.id) : i
    // On-top windows sit above everything, as the window manager draws them.
    const z = (f.onTop ? 1000 : 0) + (rank < 0 ? i : rank)
    return placementAt(`defrag:${f.id}`, frags[f.id], cell.col, cell.row, z)
  })
}

/** Can the player walk from the start to the exit in this layout? */
function solvable(level: Level, placements: Placement[]): boolean {
  const frags = fragmentsOf(level)
  const start = startOf(level)
  const key = (p: Player) => `${p.frag}:${p.x},${p.y}`
  const seen = new Set([key(start)])
  const queue: Player[] = [start]
  while (queue.length) {
    const here = queue.shift()!
    for (const dir of DIRS) {
      const r = step(here, dir, placements, frags, VIEW)
      if (!r.moved) continue
      if (r.won) return true
      if (seen.has(key(r.player))) continue
      seen.add(key(r.player))
      queue.push(r.player)
    }
  }
  return false
}

describe("every level", () => {
  for (const level of LEVELS) {
    describe(level.name, () => {
      it("has exactly one start and one exit", () => {
        const frags = Object.values(fragmentsOf(level))
        expect(frags.filter((f) => f.start)).toHaveLength(1)
        expect(frags.filter((f) => f.exit)).toHaveLength(1)
      })

      /* The point of the test file: a level that cannot be finished is the
         worst bug a puzzle game can ship, and it is invisible until someone
         spends ten minutes finding out. */
      it("can be finished", () => {
        expect(solvable(level, layout(level, "solution", level.solution.order))).toBe(true)
      })

      it("is not finished before the player moves anything", () => {
        expect(solvable(level, layout(level, "start"))).toBe(false)
      })

      it("fits on the smallest supported screen", () => {
        for (const where of ["start", "solution"] as const) {
          for (const p of layout(level, where)) {
            expect(p.outer.x, `${p.id} ${where}`).toBeGreaterThanOrEqual(0)
            expect(p.outer.y, `${p.id} ${where}`).toBeGreaterThanOrEqual(0)
            expect(p.outer.x + p.outer.w, `${p.id} ${where}`).toBeLessThanOrEqual(
              MIN_VIEW.w - CONTROLLER_W - 16
            )
            expect(p.outer.y + p.outer.h, `${p.id} ${where}`).toBeLessThanOrEqual(
              MIN_VIEW.h - TASKBAR_H
            )
          }
        }
      })

      it("only asks to move windows that can move", () => {
        for (const id of Object.keys(level.solution.at)) {
          const f = level.fragments.find((x) => x.id === id)
          expect(f, id).toBeDefined()
          expect(f!.locked, `${id} is locked but the solution moves it`).toBeFalsy()
        }
      })
    })
  }
})

describe("what each level teaches", () => {
  /* "tuck" exists to teach that going down needs the upper window on top.
     If it could be solved with the lower window on top, it would not. */
  it("tuck cannot be crossed with the lower window on top", () => {
    const tuck = LEVELS.find((l) => l.id === "tuck")!
    expect(solvable(tuck, layout(tuck, "solution", ["c", "a", "b"]))).toBe(false)
    expect(solvable(tuck, layout(tuck, "solution", ["c", "b", "a"]))).toBe(true)
  })

  /* "watchdog" puts a window over the obvious straight route. The straight
     corridor must genuinely be blocked, or the level teaches nothing. */
  it("watchdog blocks the straight corridor", () => {
    const wd = LEVELS.find((l) => l.id === "watchdog")!
    const frags = fragmentsOf(wd)
    const placements = layout(wd, "solution")
    // Stand at the left end of the bridge's top corridor and try to walk
    // along it: the watchdog covers the rest.
    const r = step({ frag: "b", x: 1, y: 1 }, "right", placements, frags, VIEW)
    expect(r.moved).toBe(false)
    expect(r.blocked).toBe("hidden")
  })

  it("keeps the chrome the rules assume", () => {
    // Layouts are designed in cells around these numbers; if they change,
    // every level needs re-checking, so fail loudly here.
    expect(CELL_W).toBe(10)
    expect(CELL_H).toBe(20)
    expect(CHROME.top).toBe(34)
  })
})

describe("no shortcuts", () => {
  /* The concept is that rooms join where their edges line up. If overlapping
     two rooms also joined them, every level could be skipped by dropping the
     exit room on top of the start room — so this checks, for every level,
     that no single placement of the exit room onto the start room wins. */
  for (const level of LEVELS) {
    it(`${level.name} cannot be skipped by stacking the exit room on the start room`, () => {
      const frags = fragmentsOf(level)
      const start = startOf(level)
      const exitFrag = Object.values(frags).find((f) => f.exit)!
      const startDef = level.fragments.find((f) => f.id === start.frag)!
      const exitDef = level.fragments.find((f) => f.id === exitFrag.id)!
      if (exitDef.locked) return

      const base = layout(level, "start")
      const startP = base.find((p) => p.id === `defrag:${start.frag}`)!
      const s = frags[start.frag]
      let skipped = false
      // Every overlapping offset of the exit room over the start room.
      for (let dc = -exitFrag.cols + 1; dc < s.cols && !skipped; dc++) {
        for (let dr = -exitFrag.rows + 1; dr < s.rows && !skipped; dr++) {
          const col = startDef.at.col + dc
          const row = startDef.at.row + dr
          if (col < 0 || row < 3) continue
          const moved = base.map((p) =>
            p.id === `defrag:${exitFrag.id}`
              ? placementAt(p.id, exitFrag, col, row, startP.z + 50)
              : p
          )
          if (solvable(level, moved)) skipped = true
        }
      }
      expect(skipped).toBe(false)
    })
  }
})
