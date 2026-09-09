/**
 * Fire, smoke and embers at the impact site.
 *
 * Pure — no canvas, no DOM. Particles live in character-grid units so they can
 * be drawn straight into the wallpaper's glyph grid, the same way the birds
 * and meteors are.
 */

export type EmberKind = "flame" | "smoke" | "spark"

export interface Ember {
  /** Grid column, fractional. */
  x: number
  /** Grid row, fractional. */
  y: number
  vx: number
  vy: number
  /** Seconds remaining. */
  life: number
  /** Total lifetime, for fading. */
  span: number
  kind: EmberKind
  /** Sideways sway offset, so a column of smoke does not rise ruler-straight. */
  phase: number
}

export interface Fire {
  embers: Ember[]
  /** Seconds until the next spawn. */
  next: number
}

/** Flames are dense and short-lived; smoke is sparse and drifts a long way. */
const SPAWN_INTERVAL = 0.028
export const MAX_EMBERS = 150

export function createFire(): Fire {
  return { embers: [], next: 0 }
}

/** Ramps a flame from its base colour to its tip. */
export const FLAME_RAMP = "^*+;:,.'"
export const SMOKE_RAMP = "@%#*+=-:. "

function spawn(cx: number, cy: number, rng: () => number): Ember {
  const roll = rng()
  const kind: EmberKind = roll < 0.55 ? "flame" : roll < 0.9 ? "smoke" : "spark"

  // Biased away from dead centre: the wreck itself sits there and would hide
  // anything spawned behind it, so the fire licks up around both flanks.
  const side = rng() < 0.5 ? -1 : 1
  const spread = kind === "flame" ? 3.2 : 4.4
  const x = cx + side * (1.6 + rng() * spread)
  const y = cy - (kind === "smoke" ? rng() * 1.5 : 0)

  if (kind === "flame") {
    return {
      x,
      y,
      vx: (rng() * 2 - 1) * 1.2,
      vy: -(5 + rng() * 4),
      life: 0.7 + rng() * 0.6,
      span: 1.3,
      kind,
      phase: rng() * Math.PI * 2,
    }
  }
  if (kind === "smoke") {
    return {
      x,
      y,
      vx: (rng() * 2 - 1) * 1.6 + 1.1, // drifts with the wind, left to right
      vy: -(2.2 + rng() * 2),
      life: 1.8 + rng() * 1.8,
      span: 3.6,
      kind,
      phase: rng() * Math.PI * 2,
    }
  }
  // Sparks pop out sideways and arc.
  return {
    x,
    y,
    vx: (rng() * 2 - 1) * 7,
    vy: -(7 + rng() * 5),
    life: 0.4 + rng() * 0.4,
    span: 0.8,
    kind,
    phase: rng() * Math.PI * 2,
  }
}

export function stepFire(
  fire: Fire,
  dt: number,
  cx: number,
  cy: number,
  rng: () => number = Math.random
): Fire {
  const embers: Ember[] = []
  for (const e of fire.embers) {
    const life = e.life - dt
    if (life <= 0) continue
    // Sparks fall back down; flames and smoke keep rising and slow as they go.
    const vy = e.kind === "spark" ? e.vy + 16 * dt : e.vy * (1 - dt * 0.55)
    embers.push({
      ...e,
      x: e.x + e.vx * dt,
      y: e.y + vy * dt,
      vy,
      life,
    })
  }

  let next = fire.next - dt
  while (next <= 0 && embers.length < MAX_EMBERS) {
    embers.push(spawn(cx, cy, rng))
    next += SPAWN_INTERVAL
  }
  // Guard against a huge dt leaving the timer far in the past.
  if (next <= 0) next = SPAWN_INTERVAL

  return { embers, next }
}

export interface EmberCell {
  col: number
  row: number
  ch: string
  /** CSS colour, already including alpha. */
  color: string
}

/**
 * The glyph and colour for an ember.
 *
 * `night` only shifts the smoke: fire looks the same at any hour, but smoke
 * against a dark sky needs to be lighter than the sky rather than darker.
 */
export function emberCell(e: Ember, t: number, night: boolean): EmberCell {
  const age = 1 - e.life / e.span
  const sway = Math.sin(t * 2.2 + e.phase) * (e.kind === "smoke" ? 1.4 : 0.5)

  if (e.kind === "spark") {
    return {
      col: Math.round(e.x + sway * 0.3),
      row: Math.round(e.y),
      ch: age < 0.5 ? "*" : ".",
      color: `rgba(255, ${(210 - age * 90) | 0}, 90, ${(1 - age).toFixed(2)})`,
    }
  }

  if (e.kind === "flame") {
    const i = Math.min(
      FLAME_RAMP.length - 1,
      Math.floor(age * FLAME_RAMP.length)
    )
    // White-hot at the base, through orange, to a dull red tip.
    const r = 255
    const g = (235 - age * 175) | 0
    const b = (150 - age * 140) | 0
    return {
      col: Math.round(e.x + sway),
      row: Math.round(e.y),
      ch: FLAME_RAMP[i],
      color: `rgba(${r}, ${g}, ${b}, ${(1 - age * 0.75).toFixed(2)})`,
    }
  }

  const i = Math.min(SMOKE_RAMP.length - 1, Math.floor(age * SMOKE_RAMP.length))
  const v = night ? 150 - age * 60 : 90 - age * 30
  return {
    col: Math.round(e.x + sway),
    row: Math.round(e.y),
    ch: SMOKE_RAMP[i],
    color: `rgba(${v | 0}, ${(v * 0.96) | 0}, ${(v * 0.95) | 0}, ${(
      0.65 *
      (1 - age)
    ).toFixed(2)})`,
  }
}
