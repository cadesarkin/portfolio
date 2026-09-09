/**
 * Sprites: drawings released from the paint app to drift around the desktop.
 *
 * Pure — no DOM, no React. The crop and the physics are here so they can be
 * tested without mounting anything.
 */

import type { Canvas, Cell } from "@/components/apps/paint/engine"
import { idx } from "@/components/apps/paint/engine"

/** One run of same-coloured characters, so a row renders as few spans. */
export interface Run {
  text: string
  color: number
}

export interface Sprite {
  id: string
  /** Rows of colour runs, cropped to the drawing's bounding box. */
  rows: Run[][]
  w: number
  h: number
  x: number
  y: number
  vx: number
  vy: number
  /** Phase offset so a crowd of sprites does not bob in unison. */
  phase: number
}

export const MAX_SPRITES = 12
/** Character cell size used to convert sprite grid units to pixels. */
export const SPRITE_CELL_W = 8
export const SPRITE_CELL_H = 14

/** Groups a row of cells into runs, dropping trailing blanks. */
function runsFor(cells: Cell[]): Run[] {
  const runs: Run[] = []
  for (const cell of cells) {
    const last = runs[runs.length - 1]
    if (last && last.color === cell.color) last.text += cell.ch
    else runs.push({ text: cell.ch, color: cell.color })
  }
  return runs
}

/**
 * Crops a canvas to the drawn area and turns it into a sprite.
 *
 * Returns null for a blank canvas — there is nothing to release, and a
 * zero-size sprite would divide by zero in the bounce maths.
 */
export function cropToSprite(
  canvas: Canvas,
  id: string,
  bounds: { w: number; h: number },
  rng: () => number = Math.random
): Sprite | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (let y = 0; y < canvas.h; y++) {
    for (let x = 0; x < canvas.w; x++) {
      if (canvas.cells[idx(canvas, x, y)].ch === " ") continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (minX === Infinity) return null

  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const rows: Run[][] = []
  for (let y = minY; y <= maxY; y++) {
    const cells: Cell[] = []
    for (let x = minX; x <= maxX; x++) cells.push(canvas.cells[idx(canvas, x, y)])
    rows.push(runsFor(cells))
  }

  const pxW = w * SPRITE_CELL_W
  const pxH = h * SPRITE_CELL_H
  // A gentle drift; fast enough to notice, slow enough not to be a nuisance.
  const angle = rng() * Math.PI * 2
  const speed = 22 + rng() * 26

  return {
    id,
    rows,
    w,
    h,
    x: Math.max(0, rng() * Math.max(1, bounds.w - pxW)),
    y: Math.max(0, rng() * Math.max(1, bounds.h - pxH)),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    phase: rng() * Math.PI * 2,
  }
}

export const spriteSize = (s: Sprite) => ({
  w: s.w * SPRITE_CELL_W,
  h: s.h * SPRITE_CELL_H,
})

/**
 * Advances a sprite, bouncing it off the edges of `bounds`.
 *
 * Position is clamped as well as reflected: a sprite that starts outside the
 * viewport — because the window was resized smaller — would otherwise keep
 * accelerating away from an edge it never reaches.
 */
export function step(
  sprite: Sprite,
  dt: number,
  bounds: { w: number; h: number }
): Sprite {
  const { w: pxW, h: pxH } = spriteSize(sprite)
  const maxX = Math.max(0, bounds.w - pxW)
  const maxY = Math.max(0, bounds.h - pxH)

  let { x, y, vx, vy } = sprite
  x += vx * dt
  y += vy * dt

  if (x <= 0) {
    x = 0
    vx = Math.abs(vx)
  } else if (x >= maxX) {
    x = maxX
    vx = -Math.abs(vx)
  }

  if (y <= 0) {
    y = 0
    vy = Math.abs(vy)
  } else if (y >= maxY) {
    y = maxY
    vy = -Math.abs(vy)
  }

  return { ...sprite, x, y, vx, vy }
}

/** Vertical bob, in pixels. Purely cosmetic, applied at render time. */
export function bob(sprite: Sprite, t: number): number {
  return Math.sin(t * 1.6 + sprite.phase) * 3
}
