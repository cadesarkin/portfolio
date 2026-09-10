/**
 * defrag — the rules.
 *
 * Every open window is part of the level. Each fragment window holds a small
 * ASCII room, the room moves with its window, and the player can walk from one
 * room into another only where the two meet cell for cell on screen. Dragging
 * windows is how you build the path.
 *
 * Pure: no DOM, no React. The game reads window geometry once and hands it in
 * as placements, so every rule here can be tested with plain numbers — and so
 * the tests do not depend on what the CSS happens to say today.
 *
 * Two rules carry the design.
 *
 * You can only walk where you can see. A tile covered by any window — another
 * room, a title bar, the terminal — cannot be stepped on. Z-order stops being
 * cosmetic and becomes part of the puzzle, which is what makes "always on top"
 * a hazard without any special case.
 *
 * Rooms join only at their edges. Leaving a room means stepping off its edge
 * onto the facing edge of another. An earlier version joined overlapping rooms
 * wherever floor showed through, and a test found that every level could then
 * be skipped by dropping the exit room on top of the start room.
 */

/**
 * One tile, in CSS pixels. Integer on purpose: the rest of the site measures
 * the font's advance, which is fractional and differs by OS, and edge
 * alignment between windows cannot depend on that. Glyphs are centred in
 * their cell rather than placed by the font.
 */
export const CELL_W = 10
export const CELL_H = 20

/**
 * The window chrome around a body: a 1px border, and on top the 32px title bar
 * and its 1px rule. Used to lay levels out and by the tests. The live game
 * measures the DOM instead, so a CSS change cannot quietly break alignment.
 */
export const CHROME = { left: 1, right: 1, top: 34, bottom: 1 }

/** Rows at the bottom of the screen that belong to the taskbar. */
export const TASKBAR_H = 32

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Viewport {
  w: number
  h: number
}

export type Dir = "up" | "down" | "left" | "right"

const DELTA: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

export interface Port {
  x: number
  y: number
  dir: Dir
}

export interface Fragment {
  id: string
  cols: number
  rows: number
  /** The room as drawn, with the start marker replaced by floor. */
  tiles: string[]
  start?: { x: number; y: number }
  exit?: { x: number; y: number }
  /** Floor on an edge: where this room can meet another. */
  ports: Port[]
  walkable: (x: number, y: number) => boolean
}

const FLOOR = new Set([".", ">"])

/**
 * Reads a room from its rows.
 *
 * `#` and any other symbol are wall, `.` is floor, a space is void — nothing
 * there at all. `@` marks where the player starts and `>` the way out; both
 * are floor.
 */
export function parseFragment(id: string, rows: string[]): Fragment {
  const cols = rows[0]?.length ?? 0
  if (rows.some((r) => r.length !== cols)) {
    throw new Error(`fragment ${id}: every row must be ${cols} wide`)
  }

  let start: Fragment["start"]
  let exit: Fragment["exit"]
  const tiles = rows.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (ch === "@") {
          start = { x, y }
          return "."
        }
        if (ch === ">") exit = { x, y }
        return ch
      })
      .join("")
  )

  const walkable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < cols && y < rows.length && FLOOR.has(tiles[y][x])

  const ports: Port[] = []
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < cols; x++) {
      if (!walkable(x, y)) continue
      if (y === 0) ports.push({ x, y, dir: "up" })
      if (y === rows.length - 1) ports.push({ x, y, dir: "down" })
      if (x === 0) ports.push({ x, y, dir: "left" })
      if (x === cols - 1) ports.push({ x, y, dir: "right" })
    }
  }

  return { id, cols, rows: rows.length, tiles, start, exit, ports, walkable }
}

/** A window on screen, as the rules see it. */
export interface Placement {
  /** Window id. */
  id: string
  /** Set when this window is a fragment of the level. */
  frag?: string
  /** The whole window, chrome included: what it covers. */
  outer: Rect
  /** The content area: where a fragment's tiles are. */
  body: Rect
  /** Stacking order; higher is nearer the viewer. */
  z: number
}

/** A fragment window whose body starts at a grid cell. */
export function placementAt(
  id: string,
  frag: Fragment,
  col: number,
  row: number,
  z: number
): Placement {
  const body = {
    x: col * CELL_W,
    y: row * CELL_H,
    w: frag.cols * CELL_W,
    h: frag.rows * CELL_H,
  }
  return {
    id,
    frag: frag.id,
    body,
    outer: {
      x: body.x - CHROME.left,
      y: body.y - CHROME.top,
      w: body.w + CHROME.left + CHROME.right,
      h: body.h + CHROME.top + CHROME.bottom,
    },
    z,
  }
}

const inside = (r: Rect, px: number, py: number): boolean =>
  px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h

/** The window nearest the viewer at a screen point, if any. */
export function topAt(placements: Placement[], px: number, py: number): Placement | undefined {
  let best: Placement | undefined
  for (const p of placements) {
    if (!inside(p.outer, px, py)) continue
    if (!best || p.z > best.z) best = p
  }
  return best
}

const onScreen = (view: Viewport, px: number, py: number): boolean =>
  px >= 0 && py >= 0 && px < view.w && py < view.h - TASKBAR_H

/**
 * The centre of a fragment's tile on screen.
 *
 * Tiles outside the room are allowed — that is how the cell just past an edge
 * is found — and the centre is used rather than a corner so a 1px window
 * border can never decide which window a cell belongs to.
 */
function centreOf(p: Placement, x: number, y: number): [number, number] {
  return [p.body.x + x * CELL_W + CELL_W / 2, p.body.y + y * CELL_H + CELL_H / 2]
}

type Blocked = "wall" | "void" | "hidden" | "offscreen"

/** Whether a tile lies on the edge of a room that a step in `dir` arrives at. */
const ENTRY_EDGE: Record<Dir, (f: Fragment, x: number, y: number) => boolean> = {
  right: (_f, x) => x === 0,
  left: (f, x) => x === f.cols - 1,
  down: (_f, _x, y) => y === 0,
  up: (f, _x, y) => y === f.rows - 1,
}

/**
 * Where a step from `from` in `dir` lands, or why it cannot.
 *
 * Inside the room, the tile must belong to this window and be uncovered. Past
 * the edge, the cell must be the facing edge of another room that is on top
 * there. Steps and lit ports both come through here, so the game can never
 * light a join the player then cannot walk through.
 */
function landing(
  here: Placement,
  from: { x: number; y: number },
  dir: Dir,
  placements: Placement[],
  frags: Record<string, Fragment>,
  view: Viewport
): { frag: string; x: number; y: number } | { blocked: Blocked } {
  const own = here.frag ? frags[here.frag] : undefined
  if (!own) return { blocked: "hidden" }

  const [dx, dy] = DELTA[dir]
  const tx = from.x + dx
  const ty = from.y + dy
  const [px, py] = centreOf(here, tx, ty)
  if (!onScreen(view, px, py)) return { blocked: "offscreen" }
  const top = topAt(placements, px, py)

  if (tx >= 0 && ty >= 0 && tx < own.cols && ty < own.rows) {
    // Covered by anything at all — another room, a title bar, the terminal.
    if (top !== here) return { blocked: "hidden" }
    if (!own.walkable(tx, ty)) return { blocked: "wall" }
    return { frag: own.id, x: tx, y: ty }
  }

  // Stepping off the edge.
  if (!top) return { blocked: "void" }
  if (!top.frag || !inside(top.body, px, py)) return { blocked: "hidden" }
  const other = frags[top.frag]
  if (!other) return { blocked: "hidden" }
  const x = Math.floor((px - top.body.x) / CELL_W)
  const y = Math.floor((py - top.body.y) / CELL_H)
  // A room lying across the path, rather than meeting it edge to edge, is in
  // the way: from outside, its side is a wall however much floor it has.
  if (!ENTRY_EDGE[dir](other, x, y)) return { blocked: "wall" }
  if (!other.walkable(x, y)) return { blocked: "wall" }
  return { frag: other.id, x, y }
}

export interface Player {
  /** The fragment the player is standing in. */
  frag: string
  x: number
  y: number
}

export interface StepResult {
  player: Player
  moved: boolean
  blocked?: Blocked
  won: boolean
}

/** One step in a direction. */
export function step(
  player: Player,
  dir: Dir,
  placements: Placement[],
  frags: Record<string, Fragment>,
  view: Viewport
): StepResult {
  const here = placements.find((p) => p.frag === player.frag)
  if (!here) return { player, moved: false, blocked: "hidden", won: false }

  const target = landing(here, player, dir, placements, frags, view)
  if ("blocked" in target) return { player, moved: false, blocked: target.blocked, won: false }

  const exit = frags[target.frag]?.exit
  return {
    player: target,
    moved: true,
    won: Boolean(exit && exit.x === target.x && exit.y === target.y),
  }
}

/**
 * The ports of a fragment that currently meet floor in another room.
 *
 * Drawn lit, so a player dragging a window can see the moment an edge connects
 * instead of having to walk to it to find out.
 */
export function links(
  fragId: string,
  placements: Placement[],
  frags: Record<string, Fragment>,
  view: Viewport
): string[] {
  const here = placements.find((p) => p.frag === fragId)
  const frag = frags[fragId]
  if (!here || !frag) return []

  const out: string[] = []
  for (const port of frag.ports) {
    const key = `${port.x},${port.y}`
    if (out.includes(key)) continue
    // A port that is itself covered leads nowhere anyone can walk.
    const [sx, sy] = centreOf(here, port.x, port.y)
    if (topAt(placements, sx, sy) !== here) continue
    const there = landing(here, port, port.dir, placements, frags, view)
    if (!("blocked" in there)) out.push(key)
  }
  return out
}
