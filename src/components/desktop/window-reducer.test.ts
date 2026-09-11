import { describe, it, expect } from "vitest"
import {
  windowReducer as r,
  initialWindowState as init,
  stackOrder,
  type WindowState,
} from "./window-reducer"
import { resolve } from "@/lib/vfs-utils"
import type { VNode } from "@/lib/vfs-types"

const work = resolve("/work", "/")!
const projects = resolve("/projects", "/")!
const about = resolve("/about", "/")!

const open = (s: WindowState, n: VNode = work) => r(s, { type: "OPEN", node: n })

describe("windowReducer", () => {
  it("opens a window keyed by its vfs path", () => {
    const s = open(init)
    expect(s.wins).toHaveLength(1)
    expect(s.wins[0].id).toBe("/work")
    expect(s.focused).toBe("/work")
  })

  it("does not duplicate an already-open window", () => {
    const s = open(open(init))
    expect(s.wins).toHaveLength(1)
  })

  it("focuses and restores an open, minimized window instead of duplicating", () => {
    let s = open(init)
    s = r(s, { type: "MINIMIZE", id: "/work" })
    expect(s.wins[0].state).toBe("minimized")
    s = open(s)
    expect(s.wins).toHaveLength(1)
    expect(s.wins[0].state).toBe("normal")
    expect(s.focused).toBe("/work")
  })

  it("raises z on focus so the focused window is topmost", () => {
    let s = open(init)
    s = open(s, projects)
    s = r(s, { type: "FOCUS", id: "/work" })
    const top = [...s.wins].sort((a, b) => b.z - a.z)[0]
    expect(top.id).toBe("/work")
    expect(s.focused).toBe("/work")
  })

  it("cascades new windows so they do not stack exactly", () => {
    let s = open(init)
    s = open(s, projects)
    expect(s.wins[1].rect.x).not.toBe(s.wins[0].rect.x)
    expect(s.wins[1].rect.y).not.toBe(s.wins[0].rect.y)
  })

  it("restores to the pre-maximize rect", () => {
    let s = open(init)
    const before = { ...s.wins[0].rect }
    s = r(s, { type: "MAXIMIZE", id: "/work" })
    expect(s.wins[0].state).toBe("maximized")
    s = r(s, { type: "RESTORE", id: "/work" })
    expect(s.wins[0].state).toBe("normal")
    expect(s.wins[0].rect).toEqual(before)
  })

  it("restores a minimized window without losing its rect", () => {
    let s = open(init)
    const before = { ...s.wins[0].rect }
    s = r(s, { type: "MINIMIZE", id: "/work" })
    s = r(s, { type: "RESTORE", id: "/work" })
    expect(s.wins[0].rect).toEqual(before)
  })

  it("moves and resizes a window", () => {
    let s = open(init)
    s = r(s, { type: "MOVE", id: "/work", rect: { x: 10, y: 20 } })
    expect(s.wins[0].rect.x).toBe(10)
    expect(s.wins[0].rect.y).toBe(20)
    s = r(s, { type: "RESIZE", id: "/work", rect: { w: 500, h: 300 } })
    expect(s.wins[0].rect.w).toBe(500)
    expect(s.wins[0].rect.h).toBe(300)
  })

  it("focuses the next-highest window when the focused one closes", () => {
    let s = open(init)
    s = open(s, projects)
    s = r(s, { type: "CLOSE", id: "/projects" })
    expect(s.focused).toBe("/work")
  })

  it("skips minimized windows when picking the next focus", () => {
    let s = open(init)
    s = open(s, projects)
    s = open(s, about)
    s = r(s, { type: "MINIMIZE", id: "/projects" })
    s = r(s, { type: "FOCUS", id: "/about" })
    s = r(s, { type: "CLOSE", id: "/about" })
    expect(s.focused).toBe("/work")
  })

  it("clears focus when the last window closes", () => {
    let s = open(init)
    s = r(s, { type: "CLOSE", id: "/work" })
    expect(s.wins).toHaveLength(0)
    expect(s.focused).toBeNull()
  })

  it("clears focus when the focused window is minimized", () => {
    let s = open(init)
    s = r(s, { type: "MINIMIZE", id: "/work" })
    expect(s.focused).toBeNull()
  })

  it("ignores actions targeting an unknown id", () => {
    const s = r(open(init), { type: "CLOSE", id: "/nope" })
    expect(s.wins).toHaveLength(1)
  })

  it("minimizes every window at once", () => {
    let s = open(init)
    s = open(s, projects)
    s = r(s, { type: "MINIMIZE_ALL" })
    expect(s.wins.every((w) => w.state === "minimized")).toBe(true)
    expect(s.focused).toBeNull()
  })

  it("never opens a window for a link node", () => {
    const link = resolve("/work/vance/vance-ad.com", "/")!
    const s = open(init, link)
    expect(s.wins).toHaveLength(0)
  })

  it("titles a window from its label when one is set", () => {
    const s = open(init)
    expect(s.wins[0].title).toBe("work")
  })
})


/* ── Windows a program opens for itself ───────────────────────────────── */

describe("opening with options", () => {
  const room = { x: 80, y: 96, w: 162, h: 147 }
  const withId = (s: WindowState, id: string, extra = {}) =>
    r(s, { type: "OPEN", node: work, opts: { id, rect: room, ...extra } })

  it("opens the same node more than once under ids of its own", () => {
    const s = withId(withId(init, "room:a"), "room:b")
    expect(s.wins.map((w) => w.id)).toEqual(["room:a", "room:b"])
  })

  it("uses the rect and title it was given", () => {
    const s = r(init, { type: "OPEN", node: work, opts: { id: "room:a", rect: room, title: "sector" } })
    expect(s.wins[0].rect).toEqual(room)
    expect(s.wins[0].title).toBe("sector")
  })

  it("still dedupes by its own id", () => {
    const s = withId(withId(init, "room:a"), "room:a")
    expect(s.wins).toHaveLength(1)
  })
})

describe("what a window allows", () => {
  const locked = { move: false, close: false, minimize: false, maximize: false, resize: false }
  const lockedWin = (s: WindowState = init) =>
    r(s, { type: "OPEN", node: work, opts: { id: "lock", allow: locked } })

  it("refuses to close, minimize, maximize, move or resize a locked window", () => {
    let s = lockedWin()
    const before = s.wins[0]
    s = r(s, { type: "CLOSE", id: "lock" })
    s = r(s, { type: "MINIMIZE", id: "lock" })
    s = r(s, { type: "MAXIMIZE", id: "lock" })
    s = r(s, { type: "MOVE", id: "lock", rect: { x: 999 } })
    s = r(s, { type: "RESIZE", id: "lock", rect: { w: 999 } })
    expect(s.wins).toHaveLength(1)
    expect(s.wins[0].state).toBe("normal")
    expect(s.wins[0].rect).toEqual(before.rect)
  })

  /* The program that owns a locked window still has to place it and, when a
     level ends, take it away. */
  it("lets its owner move and close it with force", () => {
    let s = lockedWin()
    s = r(s, { type: "MOVE", id: "lock", rect: { x: 40 }, force: true })
    expect(s.wins[0].rect.x).toBe(40)
    s = r(s, { type: "CLOSE", id: "lock", force: true })
    expect(s.wins).toHaveLength(0)
  })

  it("leaves a window that may not minimize alone on show desktop", () => {
    let s = open(lockedWin(), projects)
    s = r(s, { type: "MINIMIZE_ALL" })
    expect(s.wins.find((w) => w.id === "lock")!.state).toBe("normal")
    expect(s.wins.find((w) => w.id === "/projects")!.state).toBe("minimized")
    expect(s.focused).toBe("lock")
  })

  it("still allows everything on an ordinary window", () => {
    let s = open(init)
    s = r(s, { type: "CLOSE", id: "/work" })
    expect(s.wins).toHaveLength(0)
  })
})

describe("always on top", () => {
  it("stacks above a window with a higher z", () => {
    expect(stackOrder({ z: 5, onTop: true })).toBeGreaterThan(stackOrder({ z: 900 }))
  })

  it("keeps its flag when opened", () => {
    const s = r(init, { type: "OPEN", node: work, opts: { id: "top", onTop: true } })
    expect(s.wins[0].onTop).toBe(true)
  })
})

describe("windows a program keeps changing", () => {
  const grid = { cw: 10, ch: 20, cols: 8, rows: 4, max: { cols: 20, rows: 6 } }
  const room = (allow = {}) =>
    r(init, { type: "OPEN", node: work, opts: { id: "room", grid, allow, skipTaskbar: true } })

  it("crops: geometry and grid change together", () => {
    const s = r(room(), {
      type: "REGRID",
      id: "room",
      rect: { x: 30, w: 52 },
      grid: { ox: 3, cols: 5 },
    })
    expect(s.wins[0].rect).toMatchObject({ x: 30, w: 52 })
    expect(s.wins[0].grid).toMatchObject({ ox: 3, cols: 5, rows: 4, max: { cols: 20, rows: 6 } })
  })

  it("refuses a crop the window does not allow, unless its owner forces it", () => {
    let s = room({ resize: false })
    s = r(s, { type: "REGRID", id: "room", grid: { cols: 5 } })
    expect(s.wins[0].grid?.cols).toBe(8)
    s = r(s, { type: "REGRID", id: "room", grid: { keep: { x: 1, y: 1 } }, force: true })
    expect(s.wins[0].grid?.keep).toEqual({ x: 1, y: 1 })
  })

  it("releases a window by changing what it allows, and renames it", () => {
    let s = room({ move: false })
    s = r(s, { type: "CONFIGURE", id: "room", allow: { move: true }, title: "free" })
    expect(s.wins[0].allow).toEqual({ move: true })
    expect(s.wins[0].title).toBe("free")
  })

  /* A window that jumps in front must not take the keyboard with it: the
     player may be typing in another window when it does. */
  it("raises a window without taking focus, restoring it if minimized", () => {
    let s = open(room(), projects)
    s = r(s, { type: "MINIMIZE", id: "room", force: true })
    expect(s.wins[0].state).toBe("minimized")
    s = r(s, { type: "RAISE", id: "room" })
    expect(s.wins[0].state).toBe("normal")
    expect(s.focused).toBe("/projects")
    expect(s.wins[0].z).toBeGreaterThan(s.wins[1].z)
  })

  it("minimizes a window that may not minimize only when forced", () => {
    let s = room({ minimize: false })
    s = r(s, { type: "MINIMIZE", id: "room" })
    expect(s.wins[0].state).toBe("normal")
    s = r(s, { type: "MINIMIZE", id: "room", force: true })
    expect(s.wins[0].state).toBe("minimized")
  })

  it("remembers to stay off the taskbar", () => {
    expect(room().wins[0].skipTaskbar).toBe(true)
  })
})
