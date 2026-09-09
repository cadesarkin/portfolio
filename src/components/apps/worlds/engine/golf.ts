/**
 * Side-on golf: one shot at a time, over a hilly links course.
 *
 * Pure — no canvas, no DOM. The whole game is a ballistic arc plus a ground
 * response, which is enough to make club selection and wind matter.
 */

export type Lie = "tee" | "fairway" | "rough" | "bunker" | "green"

export interface Hole {
  /** Course length in metres. */
  length: number
  par: number
  /** Where the cup sits along the course. */
  pinX: number
  /** Metres per second, positive is a tailwind. */
  wind: number
  seed: number
}

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  /** True while the ball is in the air or rolling. */
  moving: boolean
}

export interface Game {
  hole: Hole
  holeNumber: number
  ball: Ball
  strokes: number
  holed: boolean
  /** Strokes taken on holes already finished. */
  completed: { strokes: number; par: number }[]
}

export const HOLES = 9
export const GRAVITY = 22
/** Within this many metres of the pin the ball is over the cup. */
export const CUP_RADIUS = 1.6
/**
 * How fast the ball may be moving across the cup and still drop.
 *
 * Requiring it to come to rest inside the cup made holing out all but
 * impossible: the ball has to stop within a 1.6 m window, and friction rarely
 * obliges. A ball rolling slowly over the hole falls in, as it does on grass.
 * A ball travelling faster than this lips out and rolls on.
 */
export const CUP_SPEED = 4.2

function rand(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function createHole(holeNumber: number): Hole {
  const rng = rand(holeNumber * 7919 + 13)
  const par = holeNumber % 3 === 0 ? 5 : holeNumber % 3 === 1 ? 4 : 3
  const length = par === 3 ? 90 + rng() * 40 : par === 4 ? 160 + rng() * 60 : 240 + rng() * 60
  return {
    length,
    par,
    pinX: length,
    wind: (rng() * 2 - 1) * 7,
    seed: holeNumber * 104729 + 7,
  }
}

/**
 * Ground height at x, in metres above the tee.
 *
 * Deterministic from the hole's seed so the same hole plays identically every
 * time — a course that reshuffles under you is not a course.
 */
export function groundAt(hole: Hole, x: number): number {
  const rng = rand(hole.seed)
  const a = rng() * 2 - 1
  const b = rng() * 2 - 1
  const c = rng() * 2 - 1
  const k = x / hole.length
  const rolling =
    Math.sin(k * 6.1 + a * 3) * 3.4 +
    Math.sin(k * 11.7 + b * 3) * 1.6 +
    Math.sin(k * 2.3 + c * 3) * 2.2

  // The green is flattened out so putting is not a coin flip.
  const nearPin = Math.exp(-Math.pow((x - hole.pinX) / 14, 2))
  return rolling * (1 - nearPin * 0.92)
}

/** What the ball is sitting on at x. */
export function lieAt(hole: Hole, x: number): Lie {
  if (x <= 0.5) return "tee"
  if (Math.abs(x - hole.pinX) < 12) return "green"

  const rng = rand(hole.seed + 991)
  const bunkerAt = hole.pinX * (0.55 + rng() * 0.25)
  if (Math.abs(x - bunkerAt) < 7) return "bunker"

  // Rough down both edges of the fairway corridor.
  const off = Math.abs(groundAt(hole, x))
  return off > 3.2 ? "rough" : "fairway"
}

/** How much of a shot's power survives the lie. */
export const LIE_POWER: Record<Lie, number> = {
  tee: 1,
  fairway: 1,
  green: 0.55,
  rough: 0.74,
  bunker: 0.6,
}

/** How much speed the ground takes on each bounce. */
const LIE_BOUNCE: Record<Lie, number> = {
  tee: 0.4,
  fairway: 0.42,
  green: 0.34,
  rough: 0.16,
  bunker: 0.06,
}

/** Rolling friction per second. */
const LIE_FRICTION: Record<Lie, number> = {
  tee: 0.6,
  fairway: 0.62,
  green: 0.42,
  rough: 2.6,
  bunker: 4.2,
}

export function createGame(holeNumber = 1): Game {
  const hole = createHole(holeNumber)
  return {
    hole,
    holeNumber,
    ball: { x: 0, y: groundAt(hole, 0), vx: 0, vy: 0, moving: false },
    strokes: 0,
    holed: false,
    completed: [],
  }
}

/**
 * Strikes the ball.
 *
 * `power` is 0..1 and `angle` is in degrees above the horizontal. The lie
 * scales the power, which is what makes a bunker cost you a shot.
 */
export function swing(g: Game, power: number, angleDeg: number): Game {
  if (g.ball.moving || g.holed) return g
  const lie = lieAt(g.hole, g.ball.x)
  const speed = 46 * Math.max(0, Math.min(1, power)) * LIE_POWER[lie]
  const a = (angleDeg * Math.PI) / 180
  return {
    ...g,
    strokes: g.strokes + 1,
    ball: {
      ...g.ball,
      vx: Math.cos(a) * speed * facing(g),
      vy: Math.sin(a) * speed,
      moving: true,
    },
  }
}

/**
 * Which way the next shot is played: +1 up the hole, -1 back toward the tee.
 *
 * Every shot used to go right, so overshooting the green left you unable to
 * play back to it — you could only hit further away. The player always means to
 * hit at the pin, so the ball simply turns round when it is past it.
 */
export function facing(g: Game): 1 | -1 {
  return g.ball.x > g.hole.pinX ? -1 : 1
}

/** Advances the ball. Call at a fixed timestep. */
export function step(g: Game, dt: number): Game {
  if (!g.ball.moving || g.holed) return g

  const { hole } = g
  let { x, y, vx, vy } = g.ball

  // Wind only acts while the ball is airborne.
  const airborne = y > groundAt(hole, x) + 0.05
  if (airborne) vx += hole.wind * 0.12 * dt

  vy -= GRAVITY * dt
  x += vx * dt
  y += vy * dt

  const ground = groundAt(hole, x)
  if (y <= ground) {
    y = ground
    const lie = lieAt(hole, x)

    if (vy < -1.2) {
      // Bounce, losing energy to the turf.
      vy = -vy * LIE_BOUNCE[lie]
      vx *= 0.72
    } else {
      // Rolling.
      vy = 0
      const slope = (groundAt(hole, x + 1) - groundAt(hole, x - 1)) / 2
      vx -= slope * 14 * dt
      const friction = LIE_FRICTION[lie] * dt
      vx = Math.abs(vx) <= friction ? 0 : vx - Math.sign(vx) * friction
    }
  }

  // Out of bounds behind the tee: nudge it back rather than losing it.
  if (x < 0) {
    x = 0
    vx = Math.abs(vx) * 0.3
  }

  const moving = Math.abs(vx) > 0.12 || y > ground + 0.05 || Math.abs(vy) > 0.12

  // Over the cup, on the deck, and slow enough to drop in.
  const overCup = Math.abs(x - hole.pinX) <= CUP_RADIUS
  const onDeck = y <= ground + 0.05
  const holed = overCup && (!moving || (onDeck && Math.abs(vx) <= CUP_SPEED))

  return {
    ...g,
    ball: { x, y, vx, vy, moving: moving && !holed },
    holed,
  }
}

/** Distance from the ball to the pin, in metres. */
export const distanceToPin = (g: Game): number => Math.abs(g.hole.pinX - g.ball.x)

/** Moves to the next hole, banking the score for the one just finished. */
export function nextHole(g: Game): Game {
  const completed = [...g.completed, { strokes: g.strokes, par: g.hole.par }]
  if (g.holeNumber >= HOLES) return { ...g, completed }
  const next = createGame(g.holeNumber + 1)
  return { ...next, completed }
}

/** Strokes relative to par across every finished hole. */
export function toPar(g: Game): number {
  return g.completed.reduce((n, h) => n + (h.strokes - h.par), 0)
}

/** The name for a score on a hole, as a golfer would say it. */
export function scoreName(strokes: number, par: number): string {
  const d = strokes - par
  if (strokes === 1) return "hole in one"
  if (d <= -3) return "albatross"
  if (d === -2) return "eagle"
  if (d === -1) return "birdie"
  if (d === 0) return "par"
  if (d === 1) return "bogey"
  if (d === 2) return "double bogey"
  return `+${d}`
}
