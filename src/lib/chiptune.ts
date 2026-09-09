/**
 * Chiptune data and note maths. Pure — no AudioContext, no DOM.
 *
 * The tunes are written here rather than loaded as audio files: three short
 * loops of square and triangle waves cost nothing to ship and carry no
 * licensing question, which a real track would.
 */

export type Wave = "square" | "triangle" | "sawtooth" | "noise"

export interface Channel {
  wave: Wave
  /** Volume 0..1 for this channel. */
  gain: number
  /**
   * One entry per sixteenth note. A note name plays it, "-" rests, and "."
   * sustains whatever is already sounding.
   */
  steps: string[]
}

export interface Tune {
  name: string
  bpm: number
  channels: Channel[]
}

const SEMITONES: Record<string, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
}

/**
 * Note name to frequency, equal temperament from A4 = 440Hz.
 *
 * Returns null for rests and sustains so callers can tell "no note" from a
 * note that happens to be low.
 */
export function noteToFreq(note: string): number | null {
  if (!note || note === "-" || note === ".") return null
  const m = /^([A-G]#?)(-?\d)$/.exec(note)
  if (!m) return null
  const semitone = SEMITONES[m[1]]
  if (semitone === undefined) return null
  const octave = Number(m[2])
  // MIDI 69 is A4; 12 semitones per octave.
  const midi = (octave + 1) * 12 + semitone
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Seconds per sixteenth note. */
export const stepDuration = (bpm: number) => 60 / bpm / 4

/** Length of the longest channel — the loop point. */
export function tuneLength(tune: Tune): number {
  return tune.channels.reduce((n, c) => Math.max(n, c.steps.length), 0)
}

const s = (pattern: string) => pattern.trim().split(/\s+/)

export const TUNES: Tune[] = [
  {
    name: "bliss",
    bpm: 104,
    channels: [
      {
        wave: "triangle",
        gain: 0.5,
        steps: s(`
          E5 .  .  -  G5 .  -  -  B5 .  .  -  A5 .  -  -
          G5 .  .  -  E5 .  -  -  D5 .  .  -  E5 .  -  -
          F#5 . .  -  A5 .  -  -  C6 .  .  -  B5 .  -  -
          A5 .  .  -  F#5 . -  -  D5 .  .  .  .  -  -  -
        `),
      },
      {
        wave: "square",
        gain: 0.18,
        steps: s(`
          E3 -  -  -  E3 -  -  -  B2 -  -  -  B2 -  -  -
          C3 -  -  -  C3 -  -  -  G2 -  -  -  G2 -  -  -
          D3 -  -  -  D3 -  -  -  A2 -  -  -  A2 -  -  -
          D3 -  -  -  D3 -  -  -  E3 -  -  -  E3 -  -  -
        `),
      },
    ],
  },
  {
    name: "boot",
    bpm: 132,
    channels: [
      {
        wave: "square",
        gain: 0.4,
        steps: s(`
          C5 -  E5 -  G5 -  C6 -  B5 -  G5 -  E5 -  C5 -
          D5 -  F5 -  A5 -  D6 -  C6 -  A5 -  F5 -  D5 -
          E5 -  G5 -  B5 -  E6 -  D6 -  B5 -  G5 -  E5 -
          G5 -  G5 -  F5 -  F5 -  E5 -  D5 -  C5 .  .  -
        `),
      },
      {
        wave: "sawtooth",
        gain: 0.14,
        steps: s(`
          C2 -  -  -  C2 -  -  -  G2 -  -  -  G2 -  -  -
          D2 -  -  -  D2 -  -  -  A2 -  -  -  A2 -  -  -
          E2 -  -  -  E2 -  -  -  B2 -  -  -  B2 -  -  -
          G2 -  -  -  F2 -  -  -  E2 -  -  -  C2 -  -  -
        `),
      },
      {
        wave: "noise",
        gain: 0.09,
        steps: s(`
          C4 -  -  -  C4 -  C4 -  C4 -  -  -  C4 -  C4 -
          C4 -  -  -  C4 -  C4 -  C4 -  -  -  C4 -  C4 -
          C4 -  -  -  C4 -  C4 -  C4 -  -  -  C4 -  C4 -
          C4 -  -  -  C4 -  C4 -  C4 -  C4 -  C4 -  C4 -
        `),
      },
    ],
  },
  {
    name: "night",
    bpm: 84,
    channels: [
      {
        wave: "triangle",
        gain: 0.46,
        steps: s(`
          A4 .  .  .  -  -  C5 .  .  -  E5 .  .  .  -  -
          D5 .  .  .  -  -  C5 .  .  -  A4 .  .  .  -  -
          G4 .  .  .  -  -  B4 .  .  -  D5 .  .  .  -  -
          C5 .  .  .  -  -  B4 .  .  -  A4 .  .  .  .  -
        `),
      },
      {
        wave: "square",
        gain: 0.13,
        steps: s(`
          A2 -  -  -  -  -  -  -  E2 -  -  -  -  -  -  -
          F2 -  -  -  -  -  -  -  C2 -  -  -  -  -  -  -
          G2 -  -  -  -  -  -  -  D2 -  -  -  -  -  -  -
          F2 -  -  -  -  -  -  -  E2 -  -  -  -  -  -  -
        `),
      },
    ],
  },
]
