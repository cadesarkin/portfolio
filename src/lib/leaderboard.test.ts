import { describe, it, expect } from "vitest"
import {
  BOARDS,
  TOP_N,
  boardById,
  validateInitials,
  validateScore,
  formatScore,
  qualifies,
  rank,
  type Entry,
} from "./leaderboard"

const high = boardById("snake")!
const low = boardById("minesweeper-expert")!
const entry = (initials: string, score: number): Entry => ({
  initials,
  score,
  at: 0,
})

describe("boards", () => {
  it("gives every board a unique id", () => {
    expect(new Set(BOARDS.map((b) => b.id)).size).toBe(BOARDS.length)
  })

  it("gives every board a direction, unit and cap", () => {
    for (const b of BOARDS) {
      expect(["high", "low"]).toContain(b.direction)
      expect(b.unit).toBeTruthy()
      expect(b.max).toBeGreaterThan(0)
    }
  })

  it("looks a board up by id", () => {
    expect(boardById("snake")?.label).toBe("snake")
    expect(boardById("nope")).toBeUndefined()
  })
})

describe("validateInitials", () => {
  it("accepts three uppercase letters", () => {
    expect(validateInitials("CDS")).toEqual({ ok: true, value: "CDS" })
  })

  it("uppercases and trims", () => {
    expect(validateInitials("  cds ")).toEqual({ ok: true, value: "CDS" })
  })

  it("rejects the wrong length", () => {
    expect(validateInitials("CD").ok).toBe(false)
    expect(validateInitials("CDSX").ok).toBe(false)
  })

  it("rejects an empty entry with a helpful message", () => {
    const r = validateInitials("")
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/three letters/i)
  })

  it("rejects digits and punctuation", () => {
    expect(validateInitials("C3S").ok).toBe(false)
    expect(validateInitials("C-S").ok).toBe(false)
    expect(validateInitials("C S").ok).toBe(false)
  })

  /**
   * The format is the moderation strategy: anything that is not three plain
   * A-Z letters cannot get through, so homoglyphs and zalgo never apply.
   */
  it("rejects unicode look-alikes", () => {
    expect(validateInitials("ＣＤＳ").ok).toBe(false) // fullwidth
    expect(validateInitials("СDS").ok).toBe(false) // cyrillic Es
    expect(validateInitials("ĆDS").ok).toBe(false) // combining accent
  })

  it("rejects blocklisted combinations", () => {
    expect(validateInitials("ASS").ok).toBe(false)
    expect(validateInitials("KYS").ok).toBe(false)
  })

  it("rejects a blocklisted combination typed in lowercase", () => {
    expect(validateInitials("ass").ok).toBe(false)
  })

  it("still allows ordinary initials", () => {
    for (const ok of ["CDS", "AAA", "ZZZ", "JEB", "MAX"]) {
      expect(validateInitials(ok).ok, ok).toBe(true)
    }
  })
})

describe("validateScore", () => {
  it("accepts a plain number", () => {
    expect(validateScore(high, 1420)).toEqual({ ok: true, value: 1420 })
  })

  it("accepts a numeric string", () => {
    expect(validateScore(high, "980")).toEqual({ ok: true, value: 980 })
  })

  it("rounds to a whole number", () => {
    expect(validateScore(high, 12.7).value).toBe(13)
  })

  it("rejects a negative score", () => {
    expect(validateScore(high, -5).ok).toBe(false)
  })

  it("rejects anything above the board's cap", () => {
    expect(validateScore(low, 5000).ok).toBe(false)
  })

  /** A bogus value must not be able to break the display or the ordering. */
  it("rejects Infinity and NaN", () => {
    expect(validateScore(high, Infinity).ok).toBe(false)
    expect(validateScore(high, NaN).ok).toBe(false)
    expect(validateScore(high, "banana").ok).toBe(false)
  })

  /** Number() maps all of these to 0, which would read as a real score. */
  it("rejects a value that is not a number at all", () => {
    expect(validateScore(high, null).ok).toBe(false)
    expect(validateScore(high, undefined).ok).toBe(false)
    expect(validateScore(high, {}).ok).toBe(false)
    expect(validateScore(high, []).ok).toBe(false)
    expect(validateScore(high, false).ok).toBe(false)
    expect(validateScore(high, "").ok).toBe(false)
    expect(validateScore(high, "   ").ok).toBe(false)
  })

  it("accepts zero", () => {
    expect(validateScore(high, 0)).toEqual({ ok: true, value: 0 })
  })
})

describe("qualifies", () => {
  it("accepts anything while the board has room", () => {
    expect(qualifies(high, 1, [entry("AAA", 999)])).toBe(true)
  })

  it("needs a bigger score on a high board once full", () => {
    const full = Array.from({ length: TOP_N }, (_, i) =>
      entry("AAA", 100 - i)
    )
    expect(qualifies(high, 200, full)).toBe(true)
    expect(qualifies(high, 50, full)).toBe(false)
  })

  it("needs a smaller score on a low board once full", () => {
    const full = Array.from({ length: TOP_N }, (_, i) => entry("AAA", 10 + i))
    expect(qualifies(low, 5, full)).toBe(true)
    expect(qualifies(low, 100, full)).toBe(false)
  })

  it("rejects a tie with the worst entry, which would not displace it", () => {
    const full = Array.from({ length: TOP_N }, () => entry("AAA", 50))
    expect(qualifies(high, 50, full)).toBe(false)
  })
})

describe("rank", () => {
  it("orders a high board descending", () => {
    const r = rank(high, [entry("A", 10), entry("B", 30), entry("C", 20)])
    expect(r.map((e) => e.score)).toEqual([30, 20, 10])
  })

  it("orders a low board ascending", () => {
    const r = rank(low, [entry("A", 30), entry("B", 10), entry("C", 20)])
    expect(r.map((e) => e.score)).toEqual([10, 20, 30])
  })

  it("caps the list at the top ten", () => {
    const many = Array.from({ length: 40 }, (_, i) => entry("AAA", i))
    expect(rank(high, many)).toHaveLength(TOP_N)
  })

  it("does not mutate its input", () => {
    const input = [entry("A", 10), entry("B", 30)]
    rank(high, input)
    expect(input.map((e) => e.score)).toEqual([10, 30])
  })
})

describe("formatScore", () => {
  it("adds thousands separators and the unit", () => {
    expect(formatScore(high, 1420)).toBe("1,420 pts")
    expect(formatScore(low, 38)).toBe("38 s")
  })
})
