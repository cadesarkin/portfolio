import { describe, it, expect } from "vitest"
import { resolve, pathOf, complete, search, list } from "./vfs-utils"
import { root } from "./vfs"

describe("resolve", () => {
  it("returns root for ~ and /", () => {
    expect(resolve("~", "/")).toBe(root)
    expect(resolve("/", "/")).toBe(root)
  })

  it("resolves an absolute path", () => {
    expect(resolve("/work", "/")?.name).toBe("work")
  })

  it("resolves a nested absolute path", () => {
    expect(resolve("/work/vance", "/")?.name).toBe("vance")
  })

  it("resolves a relative path from cwd", () => {
    expect(resolve("vance", "/work")?.name).toBe("vance")
  })

  it("ignores a trailing slash", () => {
    expect(resolve("/work/", "/")?.name).toBe("work")
  })

  it("handles . and ..", () => {
    expect(resolve("./vance", "/work")?.name).toBe("vance")
    expect(resolve("..", "/work/vance")?.name).toBe("work")
  })

  it("clamps .. at root instead of escaping", () => {
    expect(resolve("../../../..", "/work")).toBe(root)
  })

  it("resolves ~ prefixed paths regardless of cwd", () => {
    expect(resolve("~/work", "/projects/mozaiq")?.name).toBe("work")
  })

  it("returns null for a missing node", () => {
    expect(resolve("/nope", "/")).toBeNull()
  })

  it("returns null when descending into a non-directory", () => {
    expect(resolve("/about/skills.txt/deeper", "/")).toBeNull()
  })

  it("treats an empty path as cwd", () => {
    expect(resolve("", "/work")?.name).toBe("work")
  })
})

describe("pathOf", () => {
  it("returns / for root", () => {
    expect(pathOf(root)).toBe("/")
  })

  it("round-trips with resolve", () => {
    const n = resolve("/work/vance", "/")!
    expect(pathOf(n)).toBe("/work/vance")
    expect(resolve(pathOf(n), "/")).toBe(n)
  })

  it("round-trips for a deep leaf", () => {
    const n = resolve("/work/vance/README.md", "/")!
    expect(resolve(pathOf(n), "/")).toBe(n)
  })
})

describe("list", () => {
  it("returns the children of a directory", () => {
    const work = resolve("/work", "/")
    expect(list(work!).map((n) => n.name)).toContain("vance")
  })
})

describe("complete", () => {
  it("completes a unique prefix to the full name", () => {
    expect(complete("/wo", "/")).toEqual(["work"])
  })

  it("lists all children for an empty partial", () => {
    expect(complete("", "/").length).toBeGreaterThan(3)
  })

  it("returns every candidate when ambiguous", () => {
    const hits = complete("/work/", "/")
    expect(hits).toContain("vance")
    expect(hits).toContain("lore")
  })

  it("completes relative to cwd", () => {
    expect(complete("van", "/work")).toEqual(["vance"])
  })

  it("returns nothing for an unmatchable prefix", () => {
    expect(complete("/zzz", "/")).toEqual([])
  })

  it("returns nothing when the directory part does not exist", () => {
    expect(complete("/nope/thing", "/")).toEqual([])
  })
})

describe("search", () => {
  it("finds a node by partial name", () => {
    expect(search("moz").map((n) => n.name)).toContain("mozaiq")
  })

  it("is case-insensitive", () => {
    expect(search("MOZ").map((n) => n.name)).toContain("mozaiq")
  })

  it("returns an empty array when nothing matches", () => {
    expect(search("qqqzzz")).toEqual([])
  })
})
