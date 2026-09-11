import { describe, it, expect } from "vitest"
import { CHAPTERS, LEVELS, MIN_VIEW, playCols, roomsOf, type Level } from "./levels"
import { CELL_H, TASKBAR_H, type Fragment } from "./engine"
import {
  apply,
  firstMoves,
  initialSim,
  placementsOf,
  playSolution,
  renderScreen,
  solvableOnFoot,
  type SimState,
} from "./simulate"

/** A big screen too: a level must not lean on the right or bottom edge being near. */
const BIG = { w: 1920, h: 1080 }

/** Every tile in a level holding one of these glyphs, as "room:x,y". */
function tilesOf(level: Level, glyphs: string): string[] {
  const out: string[] = []
  for (const f of Object.values(roomsOf(level))) {
    f.tiles.forEach((row, y) =>
      [...row].forEach((ch, x) => glyphs.includes(ch) && out.push(`${f.id}:${x},${y}`))
    )
  }
  return out
}

const floorNextTo = (f: Fragment, x: number, y: number): boolean =>
  [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ].some(([nx, ny]) => ".>@".includes(f.tiles[ny]?.[nx] ?? " "))

describe("the game", () => {
  it("has fifteen levels across its three chapters, in order", () => {
    expect(LEVELS).toHaveLength(15)
    const chapters = LEVELS.map((l) => l.chapter)
    expect([...chapters].sort()).toEqual(chapters)
    for (let c = 0; c < CHAPTERS.length; c++) expect(chapters).toContain(c)
  })

  it("never reuses a level id", () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length)
  })
})

describe("every level", () => {
  for (const level of LEVELS) {
    describe(level.name, () => {
      const frags = roomsOf(level)

      it("has exactly one start and one exit", () => {
        const all = Object.values(frags)
        expect(all.filter((f) => f.start)).toHaveLength(1)
        expect(all.filter((f) => f.exit)).toHaveLength(1)
      })

      /*
       * Any symbol not in the tile table is wall, which is what lets a room
       * carry art — and what makes a stray `$` in a picture a key. Every
       * special tile has to be one the level means.
       */
      it("only has special tiles where it means them", () => {
        for (const at of tilesOf(level, "$%")) {
          const [id, xy] = at.split(":")
          const [x, y] = xy.split(",").map(Number)
          expect(floorNextTo(frags[id], x, y), `${at} is not next to any floor`).toBe(true)
        }
        expect(tilesOf(level, "^").sort()).toEqual(Object.keys(level.triggers ?? {}).sort())
        expect(tilesOf(level, "?").sort()).toEqual(Object.keys(level.notes ?? {}).sort())
        const gates = tilesOf(level, "+=")
        const flips = Object.values(level.triggers ?? {}).some((t) =>
          t.some((x) => x.kind === "gates")
        )
        if (gates.length) expect(flips, `gates at ${gates[0]} but no switch flips them`).toBe(true)
        expect(tilesOf(level, "$").length).toBeGreaterThanOrEqual(tilesOf(level, "%").length)
      })

      it("can kill every process it names, and names only its own", () => {
        const pids = level.rooms.flatMap((r) => (r.pid ? [r.pid] : []))
        const named = Object.values(level.notes ?? {}).flatMap((n) => n.reveals ?? [])
        expect([...named].sort()).toEqual([...pids].sort())
      })

      /* The point of this file: a level that cannot be finished is the worst
         bug a puzzle game can ship, and it is invisible until someone has
         spent ten minutes finding out. */
      it("can be finished", () => {
        const out = playSolution(level, MIN_VIEW)
        const last = out.states[out.states.length - 1]
        const why = out.ok
          ? ""
          : `step ${out.at}: ${out.reason}\n${renderScreen(level, last, MIN_VIEW)}`
        expect(out.ok, why).toBe(true)
      })

      it("is not finished before the player touches anything", () => {
        expect(solvableOnFoot(level, initialSim(level), MIN_VIEW)).toBe(false)
      })

      /* Every level asks for at least two things to be done to the windows.
         Checked on a small and a big screen, since a big one leaves room a
         level might have been counting on not being there. */
      for (const view of [MIN_VIEW, BIG]) {
        it(`cannot be finished with one move on a ${view.w}×${view.h} screen`, () => {
          const s0 = initialSim(level)
          const winner = firstMoves(level, s0, view).find((m) =>
            solvableOnFoot(level, apply(level, s0, m, view), view)
          )
          expect(winner).toBeUndefined()
        })
      }

      it("fits on the smallest supported screen, from start to finish", () => {
        const out = playSolution(level, MIN_VIEW)
        const rows = Math.floor((MIN_VIEW.h - TASKBAR_H) / CELL_H)
        const check = (s: SimState, when: string) => {
          for (const p of placementsOf(level, s)) {
            const where = `${p.frag} ${when}`
            expect(p.outer.x, where).toBeGreaterThanOrEqual(0)
            expect(p.outer.y, where).toBeGreaterThanOrEqual(0)
            expect(p.body.x + p.body.w, where).toBeLessThanOrEqual(playCols(MIN_VIEW) * 10)
            expect(p.body.y + p.body.h, where).toBeLessThanOrEqual(rows * CELL_H)
          }
        }
        out.states.forEach((s, i) => check(s, `after step ${i}`))
        for (const r of level.rooms) {
          if (r.hostile?.kind !== "wander") continue
          let s = initialSim(level)
          r.hostile.spots.forEach((_, i) => {
            s = apply(level, s, { hostile: r.id, state: i }, MIN_VIEW)
            check(s, `at spot ${i}`)
          })
        }
      })

      it("only lets hostile windows do what their timers would", () => {
        const last: Record<string, number | string> = {}
        for (const r of level.rooms) {
          if (r.hostile?.kind === "wander") last[r.id] = 0
          if (r.hostile?.kind === "blink") last[r.id] = "up"
        }
        for (const m of level.solution) {
          if (!("hostile" in m)) continue
          const h = level.rooms.find((r) => r.id === m.hostile)!.hostile!
          if (h.kind === "wander") {
            expect(m.state, `${m.hostile} hops in order`).toBe(
              ((last[m.hostile] as number) + 1) % h.spots.length
            )
          }
          if (h.kind === "blink") expect(m.state).not.toBe(last[m.hostile])
          last[m.hostile] = m.state ?? ""
        }
      })
    })
  }
})

/* What each level is there to teach, checked: the lesson has to be the only
   way through, or the level teaches nothing. */
describe("lessons", () => {
  const byId = (id: string) => LEVELS.find((l) => l.id === id)!

  it("ferry: no room placed anywhere makes a bridge", () => {
    const level = byId("ferry")
    const s0 = initialSim(level)
    const bridges = firstMoves(level, s0, BIG).filter(
      (m) => "place" in m && solvableOnFoot(level, apply(level, s0, m, BIG), BIG)
    )
    expect(bridges).toEqual([])
  })

  it("tuck: the right layout with the wrong window in front does not work", () => {
    const level = byId("tuck")
    let s = initialSim(level)
    // The solution's drags, the other way round: the lower room ends up in front.
    s = apply(level, s, { place: "b", col: 22, row: 3 }, MIN_VIEW)
    s = apply(level, s, { place: "c", col: 26, row: 11 }, MIN_VIEW)
    expect(solvableOnFoot(level, s, MIN_VIEW)).toBe(false)
    s = apply(level, s, { raise: "b" }, MIN_VIEW)
    expect(solvableOnFoot(level, s, MIN_VIEW)).toBe(true)
  })

  it("cut: the pipe does not fit the gap uncut", () => {
    const level = byId("cut")
    const s0 = initialSim(level)
    for (let row = 2; row < 20; row++) {
      for (let col = 1; col < 40; col++) {
        const s = apply(level, s0, { place: "m", col, row }, MIN_VIEW)
        expect(solvableOnFoot(level, s, MIN_VIEW), `pipe at ${col},${row}`).toBe(false)
      }
    }
  })

  it("keys: the door will not open without the key", () => {
    const level = byId("keys")
    let s = initialSim(level)
    s = apply(level, s, { place: "d", col: 17, row: 8 }, MIN_VIEW)
    expect(solvableOnFoot(level, s, MIN_VIEW)).toBe(false)
  })

  it("kill: the pid cannot be killed before a note has named it", () => {
    const level = byId("kill")
    expect(() => apply(level, initialSim(level), { kill: 4127 }, MIN_VIEW)).toThrow(/not found/)
  })

  it("fragmentation: the held room will not move until the switch lets it go", () => {
    const level = byId("fragmentation")
    const move = { place: "l", col: 22, row: 9 }
    expect(() => apply(level, initialSim(level), move, MIN_VIEW)).toThrow(/will not move/)
  })

  it("blink: the key cannot be reached while the blinking window is up", () => {
    const level = byId("blink")
    let s = initialSim(level)
    s = apply(level, s, { place: "c", col: 7, row: 9 }, MIN_VIEW)
    s = apply(level, s, { raise: "a" }, MIN_VIEW)
    expect(() => apply(level, s, { walk: { room: "k", x: 12, y: 1 } }, MIN_VIEW)).toThrow()
    s = apply(level, s, { hostile: "q", state: "down" }, MIN_VIEW)
    expect(() => apply(level, s, { walk: { room: "k", x: 12, y: 1 } }, MIN_VIEW)).not.toThrow()
  })
})
