/**
 * Ambient life in the wallpaper: birds by day, shooting stars by night.
 *
 * Pure — no canvas, no DOM. Positions are in character-grid units so the
 * renderer can draw them straight into the same glyph grid as the scene,
 * rather than floating DOM elements on top of it.
 */

export interface Bird {
  /** Grid column, fractional. */
  x: number
  /** Grid row, fractional. */
  y: number
  /** Columns per second; sign is the direction of travel. */
  vx: number
  /** Wingbeat offset, so a flock does not flap in unison. */
  phase: number
  /** Beats per second. Distant birds flap slower. */
  rate: number
}

export interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  /** Seconds remaining. */
  life: number
  /** Total lifetime, for fading. */
  span: number
  /** Trail length in cells. */
  tail: number
}

export interface Ambient {
  birds: Bird[]
  stars: ShootingStar[]
  /** Seconds until the next shooting star. */
  nextStar: number
}

export const FLOCK_MIN = 3
export const FLOCK_MAX = 6
/** Shooting stars are rare on purpose — constant ones read as rain. */
const STAR_GAP_MIN = 3.5
const STAR_GAP_MAX = 11

export function createAmbient(
  cols: number,
  rows: number,
  rng: () => number = Math.random
): Ambient {
  const count = FLOCK_MIN + Math.floor(rng() * (FLOCK_MAX - FLOCK_MIN + 1))
  // A loose V: each bird trails the one ahead and sits slightly lower.
  const leadX = rng() * cols
  const leadY = rows * (0.16 + rng() * 0.16)
  const dir = rng() < 0.5 ? -1 : 1
  const speed = 2.2 + rng() * 1.6

  const birds: Bird[] = []
  for (let i = 0; i < count; i++) {
    const rank = Math.ceil(i / 2)
    const side = i % 2 === 0 ? 1 : -1
    birds.push({
      x: leadX - dir * rank * 2.4,
      y: leadY + (i === 0 ? 0 : side * rank * 0.9),
      vx: dir * speed,
      phase: rng() * Math.PI * 2,
      rate: 2.4 + rng() * 1.2,
    })
  }

  return {
    birds,
    stars: [],
    nextStar: STAR_GAP_MIN + rng() * (STAR_GAP_MAX - STAR_GAP_MIN),
  }
}

/**
 * Advances the flock and the meteors.
 *
 * `night` decides which of the two is live: birds are stepped and drawn only
 * by day, shooting stars only at night. Both sets are kept either way so a
 * theme change does not reset the flock mid-flight.
 */
export function stepAmbient(
  a: Ambient,
  dt: number,
  cols: number,
  rows: number,
  night: boolean,
  rng: () => number = Math.random
): Ambient {
  const birds = night
    ? a.birds
    : a.birds.map((b) => {
        let x = b.x + b.vx * dt
        // Wrap with a margin so a bird never pops in at the very edge.
        if (b.vx > 0 && x > cols + 4) x = -4
        else if (b.vx < 0 && x < -4) x = cols + 4
        return { ...b, x }
      })

  let stars = a.stars
  let nextStar = a.nextStar

  if (night) {
    stars = a.stars
      .map((s) => ({
        ...s,
        x: s.x + s.vx * dt,
        y: s.y + s.vy * dt,
        life: s.life - dt,
      }))
      .filter((s) => s.life > 0)

    nextStar -= dt
    if (nextStar <= 0) {
      // Always downward, and always across — a vertical streak reads as a
      // falling object rather than a meteor.
      const dir = rng() < 0.5 ? -1 : 1
      // Slow and long-lived on purpose. The first pass used a fast, short
      // streak that was gone before the eye could find it.
      const speed = 15 + rng() * 13
      const span = 1.6 + rng() * 1.1
      stars = [
        ...stars,
        {
          x: dir > 0 ? -6 + rng() * cols * 0.5 : cols + 6 - rng() * cols * 0.5,
          y: rows * (0.04 + rng() * 0.3),
          vx: dir * speed,
          vy: speed * (0.32 + rng() * 0.25),
          life: span,
          span,
          tail: 11 + Math.floor(rng() * 8),
        },
      ]
      nextStar = STAR_GAP_MIN + rng() * (STAR_GAP_MAX - STAR_GAP_MIN)
    }
  }

  return { birds, stars, nextStar }
}

/** Two-frame wingbeat. `-` is the glide, `v` the downstroke. */
export function birdGlyph(bird: Bird, t: number): string {
  return Math.sin(t * bird.rate + bird.phase) > 0 ? "v" : "-"
}

export interface Cell {
  col: number
  row: number
  ch: string
  /** 0..1, for fading a trail out. */
  alpha: number
}

/** The cells a shooting star occupies: a bright head with a fading tail. */
export function starCells(s: ShootingStar): Cell[] {
  const cells: Cell[] = []
  const len = Math.hypot(s.vx, s.vy) || 1
  const ux = s.vx / len
  const uy = s.vy / len
  // Fade in and out over its life so it does not blink into existence, but
  // hold near full brightness for most of it.
  const life = s.life / s.span
  const envelope = Math.min(1, life * 4, (1 - life) * 8 + 0.5)

  for (let i = 0; i < s.tail; i++) {
    const col = Math.round(s.x - ux * i)
    const row = Math.round(s.y - uy * i)
    const along = 1 - i / s.tail
    cells.push({
      col,
      row,
      ch: i === 0 ? "*" : i === 1 ? "+" : i < 5 ? "-" : ".",
      // Squared falloff keeps the head bright while the tail thins out.
      alpha: Math.max(0, along * along * envelope),
    })
  }
  return cells
}
