/**
 * defrag — hunting for shortcuts.
 *
 * A level is only as hard as its shortest solution. This searches for short
 * ones, so a level meant to take a dozen moves cannot quietly be done in
 * three. It plays generously: bringing a window forward costs nothing, the
 * player may stand wherever they could walk to, and hostile windows may be in
 * whichever state suits. A shortcut it cannot find is one a player would
 * struggle to find too.
 *
 * It is not a proof. Past a few moves there are far too many layouts to try
 * them all, so it keeps the most promising few hundred at each move — the
 * ones where the player can reach the most — and follows only moves that do
 * something: a drag that joins a room to where the player can already walk,
 * a drag of the room the player stands in, a cut along a window's edge, a
 * kill. Pure.
 */

import {
  DIRS,
  applyEvents,
  passable,
  step,
  tileAt,
  type Dir,
  type Fragment,
  type Placement,
  type View,
  type Viewport,
  type World,
} from "./engine"
import { MIN_CROP, revealed, roomsOf, type Level, type Move } from "./levels"
import { croppable, draggable, initialSim, placementsOf, type SimState } from "./simulate"

const DELTA: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" }

/** Tiles that could ever be walked on, given the right key or switch. */
const EVER = new Set([".", ">", "$", "%", "^", "?", "+", "="])

export interface HuntOptions {
  view: Viewport
  /** The most moves to look for a solution in. */
  maxMoves: number
  /** Layouts kept at each move. */
  beam?: number
}

export interface HuntResult {
  solved: boolean
  /** The moves of the solution found, when one was. */
  moves: Move[]
  /** Layouts whose walkable area was worked out. */
  explored: number
}

const sorted = (xs: string[]) => [...xs].sort().join(",")

const worldKey = (w: World): string =>
  `${w.keys}|${w.gates ? 1 : 0}|${sorted(w.used)}|${sorted(w.unlocked)}|${sorted(w.killed)}|${sorted(w.read)}`

const layoutKey = (s: SimState): string =>
  Object.keys(s.rooms)
    .sort()
    .map((id) => {
      const r = s.rooms[id]
      const v = r.view
      return `${id}${r.col},${r.row},${v.ox},${v.oy},${v.cols},${v.rows}${r.hidden ? "h" : ""}`
    })
    .join(";")

const stateKey = (s: SimState): string =>
  `${layoutKey(s)}|${worldKey(s.world)}|${s.player.frag}:${s.player.x},${s.player.y}`

/** Every combination of states the level's hostile windows could be in, from here. */
function hostileStates(level: Level, s: SimState): SimState[] {
  let out = [s]
  for (const r of level.rooms) {
    const h = r.hostile
    if (!h || s.world.killed.includes(r.id)) continue
    if (h.kind === "wander") {
      out = out.flatMap((o) =>
        h.spots.map((spot) => ({ ...o, rooms: { ...o.rooms, [r.id]: { ...o.rooms[r.id], ...spot } } }))
      )
    } else if (h.kind === "blink") {
      out = out.flatMap((o) =>
        o.player.frag === r.id
          ? [o]
          : [false, true].map((hidden) => ({
              ...o,
              rooms: { ...o.rooms, [r.id]: { ...o.rooms[r.id], hidden } },
            }))
      )
    }
  }
  return out
}

interface Closure {
  won: boolean
  /** Every tile the player could stand on, as "room:x,y". */
  tiles: Set<string>
  /** One state per distinct place to stand and world to stand in. */
  reps: SimState[]
  score: number
}

/**
 * Everything reachable without touching a window: walking, picking things
 * up, throwing switches, and waiting for hostile windows to move.
 */
function closure(level: Level, start: SimState, view: Viewport, frags: Record<string, Fragment>): Closure {
  const seen = new Set<string>()
  const queue: SimState[] = []
  const push = (s: SimState) => {
    const k = stateKey(s)
    if (seen.has(k)) return
    seen.add(k)
    queue.push(s)
  }
  hostileStates(level, start).forEach(push)

  const tiles = new Set<string>()
  const reps = new Map<string, SimState>()
  const placements = new Map<string, Placement[]>()
  let best = 0

  for (let i = 0; i < queue.length; i++) {
    const s = queue[i]
    const { frag, x, y } = s.player
    tiles.add(`${frag}:${x},${y}`)
    const lk = layoutKey(s)
    const wk = worldKey(s.world)
    const rep = `${lk}|${wk}|${frag}|${componentOf(frags[frag], x, y, s.world)}`
    if (!reps.has(rep)) reps.set(rep, s)
    const w = s.world
    best = Math.max(best, w.keys * 40 + w.used.length * 30 + w.unlocked.length * 40 + w.killed.length * 50 + w.read.length * 20)

    let pl = placements.get(lk)
    if (!pl) {
      pl = placementsOf(level, s)
      placements.set(lk, pl)
    }
    for (const dir of DIRS) {
      const r = step(s.player, dir, pl, frags, view, s.world, true)
      if (!r.moved) continue
      if (r.won) return { won: true, tiles, reps: [], score: Infinity }
      push({ ...s, player: r.player, world: applyEvents(s.world, r.events, level.triggers) })
    }
    hostileStates(level, s).forEach(push)
  }
  return { won: false, tiles, reps: [...reps.values()], score: tiles.size + best }
}

const components = new Map<string, number>()

/** Which walled-off part of its room a tile is in, walls and world as they stand. */
function componentOf(f: Fragment, x: number, y: number, world: World): number {
  const key = `${f.id}|${world.gates ? 1 : 0}|${world.keys > 0 ? 1 : 0}|${sorted(world.used)}|${x},${y}`
  const known = components.get(key)
  if (known !== undefined) return known
  const seen = new Set([y * f.cols + x])
  const queue = [[x, y]]
  let id = y * f.cols + x
  for (let i = 0; i < queue.length; i++) {
    const [cx, cy] = queue[i]
    for (const [dx, dy] of Object.values(DELTA)) {
      const nx = cx + dx
      const ny = cy + dy
      const n = ny * f.cols + nx
      if (nx < 0 || ny < 0 || nx >= f.cols || ny >= f.rows || seen.has(n)) continue
      if (!passable(f, nx, ny, world)) continue
      seen.add(n)
      id = Math.min(id, n)
      queue.push([nx, ny])
    }
  }
  if (components.size > 200_000) components.clear()
  components.set(key, id)
  return id
}

interface Door {
  x: number
  y: number
  /** The way out of the room through this tile. */
  side: Dir
}

/** Tiles along a window's edges that could ever be walked through. */
function doorsOf(f: Fragment, v: View, world: World): Door[] {
  const out: Door[] = []
  const add = (x: number, y: number, side: Dir) => {
    if (EVER.has(tileAt(f, x, y, world))) out.push({ x, y, side })
  }
  for (let x = v.ox; x < v.ox + v.cols; x++) {
    add(x, v.oy, "up")
    add(x, v.oy + v.rows - 1, "down")
  }
  for (let y = v.oy; y < v.oy + v.rows; y++) {
    add(v.ox, y, "left")
    add(v.ox + v.cols - 1, y, "right")
  }
  return out
}

/** Whether a window's content area at a cell stays on the screen. */
function fits(bodyCol: number, bodyRow: number, v: View, view: Viewport): boolean {
  const cols = Math.floor(view.w / 10)
  const rows = Math.floor((view.h - 32) / 20)
  return bodyCol >= 0 && bodyRow >= 2 && bodyCol + v.cols <= cols && bodyRow + v.rows <= rows
}

/** The moves worth trying from a state, each with the state it leads to. */
function movesFrom(
  level: Level,
  s: SimState,
  tiles: Set<string>,
  view: Viewport,
  frags: Record<string, Fragment>
): [Move, SimState, number][] {
  const out: [Move, SimState, number][] = []
  const world = s.world
  const visible = level.rooms.filter((r) => !s.rooms[r.id].hidden && !world.killed.includes(r.id))

  for (const pid of revealed(level, world)) {
    const r = level.rooms.find((q) => q.pid === pid)
    if (!r || world.killed.includes(r.id) || s.player.frag === r.id) continue
    out.push([{ kill: pid }, { ...s, world: { ...world, killed: [...world.killed, r.id] } }, 50])
  }

  for (const r of visible) {
    const room = s.rooms[r.id]
    const f = frags[r.id]
    const ferry = s.player.frag === r.id

    if (draggable(r, world, s.player)) {
      const mine = doorsOf(f, room.view, world)
      for (const other of visible) {
        if (other.id === r.id) continue
        const o = s.rooms[other.id]
        for (const theirs of doorsOf(frags[other.id], o.view, world)) {
          // Joining where the player can already walk, unless the room goes
          // with them — then it can go anywhere.
          if (!ferry && !tiles.has(`${other.id}:${theirs.x},${theirs.y}`)) continue
          for (const d of mine) {
            if (d.side !== OPPOSITE[theirs.side]) continue
            const [dx, dy] = DELTA[d.side]
            const col = o.col + theirs.x - dx - d.x
            const row = o.row + theirs.y - dy - d.y
            if (col === room.col && row === room.row) continue
            if (!fits(col + room.view.ox, row + room.view.oy, room.view, view)) continue
            out.push([
              { place: r.id, col, row },
              { ...s, rooms: { ...s.rooms, [r.id]: { ...room, col, row } } },
              ferry ? 20 : 10,
            ])
          }
        }
      }
    }

    if (croppable(r, world)) {
      const v = room.view
      const crops: View[] = []
      for (let ox = 0; ox <= v.ox + v.cols - MIN_CROP.cols; ox++) {
        if (ox !== v.ox) crops.push({ ...v, ox, cols: v.ox + v.cols - ox })
      }
      for (let cols = MIN_CROP.cols; cols <= f.cols - v.ox; cols++) {
        if (cols !== v.cols) crops.push({ ...v, cols })
      }
      for (let oy = 0; oy <= v.oy + v.rows - MIN_CROP.rows; oy++) {
        if (oy !== v.oy) crops.push({ ...v, oy, rows: v.oy + v.rows - oy })
      }
      for (let rows = MIN_CROP.rows; rows <= f.rows - v.oy; rows++) {
        if (rows !== v.rows) crops.push({ ...v, rows })
      }
      for (const c of crops) {
        const p = s.player
        if (ferry && (p.x < c.ox || p.y < c.oy || p.x >= c.ox + c.cols || p.y >= c.oy + c.rows)) continue
        if (!fits(room.col + c.ox, room.row + c.oy, c, view)) continue
        out.push([{ crop: r.id, view: c }, { ...s, rooms: { ...s.rooms, [r.id]: { ...room, view: c } } }, 5])
      }
    }
  }
  return out
}

/** Looks for a solution in at most `maxMoves` moves. */
export function hunt(level: Level, { view, maxMoves, beam = 150 }: HuntOptions): HuntResult {
  const frags = roomsOf(level)
  type Node = { s: SimState; moves: Move[]; score: number }
  let layer: Node[] = [{ s: initialSim(level), moves: [], score: 0 }]
  const tried = new Set<string>()
  let explored = 0

  for (let depth = 0; depth <= maxMoves && layer.length; depth++) {
    const next: Node[] = []
    for (const node of layer) {
      const c = closure(level, node.s, view, frags)
      explored++
      if (c.won) return { solved: true, moves: node.moves, explored }
      if (depth === maxMoves) continue
      for (const rep of c.reps) {
        for (const [move, child, bonus] of movesFrom(level, rep, c.tiles, view, frags)) {
          const key = stateKey(child)
          if (tried.has(key)) continue
          tried.add(key)
          next.push({ s: child, moves: [...node.moves, move], score: c.score + bonus })
        }
      }
    }
    // The most promising first; ties broken by the key, so a run is repeatable.
    next.sort((a, b) => b.score - a.score || (stateKey(a.s) < stateKey(b.s) ? -1 : 1))
    layer = next.slice(0, beam)
  }
  return { solved: false, moves: [], explored }
}
