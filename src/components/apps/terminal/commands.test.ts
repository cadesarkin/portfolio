import { describe, it, expect } from "vitest"
import { run, COMMANDS, completeInput } from "./commands"

/** Joins a result's output so assertions can match against whole text. */
const text = (r: ReturnType<typeof run>) =>
  (r.lines ?? [])
    .map((l) => (l.right !== undefined ? `${l.text} ${l.right}` : l.text))
    .join("\n")

describe("run — navigation", () => {
  it("lists the current directory", () => {
    const out = text(run("ls", "/"))
    expect(out).toContain("work")
    expect(out).toContain("projects")
  })

  it("lists a named directory", () => {
    const out = text(run("ls work", "/"))
    expect(out).toContain("vance")
    expect(out).toContain("lore")
  })

  it("marks directories with a trailing slash in long form", () => {
    expect(text(run("ls -l", "/"))).toContain("work/")
  })

  it("reports a missing path", () => {
    expect(text(run("ls nope", "/"))).toMatch(/no such file or directory/i)
  })

  it("changes directory and reports the new cwd", () => {
    expect(run("cd work", "/").cwd).toBe("/work")
  })

  it("cd with no argument returns home", () => {
    expect(run("cd", "/work/vance").cwd).toBe("/")
  })

  it("cd .. goes up one level", () => {
    expect(run("cd ..", "/work/vance").cwd).toBe("/work")
  })

  it("refuses to cd into a file", () => {
    const r = run("cd about/skills.txt", "/")
    expect(r.cwd).toBeUndefined()
    expect(text(r)).toMatch(/not a directory/i)
  })

  it("does not change cwd on a failed cd", () => {
    expect(run("cd nowhere", "/work").cwd).toBeUndefined()
  })

  it("pwd prints the current directory", () => {
    expect(text(run("pwd", "/work/vance"))).toBe("/work/vance")
  })

  it("cat prints a file body", () => {
    expect(text(run("cat skills.txt", "/about"))).toContain("TypeScript")
  })

  it("cat on a directory is an error", () => {
    expect(text(run("cat work", "/"))).toMatch(/is a directory/i)
  })

  it("cat with no argument reports usage", () => {
    expect(text(run("cat", "/"))).toMatch(/usage/i)
  })

  it("tree renders nested entries", () => {
    const out = text(run("tree work", "/"))
    expect(out).toContain("vance")
    expect(out).toContain("README.md")
  })

  it("find locates a node anywhere in the tree", () => {
    expect(text(run("find mozaiq", "/"))).toContain("/projects/mozaiq")
  })
})

describe("run — windows", () => {
  it("open resolves a name to a vfs path", () => {
    expect(run("open work", "/").open).toBe("/work")
  })

  it("open finds a node by name from anywhere", () => {
    expect(run("open mozaiq", "/about").open).toBe("/projects/mozaiq")
  })

  it("open reports an unknown target", () => {
    const r = run("open nothing", "/")
    expect(r.open).toBeUndefined()
    expect(text(r)).toMatch(/cannot open/i)
  })

  it("clear signals a clear", () => {
    expect(run("clear", "/").clear).toBe(true)
  })

  it("reboot signals a reboot", () => {
    expect(run("reboot", "/").reboot).toBe(true)
  })

  it("exit signals a close", () => {
    expect(run("exit", "/").closeWin).toBe(true)
  })
})

describe("run — content", () => {
  it("whoami identifies the owner", () => {
    expect(text(run("whoami", "/"))).toMatch(/cade/i)
  })

  it("resume opens the resume window", () => {
    expect(run("resume", "/").open).toBe("/about/resume.pdf")
  })

  it("neofetch reports counts derived from the vfs", () => {
    const out = text(run("neofetch", "/"))
    expect(out).toMatch(/clients/i)
    expect(out).toMatch(/projects/i)
  })

  it("echo repeats its arguments", () => {
    expect(text(run("echo hello world", "/"))).toBe("hello world")
  })

  it("echo with no argument prints a blank line", () => {
    expect(text(run("echo", "/"))).toBe("")
  })

  it("help lists every registered command", () => {
    const out = text(run("help", "/"))
    for (const name of Object.keys(COMMANDS)) expect(out).toContain(name)
  })
})

describe("run — errors and eggs", () => {
  it("reports an unknown command", () => {
    expect(text(run("frobnicate", "/"))).toMatch(/command not found/i)
  })

  it("suggests the nearest command for a typo", () => {
    expect(text(run("lz", "/"))).toMatch(/did you mean 'ls'/i)
  })

  it("does not suggest anything for a distant typo", () => {
    expect(text(run("xyzzy", "/"))).not.toMatch(/did you mean/i)
  })

  it("handles an empty line without error", () => {
    expect(run("", "/").lines ?? []).toHaveLength(0)
  })

  it("sudo refuses", () => {
    expect(text(run("sudo rm -rf /", "/"))).toMatch(/not in the sudoers/i)
  })
})

describe("completeInput", () => {
  it("completes a command name at the start of the line", () => {
    expect(completeInput("neo", "/").value).toBe("neofetch")
  })

  it("completes a path argument", () => {
    expect(completeInput("cd wo", "/").value).toBe("cd work")
  })

  it("completes a nested path argument", () => {
    expect(completeInput("cat work/van", "/").value).toBe("cat work/vance")
  })

  it("lists candidates when a prefix is ambiguous", () => {
    const r = completeInput("ls work/", "/")
    expect(r.candidates.length).toBeGreaterThan(1)
    expect(r.candidates).toContain("vance")
  })

  it("leaves the line alone when nothing matches", () => {
    expect(completeInput("cd zzz", "/").value).toBe("cd zzz")
  })

  it("completes to the common prefix when several share one", () => {
    // Both `experience.txt` and `skills.txt` exist; `e` is unique to the first.
    expect(completeInput("cat e", "/about").value).toBe("cat experience.txt")
  })
})
