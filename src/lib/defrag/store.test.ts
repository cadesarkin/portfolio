import { describe, it, expect, beforeEach } from "vitest"
import { newWorld } from "./engine"
import { LEVELS, startOf } from "./levels"
import { getState, initialState, killProcess, processes, setState } from "./store"
import { run } from "@/components/apps/terminal/commands"

const KILL = LEVELS.findIndex((l) => l.id === "kill")
const text = (r: ReturnType<typeof run>) => (r.lines ?? []).map((l) => l.text).join("\n")

/** The kill level, running, with its note read or not. */
function playing(read: boolean) {
  const level = LEVELS[KILL]
  const note = Object.keys(level.notes ?? {})[0]
  setState({
    ...initialState,
    level: KILL,
    status: "playing",
    player: startOf(level),
    world: { ...newWorld(), read: read ? [note] : [] },
  })
}

beforeEach(() => setState(initialState))

describe("processes", () => {
  it("lists nothing of the game while no level is running", () => {
    expect(processes()).toEqual([])
  })

  it("lists a level's processes, pid unknown until a note names it", () => {
    playing(false)
    expect(processes()).toEqual([{ pid: 4127, name: "watchdog.sys", known: false }])
    playing(true)
    expect(processes()[0].known).toBe(true)
  })
})

describe("killing a process", () => {
  it("will not kill a pid nobody has found written down", () => {
    playing(false)
    expect(killProcess(4127).ok).toBe(false)
    expect(getState().world.killed).toEqual([])
  })

  it("kills a pid that has been found, once", () => {
    playing(true)
    expect(killProcess(4127)).toMatchObject({ ok: true })
    expect(getState().world.killed).toEqual(["w"])
    expect(killProcess(4127).ok).toBe(false)
    expect(processes()).toEqual([])
  })

  it("will not kill the room the player is standing in", () => {
    playing(true)
    setState({ player: { frag: "w", x: 1, y: 1 } })
    expect(killProcess(4127).message).toMatch(/standing in it/)
  })
})

describe("the terminal", () => {
  it("shows a level's process with its pid hidden until found", () => {
    playing(false)
    const out = text(run("ps", "/"))
    expect(out).toContain("watchdog.sys")
    expect(out).toContain("????")
    expect(out).not.toContain("4127")
  })

  it("kills from the command line", () => {
    playing(true)
    expect(text(run("kill 4127", "/"))).toContain("killed")
    expect(getState().world.killed).toEqual(["w"])
  })

  it("takes a signal flag and ignores it", () => {
    playing(true)
    expect(text(run("kill -9 4127", "/"))).toContain("killed")
  })

  it("will not kill the desktop's own processes", () => {
    expect(text(run("kill 88", "/"))).toMatch(/not permitted/)
  })

  it("explains itself when used wrong", () => {
    expect(text(run("kill", "/"))).toMatch(/usage/)
    expect(text(run("kill banana", "/"))).toMatch(/usage/)
    expect(text(run("kill 55555", "/"))).toMatch(/no such process/)
  })
})
