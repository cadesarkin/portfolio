import { describe, it, expect } from "vitest"
import {
  windowReducer as r,
  initialWindowState as init,
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
