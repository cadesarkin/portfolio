import { describe, it, expect } from "vitest"
import {
  LAUNCH,
  MAX_CREW,
  carryAt,
  countdownAt,
  crewFor,
  figure,
  liftAt,
  mirror,
  stageFor,
  width,
  type Action,
  type Stage,
} from "./crash-site"

const LEVELS = 15
const every = Array.from({ length: LEVELS + 1 }, (_, r) => r)

/** Every character cell a stage's art covers, as "x,bottom". */
function cells(stage: Stage): Set<string> {
  const out = new Set<string>()
  for (const l of stage.layers) {
    l.art.forEach((line, i) => {
      const row = l.bottom + l.art.length - 1 - i
      ;[...line].forEach((ch, j) => ch !== " " && out.add(`${l.x + j},${row}`))
    })
  }
  return out
}

describe("the site, level by level", () => {
  it("goes from wreck to ship in order, and never backwards", () => {
    const order = ["wreck", "found", "propped", "patched", "assembly", "pad", "ready"]
    const ids = every.map((r) => order.indexOf(stageFor(r, false, LEVELS).id))
    expect(ids[0]).toBe(0)
    expect(ids[LEVELS]).toBe(order.length - 1)
    ids.forEach((id, i) => i > 0 && expect(id).toBeGreaterThanOrEqual(ids[i - 1]))
  })

  it("spreads its stages over however many levels the game has", () => {
    const ids = (levels: number) =>
      [0, 0.2, 0.4, 0.6, 0.8, 1].map((share) => stageFor(Math.round(levels * share), false, levels).id)
    const expected = ["wreck", "propped", "patched", "assembly", "pad", "ready"]
    expect(ids(15)).toEqual(expected)
    expect(ids(30)).toEqual(expected)
    // A long game does not finish the ship halfway through.
    expect(stageFor(15, false, 30).id).not.toBe("ready")
  })

  it("stands empty once the ship has gone", () => {
    const gone = stageFor(LEVELS, true, LEVELS)
    expect(gone.id).toBe("gone")
    expect(gone.layers.some((l) => l.id === "rocket")).toBe(false)
  })

  it("sends one more person per level, up to as many as there is room for", () => {
    expect(every.map((r) => crewFor(r, false))).toEqual(every.map((r) => Math.min(r, MAX_CREW)))
    expect(crewFor(0, true)).toBe(MAX_CREW)
  })

  it("has somewhere for everyone to work", () => {
    for (const r of every) {
      expect(stageFor(r, false, LEVELS).stations.length).toBeGreaterThanOrEqual(crewFor(r, false))
    }
  })

  it("puts the fire out as the crew work", () => {
    const flame = every.map((r) => stageFor(r, false, LEVELS).fire.flame)
    flame.forEach((f, i) => i > 0 && expect(f).toBeLessThanOrEqual(flame[i - 1]))
    expect(flame[0]).toBe(1)
    expect(flame[LEVELS]).toBe(0)
  })

  /* People standing in the middle of the scaffolding read as a mess of
     glyphs rather than as people. */
  it("never stands anyone inside the art", () => {
    for (const r of [...every, -1]) {
      const stage = r < 0 ? stageFor(LEVELS, true, LEVELS) : stageFor(r, false, LEVELS)
      const art = cells(stage)
      stage.stations.slice(0, crewFor(Math.max(r, 0), r < 0)).forEach((st, i) => {
        const xs = st.span ?? [st.x, st.x]
        for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
          // The body: the three lines under the head, a column either side.
          for (let row = st.bottom; row < st.bottom + 3; row++) {
            for (let dx = -1; dx <= 1; dx++) {
              expect(art.has(`${x + dx},${row}`), `${stage.id}: crew ${i} at ${x + dx},${row}`).toBe(false)
            }
          }
        }
      })
    }
  })

  it("stays within reach of the crater on a small screen", () => {
    for (const r of [...every, -1]) {
      const stage = r < 0 ? stageFor(LEVELS, true, LEVELS) : stageFor(r, false, LEVELS)
      const right = Math.max(
        ...stage.layers.map((l) => l.x + width(l.art)),
        ...stage.stations.map((s) => Math.max(s.x, ...(s.span ?? [])) + 2)
      )
      // The crater sits at 80% of the width: a fifth of a 1200px screen, in
      // 7.5px characters, is 32 of them.
      expect(right, stage.id).toBeLessThanOrEqual(32)
    }
  })
})

describe("the crew", () => {
  const actions: (Action | "walk")[] = ["walk", "look", "hammer", "weld", "carry", "cheer", "wave"]

  it("draws every figure four lines tall, whichever way it faces", () => {
    for (const a of actions) {
      for (const t of [0, 0.3, 0.7, 1.4, 2.9]) {
        for (const facing of [1, -1] as const) {
          const f = figure(a, t, facing)
          expect(f, a).toHaveLength(4)
          expect(width(f)).toBeLessThanOrEqual(4)
        }
      }
    }
  })

  it("turns a figure round by mirroring it", () => {
    expect(mirror(["/o(", "[_>"])).toEqual([")o\\", "<_]"])
    const f = figure("hammer", 0, 1)
    expect(mirror(mirror(f))).toEqual(f.map((l) => l.padEnd(width(f))))
  })

  it("carries back and forth between the two ends, pausing at each", () => {
    const span: [number, number] = [-30, -20]
    const seen = new Set<number>()
    for (let t = 0; t < 12; t += 0.05) {
      const c = carryAt(span, t)
      expect(c.x).toBeGreaterThanOrEqual(-30)
      expect(c.x).toBeLessThanOrEqual(-20)
      if (!c.moving) seen.add(c.x)
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-30, -20])
  })
})

describe("the launch", () => {
  it("counts down, then lifts off", () => {
    expect([0, 1.2, 2.5].map(countdownAt)).toEqual(["3", "2", "1"])
    expect(countdownAt(LAUNCH.lift)).toBe("liftoff")
    expect(countdownAt(LAUNCH.gone)).toBeNull()
  })

  it("sits still on the pad until lift, then climbs faster and faster", () => {
    expect(liftAt(0, 720)).toBe(0)
    expect(liftAt(LAUNCH.lift, 720)).toBe(0)
    const a = liftAt(LAUNCH.lift + 1, 720) - liftAt(LAUNCH.lift + 0.5, 720)
    const b = liftAt(LAUNCH.lift + 3, 720) - liftAt(LAUNCH.lift + 2.5, 720)
    expect(b).toBeGreaterThan(a)
  })

  it("is off the top of the screen by the time the wallpaper follows it", () => {
    expect(liftAt(LAUNCH.gone, 720)).toBeGreaterThan(720)
    expect(liftAt(LAUNCH.gone, 1440)).toBeGreaterThan(1440)
  })
})
