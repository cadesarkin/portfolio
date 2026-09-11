/**
 * Space, as the wallpaper shows it once the ship has launched.
 *
 * Pure — no canvas. Planets are shaded spheres worked out per character cell;
 * visitors are small ASCII craft and creatures crossing the screen. The
 * renderer in SpaceCanvas turns these into glyphs.
 */

import { mirror, width } from "./crash-site"
import { vnoise } from "./scene"

export type RGB = [number, number, number]

/* ── Planets ──────────────────────────────────────────────────────────── */

export type Surface = "gas" | "rock" | "ice" | "moon"

export interface Planet {
  id: string
  /** Centre, as a fraction of the screen. */
  x: number
  y: number
  /** Radius, as a fraction of the screen's height. */
  r: number
  surface: Surface
  /** Radians per second the surface turns. */
  spin: number
  /** Rings, as multiples of the radius, and how far they tilt toward us. */
  rings?: { inner: number; outer: number; tilt: number; angle: number }
  /** Circles another planet: its id, distance in radii of that planet, and period in seconds. */
  orbit?: { around: string; distance: number; period: number }
}

export const PLANETS: Planet[] = [
  {
    id: "giant",
    x: 0.3,
    y: 0.74,
    r: 0.2,
    surface: "gas",
    spin: 0.05,
    rings: { inner: 1.3, outer: 2.05, tilt: 0.26, angle: -0.32 },
  },
  { id: "ember", x: 0.86, y: 0.2, r: 0.065, surface: "rock", spin: 0.08 },
  { id: "tide", x: 0.55, y: 0.1, r: 0.032, surface: "ice", spin: 0.12 },
  {
    id: "moon",
    x: 0,
    y: 0,
    r: 0.035,
    surface: "moon",
    spin: 0.02,
    orbit: { around: "giant", distance: 2.9, period: 240 },
  },
]

/** Where a planet is at a time, in fractions of the screen. Moons go round. */
export function planetAt(p: Planet, t: number, aspect: number): { x: number; y: number } {
  if (!p.orbit) return { x: p.x, y: p.y }
  const host = PLANETS.find((q) => q.id === p.orbit!.around)!
  const a = (t / p.orbit.period) * Math.PI * 2 + 2.2
  const d = host.r * p.orbit.distance
  // The orbit is a circle seen from above it, squashed: a moon in front of
  // its planet is lower on screen than one behind it.
  return { x: host.x + (Math.cos(a) * d) / aspect, y: host.y + Math.sin(a) * d * 0.35 }
}

/** Whether a moon is on the far side of its planet right now. */
export function behind(p: Planet, t: number): boolean {
  if (!p.orbit) return false
  return Math.sin((t / p.orbit.period) * Math.PI * 2 + 2.2) < 0
}

const LIGHT = (() => {
  const v = [-0.55, -0.45, 0.7]
  const n = Math.hypot(v[0], v[1], v[2])
  return v.map((c) => c / n)
})()

export const PLANET_RAMP = " .:-=+*#%@"

const PALETTE: Record<Surface, [RGB, RGB]> = {
  gas: [
    [226, 176, 112],
    [148, 92, 58],
  ],
  rock: [
    [214, 98, 70],
    [110, 40, 32],
  ],
  ice: [
    [150, 214, 255],
    [46, 110, 180],
  ],
  moon: [
    [200, 200, 196],
    [110, 112, 118],
  ],
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

export interface Shade {
  ch: string
  fg: RGB
  /** Filled behind the glyph, dimmer than it. */
  bg: RGB
}

/**
 * A planet's surface at a point, `u` and `v` in radii from its centre (`v`
 * down), or null off the disc. Lit from the upper left.
 */
export function surfaceAt(p: Planet, u: number, v: number, t: number): Shade | null {
  const d2 = u * u + v * v
  if (d2 > 1) return null
  const nz = Math.sqrt(1 - d2)
  const lit = Math.max(0, u * LIGHT[0] + v * LIGHT[1] + nz * LIGHT[2])
  const lon = Math.atan2(u, nz) + t * p.spin
  const lat = Math.asin(Math.max(-1, Math.min(1, -v)))
  const [a, b] = PALETTE[p.surface]

  let tone: number
  switch (p.surface) {
    case "gas": {
      // Bands that wobble, and one storm that turns with the planet.
      const wobble = 1.1 * Math.sin(lon * 2 + lat * 3) + 0.8 * vnoise(lon * 2.5 + 40, lat * 6)
      tone = 0.5 + 0.5 * Math.sin(lat * 10 + wobble)
      const storm = Math.hypot((((lon - 1.2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI, (lat + 0.35) * 3)
      if (storm < 0.45) tone = 0.95
      break
    }
    case "ice":
      tone = vnoise(lon * 3 + 10, lat * 5) * 1.6
      break
    default:
      // Craters: dark pits where the noise dips.
      tone = 0.35 + vnoise(lon * 4 + 20, lat * 4) * 0.9 + (vnoise(lon * 11, lat * 11) < 0.15 ? 0.4 : 0)
  }
  const colour = mix(a, b, Math.max(0, Math.min(1, tone)))
  const bright = 0.06 + lit * 0.94
  const i = Math.round(Math.min(1, bright * 1.1) * (PLANET_RAMP.length - 1))
  // Never a blank on the disc: the night side is dim, not a hole.
  const ch = PLANET_RAMP.charAt(Math.max(1, i))
  return {
    ch,
    fg: colour.map((c) => Math.min(255, c * (0.3 + bright * 0.95))) as RGB,
    bg: colour.map((c) => c * bright * 0.3) as RGB,
  }
}

/**
 * A ring at a point, in the planet's radii, or null. `front` is whether that
 * part of the ring passes in front of the planet rather than behind it.
 */
export function ringAt(p: Planet, u: number, v: number): { ch: string; fg: RGB; front: boolean } | null {
  const rg = p.rings
  if (!rg) return null
  const cos = Math.cos(rg.angle)
  const sin = Math.sin(rg.angle)
  const ru = u * cos + v * sin
  const rv = -u * sin + v * cos
  const r = Math.hypot(ru, rv / rg.tilt)
  if (r < rg.inner || r > rg.outer) return null
  // A gap two thirds of the way out, the way real rings have them.
  const gap = rg.inner + (rg.outer - rg.inner) * 0.64
  if (Math.abs(r - gap) < 0.05) return null
  const band = (r - rg.inner) / (rg.outer - rg.inner)
  return {
    ch: band < 0.3 ? "=" : band < 0.64 ? "-" : "~",
    fg: [222 - band * 50, 196 - band * 50, 150 - band * 40],
    front: rv > 0,
  }
}

/* ── Visitors ─────────────────────────────────────────────────────────── */

const art = (s: string): string[] => s.split("\n").slice(1, -1)

export interface Kind {
  id: string
  /** Facing right. */
  art: string[]
  color: string
  /** Characters per second. */
  speed: [number, number]
  /** Lines it bobs up and down by. */
  bob: number
  /** How often it turns up, relative to the others. */
  weight: number
  /** Characters that blink: running lights. */
  lights?: string
}

export const KINDS: Kind[] = [
  {
    id: "fighter",
    art: art(String.raw`
   __
 -=\ \___
-==[____>>
 -=/_/
`),
    color: "#9ecbff",
    speed: [16, 24],
    bob: 0,
    weight: 3,
  },
  {
    id: "freighter",
    art: art(String.raw`
         ______________________
     ___/ [] [] [] [] [] []   \____
-=##|______________________________>
         \____/          \____/
`),
    color: "#c3ccd6",
    speed: [2.5, 4],
    bob: 0,
    weight: 1.5,
    lights: "[]",
  },
  {
    id: "saucer",
    art: art(String.raw`
     _.---._
   .'(o_o) '.
  (=*=*=*=*=*)
   '-._____.-'
`),
    color: "#8ef08a",
    speed: [5, 8],
    bob: 1,
    weight: 2,
    lights: "*",
  },
  {
    id: "astronaut",
    art: art(String.raw`
  .-.
 (o.o)
 /|=|\
  / \
`),
    color: "#f2f2e8",
    speed: [1.5, 2.5],
    bob: 0.6,
    weight: 1,
  },
  {
    id: "comet",
    art: ["- - -~~~==*"],
    color: "#bfe8ff",
    speed: [26, 36],
    bob: 0,
    weight: 1.5,
  },
  {
    id: "satellite",
    art: ["[##]-(o)-[##]"],
    color: "#d9d3b0",
    speed: [3, 4.5],
    bob: 0,
    weight: 1,
    lights: "o",
  },
  {
    id: "swarm",
    art: art(String.raw`
<o>
     <o>
<o>
`),
    color: "#ff8fb8",
    speed: [9, 13],
    bob: 0.5,
    weight: 1.5,
  },
]

export interface Visitor {
  kind: string
  /** Column of the art's left edge, fractional. */
  x: number
  /** Row of the art's top line. */
  y: number
  /** Characters per second; negative moves left. */
  vx: number
  /** The art, already facing the way it flies. */
  art: string[]
  phase: number
}

/** The most visitors on screen at once. */
export const MAX_VISITORS = 4

export function spawnVisitor(cols: number, rows: number, rng: () => number = Math.random): Visitor {
  const total = KINDS.reduce((n, k) => n + k.weight, 0)
  let roll = rng() * total
  const kind = KINDS.find((k) => (roll -= k.weight) < 0) ?? KINDS[0]
  const right = rng() < 0.5
  const speed = kind.speed[0] + rng() * (kind.speed[1] - kind.speed[0])
  const w = width(kind.art)
  const top = Math.floor(2 + rng() * Math.max(1, rows - kind.art.length - 6))
  return {
    kind: kind.id,
    x: right ? -w - 1 : cols + 1,
    y: top,
    vx: right ? speed : -speed,
    art: right ? kind.art : mirror(kind.art),
    phase: rng() * Math.PI * 2,
  }
}

/** Moves visitors along, dropping the ones that have left the screen. */
export function stepVisitors(list: Visitor[], dt: number, cols: number): Visitor[] {
  return list
    .map((v) => ({ ...v, x: v.x + v.vx * dt }))
    .filter((v) => (v.vx > 0 ? v.x < cols + 2 : v.x + width(v.art) > -2))
}

/* ── Stars ────────────────────────────────────────────────────────────── */

export interface Star {
  x: number
  y: number
  /** 0 is farthest and slowest. */
  layer: 0 | 1 | 2
  phase: number
}

export const STAR_GLYPHS = [".", "+", "*"] as const
/** Characters per second each layer drifts left. */
export const STAR_DRIFT = [0.25, 0.7, 1.6] as const

export function makeStars(cols: number, rows: number, rng: () => number = Math.random): Star[] {
  const n = Math.round((cols * rows) / 55)
  return Array.from({ length: n }, () => {
    const roll = rng()
    return {
      x: rng() * cols,
      y: rng() * rows,
      layer: roll < 0.7 ? 0 : roll < 0.93 ? 1 : 2,
      phase: rng() * Math.PI * 2,
    }
  })
}

export function stepStars(stars: Star[], dt: number, cols: number): Star[] {
  return stars.map((s) => {
    // Off the left edge and round again on the right, however far it went.
    const lap = cols + 2
    const x = ((((s.x - STAR_DRIFT[s.layer] * dt + 1) % lap) + lap) % lap) - 1
    return { ...s, x }
  })
}
