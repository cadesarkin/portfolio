/**
 * Ten-pin bowling: scoring and pin physics. Pure — no canvas, no DOM.
 *
 * Scoring is the interesting part. A strike or a spare is worth ten plus what
 * you roll next, which means a frame's value is not known when you bowl it —
 * the naive "add them up" version is wrong on every game that contains one.
 */

export const PIN_COUNT = 10
export const FRAMES = 10

export interface Frame {
  /** Pins felled on each roll of this frame. */
  rolls: number[]
}

export interface Game {
  frames: Frame[]
  /** Index of the frame in play, 0-9. */
  current: number
  /** Pins still standing for the next roll. */
  standing: boolean[]
  over: boolean
}

export function createGame(): Game {
  return {
    frames: Array.from({ length: FRAMES }, () => ({ rolls: [] })),
    current: 0,
    standing: new Array(PIN_COUNT).fill(true),
    over: false,
  }
}

export const isStrike = (f: Frame) => f.rolls[0] === PIN_COUNT
export const isSpare = (f: Frame) =>
  !isStrike(f) && f.rolls.length >= 2 && f.rolls[0] + f.rolls[1] === PIN_COUNT

/** Every roll of the game, flattened — what the bonus rules look ahead into. */
function allRolls(g: Game): number[] {
  return g.frames.flatMap((f) => f.rolls)
}

/**
 * Running score after each frame, or null for frames whose bonus is still
 * pending.
 *
 * Returning null rather than a partial number matters: showing a provisional
 * total for an unresolved strike is how scoreboards end up lying.
 */
export function scorecard(g: Game): (number | null)[] {
  const out: (number | null)[] = []
  const rolls = allRolls(g)
  let cursor = 0
  let total = 0

  for (let f = 0; f < FRAMES; f++) {
    const frame = g.frames[f]
    if (frame.rolls.length === 0) {
      out.push(null)
      continue
    }

    if (f === FRAMES - 1) {
      // The tenth frame carries its own bonus rolls; no lookahead needed.
      if (frame.rolls.length < (isStrike(frame) || frame.rolls[0] + frame.rolls[1] === PIN_COUNT ? 3 : 2)) {
        out.push(null)
      } else {
        total += frame.rolls.reduce((a, b) => a + b, 0)
        out.push(total)
      }
      continue
    }

    if (isStrike(frame)) {
      const bonus = rolls.slice(cursor + 1, cursor + 3)
      if (bonus.length < 2) {
        out.push(null)
      } else {
        total += PIN_COUNT + bonus[0] + bonus[1]
        out.push(total)
      }
      cursor += 1
    } else if (isSpare(frame)) {
      const bonus = rolls.slice(cursor + 2, cursor + 3)
      if (bonus.length < 1) {
        out.push(null)
      } else {
        total += PIN_COUNT + bonus[0]
        out.push(total)
      }
      cursor += 2
    } else {
      if (frame.rolls.length < 2) {
        out.push(null)
      } else {
        total += frame.rolls[0] + frame.rolls[1]
        out.push(total)
      }
      cursor += 2
    }
  }
  return out
}

/** The last confirmed total, or 0 before any frame resolves. */
export function total(g: Game): number {
  const card = scorecard(g)
  for (let i = card.length - 1; i >= 0; i--) {
    if (card[i] !== null) return card[i]!
  }
  return 0
}

/**
 * Applies a roll that knocked down `hit` of the standing pins.
 *
 * The caller decides which pins fell — this only advances the game state.
 */
export function roll(g: Game, felled: boolean[]): Game {
  if (g.over) return g

  const knocked = felled.filter(Boolean).length
  const frames = g.frames.map((f, i) =>
    i === g.current ? { rolls: [...f.rolls, knocked] } : { rolls: [...f.rolls] }
  )
  const frame = frames[g.current]
  const standing = g.standing.map((s, i) => s && !felled[i])
  const last = g.current === FRAMES - 1

  if (last) {
    const [a = 0, b = 0] = frame.rolls
    const earned = a === PIN_COUNT || a + b === PIN_COUNT
    const maxRolls = earned ? 3 : 2
    if (frame.rolls.length >= maxRolls) {
      return { frames, current: g.current, standing, over: true }
    }
    // Reset the rack whenever it is cleared, so the bonus rolls have pins.
    const cleared = standing.every((s) => !s)
    return {
      frames,
      current: g.current,
      standing: cleared ? new Array(PIN_COUNT).fill(true) : standing,
      over: false,
    }
  }

  const done = knocked === PIN_COUNT || frame.rolls.length === 2
  if (!done) return { frames, current: g.current, standing, over: false }

  return {
    frames,
    current: g.current + 1,
    standing: new Array(PIN_COUNT).fill(true),
    over: false,
  }
}

/**
 * Pin layout in lane units: x across (-1..1), y down the lane.
 *
 * The standard triangle, one pin at the head and four across the back.
 */
export const PIN_LAYOUT: { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = []
  const gap = 0.13
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i <= row; i++) {
      out.push({ x: (i - row / 2) * gap * 2, y: row * gap * 1.7 })
    }
  }
  return out
})()

/** A delivery: where it crosses the head pin, how much it hooks, how hard. */
export interface Roll {
  /** Lane position at the head pin, in lane units. */
  x: number
  /** Hook, negative to the left. Bends the path through the rack. */
  curve?: number
  /** 0..1. A weak ball reaches the rack with less to give. */
  power?: number
}

/** Ball half-width, in lane units. */
export const HIT_RADIUS = 0.12
/** Two pins closer together than this are neighbours in the rack. */
const NEIGHBOUR = 0.3
/** What a falling pin passes on to a neighbour it reaches. */
const CARRY = 0.68
/** What the ball gives up to each pin it ploughs through. */
const DRAIN = 0.16
/** How far a pin knocks the ball off its line. */
const DEFLECT = 0.06

/** Pins nearest the bowler first: the ball meets the rack in this order. */
const BY_DEPTH = PIN_LAYOUT.map((_, i) => i).sort(
  (a, b) => PIN_LAYOUT[a].y - PIN_LAYOUT[b].y
)

/**
 * Which pins a delivery knocks down.
 *
 * Not a physics simulation, but energy is conserved in spirit, and that is what
 * makes aim matter. The ball ploughs through the rack, spending energy on each
 * pin it meets and deflecting off it; each falling pin passes a damped share to
 * its neighbours. A pocket hit puts four pins in motion at once and the rack
 * goes over; a ball that clips the corner starts one chain that dies out.
 *
 * An earlier version chained neighbours at a flat probability, independent of
 * where the ball went. That is a percolation problem: measured, it either
 * cleared the rack 88% of the time or barely spread at all, with almost nothing
 * in between, and aim made no difference to which. Carrying the ball's own
 * energy through the chain is what separates a good line from a bad one.
 */
export function resolveRoll(
  standing: boolean[],
  roll: Roll | number,
  rng: () => number = Math.random
): boolean[] {
  const { x, curve = 0, power = 1 } = typeof roll === "number" ? { x: roll } : roll
  const felled = new Array(PIN_COUNT).fill(false)
  const energy = new Array(PIN_COUNT).fill(0)
  const queue: number[] = []

  // The ball's path through the rack, hooking as it goes.
  let ballX = x
  let ballEnergy = 0.55 + 0.45 * Math.max(0, Math.min(1, power))
  for (const i of BY_DEPTH) {
    const pin = PIN_LAYOUT[i]
    const at = ballX + curve * pin.y * 0.9
    const off = Math.abs(pin.x - at)
    if (off >= HIT_RADIUS) continue
    // How squarely the ball caught it: a thin hit passes on very little.
    const square = 1 - off / HIT_RADIUS
    if (standing[i]) {
      felled[i] = true
      energy[i] = ballEnergy * (0.4 + 0.6 * square)
      queue.push(i)
    }
    ballEnergy *= 1 - DRAIN * square
    ballX += (at >= pin.x ? 1 : -1) * DEFLECT * square
  }

  // Falling pins take their neighbours with them, weakening as they spread.
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]
    for (let j = 0; j < PIN_COUNT; j++) {
      if (felled[j] || !standing[j]) continue
      const d = Math.hypot(
        PIN_LAYOUT[i].x - PIN_LAYOUT[j].x,
        PIN_LAYOUT[i].y - PIN_LAYOUT[j].y
      )
      if (d >= NEIGHBOUR) continue
      if (rng() < energy[i]) {
        felled[j] = true
        energy[j] = energy[i] * CARRY
        queue.push(j)
      }
    }
  }

  return felled
}
