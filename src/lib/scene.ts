/**
 * Per-world ASCII scenes.
 *
 * Each world gets its own terrain function and palette, rendered by the same
 * character-grid machinery as the desktop wallpaper. Pure: a scene is a
 * function from a normalised (x, y) to a glyph and a colour, so the renderer
 * that draws it can stay tiny and identical for every world.
 */

import type { SceneId } from "./starmap"

export interface Shaded {
  ch: string
  /** CSS colour. */
  color: string
}

export interface Scene {
  /** Painted behind the glyphs. */
  background: string
  shade: (x: number, y: number, t: number) => Shaded
}

/**
 * Full-range [0, 1) hash, for anything that thresholds the raw value.
 *
 * The value-noise hash below can never exceed 0.5: its final `h ^ (h >> 16)`
 * uses an arithmetic shift, so the top bits of the shifted copy are the sign
 * bit, and XOR-ing bit 31 with itself always clears it. That is invisible
 * inside interpolated noise — it only halves the range — but it silently makes
 * any threshold above 0.5 unreachable. (It is also why this project's fbm has
 * a mean near 0.27 rather than 0.5.)
 *
 * The noise hash is deliberately left as it is: the wallpaper's cloud
 * thresholds are tuned against its actual distribution.
 */
function hash01(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  h = Math.imul(h ^ (h >>> 13), 3266489917)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Deterministic value noise, so scenes are stable frame to frame. */
function hash(x: number, y: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  h = h ^ (h >> 16)
  return (h >>> 0) / 4294967295
}

export function vnoise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi)
  const b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1)
  const d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)
const ramp = (chars: string, t: number) =>
  chars.charAt(Math.round(clamp01(t) * (chars.length - 1)))

/**
 * A library of spells, sorted by colour.
 *
 * Shelves of spines in the five mana colours, with motes of dust drifting up
 * through the lamplight. This is the one scene a program does not paint over,
 * so it is the one that has to hold up behind panels: the palette stays dark
 * and low-contrast, and the light is concentrated in a few places rather than
 * spread evenly, so text laid over it still reads.
 */
const arcanum: Scene = {
  background: "#0b0714",
  shade: (x, y, t) => {
    const MANA: [number, number, number][] = [
      [232, 228, 206], // white
      [86, 136, 214], // blue
      [96, 84, 108], // black
      [206, 88, 70], // red
      [104, 176, 106], // green
    ]

    // Dust, drifting up through the room and twinkling as it goes.
    const mx = Math.floor(x * 190)
    const my = Math.floor((y + t * 0.014) * 96)
    const mote = hash01(mx, my)
    if (mote > 0.9976) {
      const v = 0.5 + 0.5 * Math.sin(t * 3 + mote * 400)
      return { ch: v > 0.6 ? "'" : ".", color: `rgba(214, 196, 255, ${(0.25 + v * 0.5).toFixed(2)})` }
    }

    // Lamps set along the shelves; everything is lit relative to them.
    const lamp =
      Math.exp(-Math.pow((x - 0.18) / 0.16, 2)) * (0.5 + 0.16 * Math.sin(t * 1.7)) +
      Math.exp(-Math.pow((x - 0.78) / 0.19, 2)) * (0.45 + 0.14 * Math.sin(t * 1.1 + 2))

    const ROW = 0.155
    const row = Math.floor(y / ROW)
    const within = (y - row * ROW) / ROW

    // The plank each row of books stands on.
    if (within > 0.88) {
      const g = clamp01(0.16 + lamp * 0.5)
      return { ch: "=", color: `rgb(${(58 + g * 90) | 0}, ${(44 + g * 66) | 0}, ${(78 + g * 84) | 0})` }
    }

    // One book per column of the shelf, each its own height and colour.
    const book = Math.floor(x * 74)
    const height = 0.34 + hash01(book, row * 37) * 0.5
    if (within < 0.88 - height) {
      // Air above the books, falling away into the dark at the back.
      const gloom = clamp01(0.06 + lamp * 0.22)
      return { ch: gloom > 0.16 ? "." : " ", color: `rgba(52, 40, 76, ${gloom.toFixed(2)})` }
    }

    const [r, g, b] = MANA[Math.floor(hash01(book + 11, row * 19) * 5) % 5]
    // Gilt on roughly one spine in seven.
    const gilt = hash01(book + 3, row * 53) > 0.86
    const lum = clamp01(0.2 + lamp * 0.62 + hash01(book, row) * 0.16)
    const k = 0.22 + lum * 0.52
    return {
      ch: gilt ? ramp("|IHM", lum) : ramp("|:|I", lum),
      color: gilt
        ? `rgb(${(198 * k) | 0}, ${(168 * k) | 0}, ${(96 * k) | 0})`
        : `rgb(${(r * k) | 0}, ${(g * k) | 0}, ${(b * k) | 0})`,
    }
  },
}

/**
 * Deep space, for when the ship is between worlds.
 *
 * Stars come from a per-cell hash rather than interpolated noise. Smooth noise
 * almost never reaches its extremes, so a threshold high enough to be sparse
 * produced a field with barely a star in it — a starfield wants discrete
 * points, not a continuous field.
 */
const voidScene: Scene = {
  background: "#04070f",
  shade: (x, y, t) => {
    const cx = Math.floor(x * 240)
    const cy = Math.floor(y * 130)
    const n = hash01(cx, cy)
    if (n > 0.978) {
      // Twinkle on its own slow clock, offset per star.
      const v = 0.5 + 0.5 * Math.sin(t * 2.2 + n * 90)
      return {
        ch: v > 0.66 ? "*" : v > 0.33 ? "+" : ".",
        color: `rgba(210, 228, 255, ${(0.45 + v * 0.55).toFixed(2)})`,
      }
    }
    if (n > 0.947) return { ch: ".", color: "rgba(150,180,220,0.4)" }
    return { ch: " ", color: "#000" }
  },
}

export const SCENES: Record<SceneId, Scene> = {
  arcanum,
  void: voidScene,
}

export const sceneFor = (id: SceneId): Scene => SCENES[id] ?? voidScene
