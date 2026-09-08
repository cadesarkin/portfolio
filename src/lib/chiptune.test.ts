import { describe, it, expect } from "vitest"
import { noteToFreq, stepDuration, tuneLength, TUNES } from "./chiptune"

describe("noteToFreq", () => {
  it("puts A4 at 440Hz", () => {
    expect(noteToFreq("A4")).toBeCloseTo(440, 6)
  })

  it("doubles an octave up and halves an octave down", () => {
    expect(noteToFreq("A5")).toBeCloseTo(880, 6)
    expect(noteToFreq("A3")).toBeCloseTo(220, 6)
  })

  it("places middle C correctly", () => {
    expect(noteToFreq("C4")).toBeCloseTo(261.626, 2)
  })

  it("handles sharps", () => {
    expect(noteToFreq("C#4")).toBeCloseTo(277.183, 2)
    expect(noteToFreq("F#5")).toBeCloseTo(739.989, 2)
  })

  it("returns null for a rest or a sustain", () => {
    expect(noteToFreq("-")).toBeNull()
    expect(noteToFreq(".")).toBeNull()
  })

  it("returns null for nonsense rather than a bogus frequency", () => {
    expect(noteToFreq("")).toBeNull()
    expect(noteToFreq("H4")).toBeNull()
    expect(noteToFreq("C")).toBeNull()
    expect(noteToFreq("Cb4")).toBeNull()
  })

  it("ascends monotonically through a chromatic run", () => {
    const run = ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4"]
    const freqs = run.map((n) => noteToFreq(n)!)
    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i]).toBeGreaterThan(freqs[i - 1])
    }
  })
})

describe("stepDuration", () => {
  it("gives a sixteenth note at the given tempo", () => {
    // 120bpm: a beat is 0.5s, a sixteenth is a quarter of that.
    expect(stepDuration(120)).toBeCloseTo(0.125, 6)
  })

  it("shortens as tempo rises", () => {
    expect(stepDuration(160)).toBeLessThan(stepDuration(80))
  })
})

describe("tunes", () => {
  it("ships three tunes", () => {
    expect(TUNES).toHaveLength(3)
  })

  it("gives every tune a name, a tempo and channels", () => {
    for (const t of TUNES) {
      expect(t.name).toBeTruthy()
      expect(t.bpm).toBeGreaterThan(0)
      expect(t.channels.length).toBeGreaterThan(0)
    }
  })

  it("contains only parseable steps", () => {
    for (const t of TUNES) {
      for (const c of t.channels) {
        for (const step of c.steps) {
          const ok = step === "-" || step === "." || noteToFreq(step) !== null
          expect(ok, `${t.name}: bad step "${step}"`).toBe(true)
        }
      }
    }
  })

  it("keeps every channel of a tune the same length, so the loop lines up", () => {
    for (const t of TUNES) {
      const len = tuneLength(t)
      for (const c of t.channels) {
        expect(c.steps.length, `${t.name} channel lengths`).toBe(len)
      }
    }
  })

  it("keeps channel gains within range", () => {
    for (const t of TUNES) {
      for (const c of t.channels) {
        expect(c.gain).toBeGreaterThan(0)
        expect(c.gain).toBeLessThanOrEqual(1)
      }
    }
  })

  it("does not start a channel on a sustain, which would have nothing to hold", () => {
    for (const t of TUNES) {
      for (const c of t.channels) {
        expect(c.steps[0], `${t.name} starts on a sustain`).not.toBe(".")
      }
    }
  })
})
