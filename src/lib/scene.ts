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

function vnoise(x: number, y: number): number {
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

/** A links course: fairway, bunkers, a flag on the horizon. */
const links: Scene = {
  background: "#0e2a1c",
  shade: (x, y, t) => {
    const horizon = 0.42
    if (y < horizon) {
      // Overcast coastal sky.
      const k = y / horizon
      const cloud = vnoise(x * 5 - t * 0.06, y * 7)
      const v = 0.25 + k * 0.4 + cloud * 0.2
      return {
        ch: ramp(" .:-=+*", 1 - v),
        color: `rgb(${120 + v * 90 | 0}, ${140 + v * 80 | 0}, ${150 + v * 70 | 0})`,
      }
    }
    const d = (y - horizon) / (1 - horizon)
    const roll = vnoise(x * 3.2, y * 2.4 + 4) * 0.5 + vnoise(x * 9 - t * 0.1, y * 6) * 0.2
    // Bunkers: pale patches scattered across the fairway.
    const sand = vnoise(x * 4.5 + 11, y * 5 + 3)
    const isSand = sand > 0.62 && d > 0.2
    const lum = clamp01(0.35 + roll * 0.7 + d * 0.25)

    if (isSand) {
      return { ch: ramp(" .:-~", lum), color: `rgb(214, 198, 150)` }
    }
    return {
      ch: ramp(" .,:ivwW", 1 - lum * 0.7),
      color: `rgb(${40 + lum * 60 | 0}, ${110 + lum * 90 | 0}, ${50 + lum * 50 | 0})`,
    }
  },
}

/** A bowling lane running away into the dark. */
const lanes: Scene = {
  background: "#120d08",
  shade: (x, y, t) => {
    // The lane narrows toward a vanishing point.
    const vanish = 0.18
    const depth = clamp01((y - vanish) / (1 - vanish))
    const halfWidth = 0.04 + depth * 0.34
    const off = Math.abs(x - 0.5)

    if (y < vanish) {
      // The rack, seen end on: a triangle widening toward the viewer.
      const k = (y - vanish * 0.35) / (vanish * 0.65)
      const pin = k > 0 && Math.abs(x - 0.5) < 0.012 + k * 0.052
      return pin
        ? { ch: ramp(" .oO0", 0.75 + k * 0.25), color: "#f1e6d2" }
        : { ch: " ", color: "#000" }
    }

    if (off > halfWidth + 0.09) {
      return { ch: " ", color: "#000" }
    }
    if (off > halfWidth) {
      // Gutters.
      return { ch: ramp(" .:-", 0.6), color: "#3a2c1e" }
    }

    // Polished boards, with the grain running to the vanishing point.
    const board = Math.floor(((x - 0.5) / halfWidth) * 20)
    const grain = vnoise(board * 3.1, y * 14 - t * 0.4)
    const sheen = Math.exp(-Math.pow((off / halfWidth - 0.15) / 0.4, 2)) * 0.5
    const lum = clamp01(0.35 + grain * 0.3 + sheen + depth * 0.1)
    return {
      ch: ramp(" .:=|", board % 4 === 0 ? 0.85 : lum * 0.6),
      color: `rgb(${150 + lum * 90 | 0}, ${110 + lum * 80 | 0}, ${60 + lum * 60 | 0})`,
    }
  },
}

/** A library of spells, sorted by colour. */
const arcanum: Scene = {
  background: "#0b0714",
  shade: (x, y, t) => {
    // Five mana colours, drifting as slow vertical bands.
    const MANA = [
      [235, 232, 210], // white
      [90, 140, 220], // blue
      [70, 60, 80], // black
      [210, 90, 70], // red
      [110, 180, 110], // green
    ]
    const band = vnoise(x * 2.6 + t * 0.05, y * 1.6)
    const idx = Math.min(4, Math.floor(band * 5))
    const [r, g, b] = MANA[idx]

    // Shelves: horizontal rows of spines.
    const shelf = Math.abs(((y * 14) % 1) - 0.5)
    const spine = vnoise(x * 60, Math.floor(y * 14) * 7)
    const onShelf = shelf > 0.18

    if (!onShelf) {
      return { ch: ramp(" .-=", 0.5), color: "#241a38" }
    }
    const lum = clamp01(0.3 + spine * 0.8)
    return {
      ch: ramp(" .:|IH", lum),
      color: `rgb(${r * (0.35 + lum * 0.65) | 0}, ${g * (0.35 + lum * 0.65) | 0}, ${
        b * (0.35 + lum * 0.65) | 0
      })`,
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
  links,
  lanes,
  arcanum,
  void: voidScene,
}

export const sceneFor = (id: SceneId): Scene => SCENES[id] ?? voidScene
