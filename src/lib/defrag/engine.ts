/**
 * defrag — the rules.
 *
 * Every open window is part of the level. Each room lives in its own window,
 * the room moves with its window, and the player can walk from one room into
 * another only where their windows' edges meet cell for cell on screen.
 *
 * Pure: no DOM, no React. The game reads window geometry and hands it in as
 * placements, so every rule here can be tested with plain numbers — and the
 * tests do not depend on what the CSS happens to say today. See
 * docs/defrag-design.md for the rules in prose.
 */

/**
 * One tile, in CSS pixels. Integer on purpose: the rest of the site measures
 * the font's advance, which is fractional and differs by OS, and alignment
 * between windows cannot depend on that. Glyphs are centred in their cell.
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

export const DIRS: Dir[] = ["up", "down", "left", "right"]

const DELTA: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

/* ── Rooms ─────────────────────────────────────────────────────────────── */

export interface Fragment {
  id: string
  cols: number
  rows: number
  /** The room as drawn, with the start marker replaced by floor. */
  tiles: string[]
  start?: { x: number; y: number }
  exit?: { x: number; y: number }
}

/**
 * Reads a room from its rows. See the tile table in docs/defrag-design.md;
 * any symbol not in it is wall, which is what lets a room carry ASCII art.
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
  return { id, cols, rows: rows.length, tiles, start, exit }
}

/* ── The state a level is in ───────────────────────────────────────────── */

export interface World {
  /** Keys carried and not yet spent. */
  keys: number
  /** Tiles changed for good — keys taken, doors opened — as "room:x,y". */
  used: string[]
  /** Flipped by switches: `+` gates open and `=` gates close. */
  gates: boolean
  /** Windows a switch has released, so they can be moved. */
  unlocked: string[]
  /** Windows killed from the terminal or by a switch. */
  killed: string[]
  /** Notes already read, as "room:x,y". */
  read: string[]
}

export const newWorld = (): World => ({
  keys: 0,
  used: [],
  gates: false,
  unlocked: [],
  killed: [],
  read: [],
})

export const tileKey = (frag: string, x: number, y: number): string => `${frag}:${x},${y}`

/** A tile as it stands now: a taken key or opened door is plain floor. */
export function tileAt(frag: Fragment, x: number, y: number, world: World): string {
  if (x < 0 || y < 0 || x >= frag.cols || y >= frag.rows) return " "
  if (world.used.includes(tileKey(frag.id, x, y))) return "."
  return frag.tiles[y][x]
}

const ALWAYS = new Set([".", ">", "$", "^", "?"])

/** Whether a tile can be stood on, given what the player carries. */
export function passable(frag: Fragment, x: number, y: number, world: World): boolean {
  const t = tileAt(frag, x, y, world)
  if (ALWAYS.has(t)) return true
  if (t === "%") return world.keys > 0
  if (t === "+") return world.gates
  if (t === "=") return !world.gates
  return false
}

/* ── Windows on screen ─────────────────────────────────────────────────── */

/** A window on screen, as the rules see it. */
export interface Placement {
  /** Window id. */
  id: string
  /** Set when this window is a room of the level. */
  frag?: string
  /** The whole window, chrome included: what it covers. */
  outer: Rect
  /** The content area: the part of the room that shows. */
  body: Rect
  /** Stacking order; higher is nearer the viewer. */
  z: number
  /** The room tile at the body's top-left corner, when the window crops it. */
  ox?: number
  oy?: number
}

/** A crop of a room: which tile shows top-left, and how many show. */
export interface View {
  ox: number
  oy: number
  cols: number
  rows: number
}

export const wholeView = (f: Fragment): View => ({ ox: 0, oy: 0, cols: f.cols, rows: f.rows })

/** A room window whose body starts at a grid cell. */
export function placementAt(
  id: string,
  frag: Fragment,
  col: number,
  row: number,
  z: number,
  view: View = wholeView(frag)
): Placement {
  const body = { x: col * CELL_W, y: row * CELL_H, w: view.cols * CELL_W, h: view.rows * CELL_H }
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
    ox: view.ox,
    oy: view.oy,
  }
}

const viewCols = (p: Placement): number => Math.round(p.body.w / CELL_W)
const viewRows = (p: Placement): number => Math.round(p.body.h / CELL_H)

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
 * The screen centre of a room tile. The tile may lie outside the window's
 * crop, or outside the room — that is how the cell just past an edge is
 * found — and the centre is used so a 1px border never decides a question.
 */
function centreOf(p: Placement, x: number, y: number): [number, number] {
  return [
    p.body.x + (x - (p.ox ?? 0)) * CELL_W + CELL_W / 2,
    p.body.y + (y - (p.oy ?? 0)) * CELL_H + CELL_H / 2,
  ]
}

/** Whether a room tile shows in its window. */
const inView = (p: Placement, x: number, y: number): boolean => {
  const lx = x - (p.ox ?? 0)
  const ly = y - (p.oy ?? 0)
  return lx >= 0 && ly >= 0 && lx < viewCols(p) && ly < viewRows(p)
}

/* ── Moving ────────────────────────────────────────────────────────────── */

export type Blocked = "wall" | "door" | "gate" | "void" | "hidden" | "offscreen"

/** Whether a shown tile lies on the edge of a window a step in `dir` arrives at. */
const ENTRY_EDGE: Record<Dir, (p: Placement, lx: number, ly: number) => boolean> = {
  right: (_p, lx) => lx === 0,
  left: (p, lx) => lx === viewCols(p) - 1,
  down: (_p, _lx, ly) => ly === 0,
  up: (p, _lx, ly) => ly === viewRows(p) - 1,
}

type Landing = { frag: string; x: number; y: number } | { blocked: Blocked }

function refused(frag: Fragment, x: number, y: number, world: World): Blocked {
  const t = tileAt(frag, x, y, world)
  if (t === "%") return "door"
  if (t === "+" || t === "=") return "gate"
  return "wall"
}

/**
 * Where a step from `from` in `dir` lands, or why it cannot.
 *
 * Within the window's crop, the tile must belong to this window and be
 * uncovered. Past the window's edge, the cell must be the facing edge of
 * another room's window, on top there. Steps and lit edges both come through
 * here, so the game can never light a join the player then cannot walk.
 */
function landing(
  here: Placement,
  from: { x: number; y: number },
  dir: Dir,
  placements: Placement[],
  frags: Record<string, Fragment>,
  view: Viewport,
  world: World
): Landing {
  const own = here.frag ? frags[here.frag] : undefined
  if (!own) return { blocked: "hidden" }

  const [dx, dy] = DELTA[dir]
  const tx = from.x + dx
  const ty = from.y + dy
  const [px, py] = centreOf(here, tx, ty)
  if (!onScreen(view, px, py)) return { blocked: "offscreen" }
  const top = topAt(placements, px, py)

  if (inView(here, tx, ty)) {
    // Covered by anything at all — another room, a title bar, the terminal.
    if (top !== here) return { blocked: "hidden" }
    if (!passable(own, tx, ty, world)) return { blocked: refused(own, tx, ty, world) }
    return { frag: own.id, x: tx, y: ty }
  }

  // Stepping off the edge of the window.
  if (!top) return { blocked: "void" }
  if (!top.frag || !inside(top.body, px, py)) return { blocked: "hidden" }
  const other = frags[top.frag]
  if (!other) return { blocked: "hidden" }
  const lx = Math.floor((px - top.body.x) / CELL_W)
  const ly = Math.floor((py - top.body.y) / CELL_H)
  // A room lying across the path, rather than meeting it edge to edge, is in
  // the way: from outside, its side is a wall however much floor it has.
  if (!ENTRY_EDGE[dir](top, lx, ly)) return { blocked: "wall" }
  const x = lx + (top.ox ?? 0)
  const y = ly + (top.oy ?? 0)
  if (!passable(other, x, y, world)) return { blocked: refused(other, x, y, world) }
  return { frag: other.id, x, y }
}

export interface Player {
  /** The room the player is standing in; x and y are room tiles. */
  frag: string
  x: number
  y: number
}

/** Something that happened as the player arrived on a tile. */
export type Event =
  | { kind: "key"; at: string }
  | { kind: "door"; at: string }
  | { kind: "switch"; at: string }
  | { kind: "note"; at: string }

export interface StepResult {
  player: Player
  moved: boolean
  blocked?: Blocked
  won: boolean
  events: Event[]
}

/** One step in a direction. */
export function step(
  player: Player,
  dir: Dir,
  placements: Placement[],
  frags: Record<string, Fragment>,
  view: Viewport,
  world: World
): StepResult {
  const here = placements.find((p) => p.frag === player.frag)
  if (!here) return { player, moved: false, blocked: "hidden", won: false, events: [] }

  const target = landing(here, player, dir, placements, frags, view, world)
  if ("blocked" in target) {
    return { player, moved: false, blocked: target.blocked, won: false, events: [] }
  }

  const frag = frags[target.frag]
  const at = tileKey(target.frag, target.x, target.y)
  const t = tileAt(frag, target.x, target.y, world)
  const events: Event[] = []
  if (t === "$") events.push({ kind: "key", at })
  if (t === "%") events.push({ kind: "door", at })
  if (t === "^") events.push({ kind: "switch", at })
  if (t === "?") events.push({ kind: "note", at })

  const exit = frag.exit
  return {
    player: target,
    moved: true,
    won: Boolean(exit && exit.x === target.x && exit.y === target.y),
    events,
  }
}

/* ── What the tiles do ─────────────────────────────────────────────────── */

/** What a switch is wired to. */
export type Trigger =
  | { kind: "gates" }
  | { kind: "unlock"; frag: string }
  | { kind: "kill"; frag: string }

/** Folds a step's events into the world. Pure; the window side follows the world. */
export function applyEvents(
  world: World,
  events: Event[],
  triggers: Record<string, Trigger[]> = {}
): World {
  let w = world
  for (const e of events) {
    switch (e.kind) {
      case "key":
        w = { ...w, keys: w.keys + 1, used: [...w.used, e.at] }
        break
      case "door":
        w = { ...w, keys: w.keys - 1, used: [...w.used, e.at] }
        break
      case "note":
        if (!w.read.includes(e.at)) w = { ...w, read: [...w.read, e.at] }
        break
      case "switch":
        for (const t of triggers[e.at] ?? []) {
          if (t.kind === "gates") w = { ...w, gates: !w.gates }
          if (t.kind === "unlock" && !w.unlocked.includes(t.frag)) {
            w = { ...w, unlocked: [...w.unlocked, t.frag] }
          }
          if (t.kind === "kill" && !w.killed.includes(t.frag)) {
            w = { ...w, killed: [...w.killed, t.frag] }
          }
        }
        break
    }
  }
  return w
}

/* ── Lit edges ─────────────────────────────────────────────────────────── */

/**
 * The tiles on the edge of a room's window that currently meet another room,
 * as "x,y" in room tiles. Drawn lit, so a player dragging or cropping a window
 * sees the moment an edge connects instead of walking to it to find out.
 */
export function links(
  fragId: string,
  placements: Placement[],
  frags: Record<string, Fragment>,
  view: Viewport,
  world: World
): string[] {
  const here = placements.find((p) => p.frag === fragId)
  const frag = frags[fragId]
  if (!here || !frag) return []

  const out: string[] = []
  for (const edge of edgeTiles(here)) {
    const key = `${edge.x},${edge.y}`
    if (out.includes(key)) continue
    if (!passable(frag, edge.x, edge.y, world)) continue
    // An edge that is itself covered leads nowhere anyone can walk.
    const [sx, sy] = centreOf(here, edge.x, edge.y)
    if (topAt(placements, sx, sy) !== here) continue
    const there = landing(here, edge, edge.dir, placements, frags, view, world)
    if (!("blocked" in there)) out.push(key)
  }
  return out
}

/** The room tiles along the inside of a window's edges, with the way out. */
export function edgeTiles(p: Placement): { x: number; y: number; dir: Dir }[] {
  const ox = p.ox ?? 0
  const oy = p.oy ?? 0
  const cols = viewCols(p)
  const rows = viewRows(p)
  const out: { x: number; y: number; dir: Dir }[] = []
  for (let lx = 0; lx < cols; lx++) {
    out.push({ x: ox + lx, y: oy, dir: "up" })
    out.push({ x: ox + lx, y: oy + rows - 1, dir: "down" })
  }
  for (let ly = 0; ly < rows; ly++) {
    out.push({ x: ox, y: oy + ly, dir: "left" })
    out.push({ x: ox + cols - 1, y: oy + ly, dir: "right" })
  }
  return out
}
