import { describe, it, expect } from "vitest"
import { tokenize, nearest } from "./parse"

describe("tokenize", () => {
  it("splits on whitespace", () => {
    expect(tokenize("ls -l work")).toEqual(["ls", "-l", "work"])
  })

  it("collapses runs of whitespace", () => {
    expect(tokenize("  ls   work  ")).toEqual(["ls", "work"])
  })

  it("returns an empty array for blank input", () => {
    expect(tokenize("")).toEqual([])
    expect(tokenize("   ")).toEqual([])
  })

  it("keeps a double-quoted span together", () => {
    expect(tokenize('echo "hello there"')).toEqual(["echo", "hello there"])
  })

  it("keeps a single-quoted span together", () => {
    expect(tokenize("echo 'hello there'")).toEqual(["echo", "hello there"])
  })

  it("allows a quote to abut other text", () => {
    expect(tokenize('cat "my file".txt')).toEqual(["cat", "my file.txt"])
  })

  it("tolerates an unterminated quote", () => {
    expect(tokenize('echo "unclosed')).toEqual(["echo", "unclosed"])
  })

  it("preserves an empty quoted argument", () => {
    expect(tokenize('echo ""')).toEqual(["echo", ""])
  })
})

describe("nearest", () => {
  it("finds a one-character typo", () => {
    expect(nearest("lz", ["ls", "cd", "cat"])).toBe("ls")
  })

  it("finds a transposition", () => {
    expect(nearest("sl", ["ls", "cd", "cat"])).toBe("ls")
  })

  it("returns null when nothing is close enough", () => {
    expect(nearest("xyzzy", ["ls", "cd", "cat"])).toBeNull()
  })

  it("returns the exact match when present", () => {
    expect(nearest("cat", ["ls", "cd", "cat"])).toBe("cat")
  })
})
