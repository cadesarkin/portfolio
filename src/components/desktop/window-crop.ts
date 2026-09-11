/**
 * Cropping a window whose content is bigger than it.
 *
 * Dragging an edge moves that edge over the content, a whole cell at a time;
 * the content itself never moves. Pure, so the arithmetic — which is where a
 * crop goes wrong — is tested without a pointer in sight.
 */

import type { WinGrid } from "./window-reducer"

/** A window edge or corner a crop can be dragged from. */
export type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

export const EDGES: Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"]

export const CURSOR: Record<Edge, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
}

export interface Crop {
  ox: number
  oy: number
  cols: number
  rows: number
}

/**
 * A crop dragged `dx`, `dy` cells from an edge, kept inside the content,
 * no smaller than the minimum, and never cutting out the cell it must keep.
 */
export function cropBy(g: WinGrid, from: Crop, edge: Edge, dx: number, dy: number): Crop {
  const max = g.max ?? { cols: from.cols, rows: from.rows }
  const min = g.min ?? { cols: 1, rows: 1 }
  const keep = g.keep
  let { ox, oy, cols, rows } = from
  if (edge.includes("w")) {
    let d = Math.min(Math.max(dx, -ox), cols - min.cols)
    if (keep) d = Math.min(d, keep.x - ox)
    ox += d
    cols -= d
  }
  if (edge.includes("e")) {
    let d = Math.max(Math.min(dx, max.cols - (ox + cols)), min.cols - cols)
    if (keep) d = Math.max(d, keep.x - (ox + cols) + 1)
    cols += d
  }
  if (edge.includes("n")) {
    let d = Math.min(Math.max(dy, -oy), rows - min.rows)
    if (keep) d = Math.min(d, keep.y - oy)
    oy += d
    rows -= d
  }
  if (edge.includes("s")) {
    let d = Math.max(Math.min(dy, max.rows - (oy + rows)), min.rows - rows)
    if (keep) d = Math.max(d, keep.y - (oy + rows) + 1)
    rows += d
  }
  return { ox, oy, cols, rows }
}
