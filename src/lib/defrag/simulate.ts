/**
 * defrag — playing a level without a screen.
 *
 * A level's solution is a script of the things a player does: drag a window,
 * crop it, click one forward, walk somewhere, type a command. This runs that
 * script against the real rules and says whether it wins. It is what lets the
 * tests prove, for every level, that it can be finished — which a puzzle game
 * cannot afford to get wrong and cannot find out by looking.
 *
 * Pure. Positions are grid cells; the screen is the smallest one supported.
 */

import {
  CELL_H,
  CELL_W,
  DIRS,
  TASKBAR_H,
  applyEvents,
  newWorld,
  placementAt,
  step,
  tileAt,
  topAt,
  type Dir,
  type Placement,
  type Player,
  type View,
  type Viewport,
  type World,
} from "./engine"
import {
  MIN_CROP,
  fullView,
  playCols,
  revealed,
  roomsOf,
  startingAt,
  type Level,
  type Move,
  type RoomDef,
} from "./levels"

export interface SimRoom {
  /** Screen cell of the room's top-left tile, whether or not it shows. */
  col: number
  row: number
  /** The part of the room its window shows. */
  view: View
  z: number
  /** Minimized, or blinked out. */
  hidden: boolean
}

export interface SimState {
  rooms: Record<string, SimRoom>
  world: World
  player: Player
  /** Highest stacking order handed out so far. */
  top: number
  won: boolean
}

/** Always-on-top windows sit above everything else, as the window manager draws them. */
export const ON_TOP = 1_000_000

export function initialSim(level: Level): SimState {
  const rooms: Record<string, SimRoom> = {}
  level.rooms.forEach((r, i) => {
    rooms[r.id] = {
      ...startingAt(r),
      view: fullView(r),
      z: (r.onTop ? ON_TOP : 0) + i + 1,
      hidden: false,
    }
  })
  const frags = roomsOf(level)
  const start = level.rooms.find((r) => frags[r.id].start)
  if (!start) throw new Error(`level ${level.id} has no start`)
  return {
    rooms,
    world: newWorld(),
    player: { frag: start.id, ...frags[start.id].start! },
    top: level.rooms.length,
    won: false,
  }
}

/** Every visible room window, as the rules see it. */
export function placementsOf(level: Level, s: SimState): Placement[] {
  const frags = roomsOf(level)
  return level.rooms
    .filter((r) => !s.rooms[r.id].hidden && !s.world.killed.includes(r.id))
    .map((r) => {
      const room = s.rooms[r.id]
      return placementAt(
        `defrag:${r.id}`,
        frags[r.id],
        room.col + room.view.ox,
        room.row + room.view.oy,
        room.z,
        room.view
      )
    })
}

/** Whether a room's window can be dragged right now. */
export const draggable = (r: RoomDef, world: World): boolean =>
  !r.hostile &&
  !r.pinned &&
  (!r.locked || world.unlocked.includes(r.id)) &&
  !world.killed.includes(r.id)

/** Whether a room's window can be resized — so its room cropped — right now. */
export const croppable = (r: RoomDef, world: World): boolean =>
  Boolean(r.crop) &&
  !r.hostile &&
  (!r.locked || world.unlocked.includes(r.id)) &&
  !world.killed.includes(r.id)

/**
 * The shortest walk to a tile under the current layout and world, or null.
 *
 * Plans against the world as it stands and goes round anything that would
 * change it — keys, doors, switches — unless that is where it is going, so a
 * script says in so many words what it means to pick up or throw.
 */
export function route(
  level: Level,
  s: SimState,
  target: { room: string; x: number; y: number } | "exit",
  view: Viewport
): Dir[] | null {
  const frags = roomsOf(level)
  const placements = placementsOf(level, s)
  const key = (p: Player) => `${p.frag}:${p.x},${p.y}`
  const isTarget = (p: Player) =>
    target === "exit"
      ? frags[p.frag].exit?.x === p.x && frags[p.frag].exit?.y === p.y
      : p.frag === target.room && p.x === target.x && p.y === target.y

  if (isTarget(s.player)) return []
  const prev = new Map<string, { from: string; dir: Dir }>()
  const seen = new Set([key(s.player)])
  const queue: Player[] = [s.player]
  while (queue.length) {
    const here = queue.shift()!
    for (const dir of DIRS) {
      const r = step(here, dir, placements, frags, view, s.world)
      if (!r.moved) continue
      const k = key(r.player)
      if (seen.has(k)) continue
      if (!isTarget(r.player) && r.events.some((e) => e.kind !== "note")) continue
      seen.add(k)
      prev.set(k, { from: key(here), dir })
      if (isTarget(r.player)) {
        const dirs: Dir[] = []
        let at = k
        while (prev.has(at)) {
          const p = prev.get(at)!
          dirs.unshift(p.dir)
          at = p.from
        }
        return dirs
      }
      queue.push(r.player)
    }
  }
  return null
}

/** Walks a route one real step at a time, applying what each step triggers. */
function walk(level: Level, s: SimState, dirs: Dir[], view: Viewport): SimState {
  const frags = roomsOf(level)
  let state = s
  for (const dir of dirs) {
    const r = step(state.player, dir, placementsOf(level, state), frags, view, state.world)
    if (!r.moved) {
      const p = state.player
      throw new Error(`walk refused (${r.blocked}) at ${p.frag}:${p.x},${p.y}`)
    }
    state = {
      ...state,
      player: r.player,
      world: applyEvents(state.world, r.events, level.triggers),
      won: state.won || r.won,
    }
  }
  return state
}

function raise(s: SimState, id: string, level: Level): SimState {
  const def = roomDef(level, id)
  const top = s.top + 1
  return {
    ...s,
    top,
    rooms: { ...s.rooms, [id]: { ...s.rooms[id], z: (def.onTop ? ON_TOP : 0) + top } },
  }
}

function roomDef(level: Level, id: string): RoomDef {
  const def = level.rooms.find((r) => r.id === id)
  if (!def) throw new Error(`no room ${id}`)
  return def
}

/** Applies one scripted move. Throws with a reason if the move is not allowed. */
export function apply(level: Level, s: SimState, move: Move, view: Viewport): SimState {
  if ("place" in move) {
    const def = roomDef(level, move.place)
    if (!draggable(def, s.world)) throw new Error(`${def.id} will not move`)
    const next = { ...s.rooms[def.id], col: move.col, row: move.row }
    // Dragging a window brings it forward, as it does on screen.
    return raise({ ...s, rooms: { ...s.rooms, [def.id]: next } }, def.id, level)
  }
  if ("crop" in move) {
    const def = roomDef(level, move.crop)
    if (!croppable(def, s.world)) throw new Error(`${def.id} will not resize`)
    const v = move.view
    const f = roomsOf(level)[def.id]
    if (v.ox < 0 || v.oy < 0 || v.ox + v.cols > f.cols || v.oy + v.rows > f.rows) {
      throw new Error(`${def.id}: crop past the room`)
    }
    if (v.cols < MIN_CROP.cols || v.rows < MIN_CROP.rows) {
      throw new Error(`${def.id}: crop too small`)
    }
    const p = s.player
    const cutOut = p.x < v.ox || p.y < v.oy || p.x >= v.ox + v.cols || p.y >= v.oy + v.rows
    if (p.frag === def.id && cutOut) throw new Error(`${def.id}: crop would cut the player out`)
    const next = { ...s.rooms[def.id], view: v }
    return raise({ ...s, rooms: { ...s.rooms, [def.id]: next } }, def.id, level)
  }
  if ("raise" in move) {
    const def = roomDef(level, move.raise)
    if (s.rooms[def.id].hidden || s.world.killed.includes(def.id)) {
      throw new Error(`${def.id} is not on screen`)
    }
    return raise(s, def.id, level)
  }
  if ("walk" in move) {
    const dirs = route(level, s, move.walk, view)
    if (!dirs) throw new Error(`cannot walk to ${move.walk.room}:${move.walk.x},${move.walk.y}`)
    return walk(level, s, dirs, view)
  }
  if ("kill" in move) {
    const def = level.rooms.find((r) => r.pid === move.kill)
    if (!def) throw new Error(`no process ${move.kill}`)
    if (!revealed(level, s.world).includes(move.kill)) {
      throw new Error(`pid ${move.kill} not found yet`)
    }
    if (s.player.frag === def.id) throw new Error(`killing ${def.id} with the player in it`)
    return { ...s, world: { ...s.world, killed: [...s.world.killed, def.id] } }
  }
  if ("hostile" in move) {
    const def = roomDef(level, move.hostile)
    const h = def.hostile
    if (!h) throw new Error(`${def.id} is not hostile`)
    if (s.world.killed.includes(def.id)) throw new Error(`${def.id} has been killed`)
    const room = s.rooms[def.id]
    if (h.kind === "popup") return raise(s, def.id, level)
    if (h.kind === "blink") {
      if (move.state === "down") {
        if (s.player.frag === def.id) throw new Error(`${def.id} holds while the player is in it`)
        return { ...s, rooms: { ...s.rooms, [def.id]: { ...room, hidden: true } } }
      }
      const shown = { ...s, rooms: { ...s.rooms, [def.id]: { ...room, hidden: false } } }
      return raise(shown, def.id, level)
    }
    const spot = h.spots[typeof move.state === "number" ? move.state : 0]
    if (!spot) throw new Error(`${def.id} has no spot ${move.state}`)
    const next = { ...room, col: spot.col, row: spot.row }
    return raise({ ...s, rooms: { ...s.rooms, [def.id]: next } }, def.id, level)
  }
  throw new Error("unknown move")
}

export type Outcome =
  | { ok: true; states: SimState[] }
  | { ok: false; at: number; reason: string; states: SimState[] }

/** Runs a level's whole solution, then walks to the exit. Keeps every state it passed through. */
export function playSolution(level: Level, view: Viewport): Outcome {
  let s = initialSim(level)
  const states = [s]
  for (let i = 0; i < level.solution.length; i++) {
    try {
      s = apply(level, s, level.solution[i], view)
      states.push(s)
    } catch (e) {
      return { ok: false, at: i, reason: (e as Error).message, states }
    }
  }
  const dirs = route(level, s, "exit", view)
  if (!dirs) {
    return { ok: false, at: level.solution.length, reason: "cannot reach the exit", states }
  }
  try {
    s = walk(level, s, dirs, view)
    states.push(s)
  } catch (e) {
    return { ok: false, at: level.solution.length, reason: (e as Error).message, states }
  }
  if (!s.won) return { ok: false, at: -1, reason: "walked but did not win", states }
  return { ok: true, states }
}

/**
 * Whether the exit can be reached from here without touching a window.
 *
 * Searches everything the player could do on foot — picking up keys, opening
 * doors and throwing switches, in any order — so "no" is a real answer rather
 * than one route that failed.
 */
export function solvableOnFoot(
  level: Level,
  s: SimState,
  view: Viewport,
  limit = 100_000
): boolean {
  const frags = roomsOf(level)
  const placements = placementsOf(level, s)
  const key = (p: Player, w: World) =>
    `${p.frag}:${p.x},${p.y}|${w.keys}|${w.gates ? 1 : 0}|${w.used.join(";")}`
  const seen = new Set([key(s.player, s.world)])
  const queue: [Player, World][] = [[s.player, s.world]]
  while (queue.length && seen.size < limit) {
    const [p, w] = queue.shift()!
    for (const dir of DIRS) {
      const r = step(p, dir, placements, frags, view, w)
      if (!r.moved) continue
      if (r.won) return true
      const nw = applyEvents(w, r.events, level.triggers)
      const k = key(r.player, nw)
      if (seen.has(k)) continue
      seen.add(k)
      queue.push([r.player, nw])
    }
  }
  return false
}

/** Every tile the player can reach on foot from here, as "room:x,y". */
export function reachable(level: Level, s: SimState, view: Viewport): Set<string> {
  const frags = roomsOf(level)
  const placements = placementsOf(level, s)
  const key = (p: Player) => `${p.frag}:${p.x},${p.y}`
  const seen = new Set([key(s.player)])
  const queue: Player[] = [s.player]
  while (queue.length) {
    const p = queue.shift()!
    for (const dir of DIRS) {
      const r = step(p, dir, placements, frags, view, s.world)
      if (!r.moved || seen.has(key(r.player))) continue
      seen.add(key(r.player))
      queue.push(r.player)
    }
  }
  return seen
}

/**
 * The screen as text, one character per cell: a room's tiles where it shows,
 * its id where its chrome is, `*` for the player. For reading a failing test.
 */
export function renderScreen(level: Level, s: SimState, view: Viewport): string {
  const frags = roomsOf(level)
  const placements = placementsOf(level, s)
  const cols = Math.floor(view.w / CELL_W)
  const rows = Math.floor((view.h - TASKBAR_H) / CELL_H)
  const lines: string[] = []
  for (let r = 0; r < rows; r++) {
    let line = ""
    for (let c = 0; c < cols; c++) {
      const px = c * CELL_W + CELL_W / 2
      const py = r * CELL_H + CELL_H / 2
      const top = topAt(placements, px, py)
      if (!top?.frag) {
        line += " "
        continue
      }
      const b = top.body
      if (px < b.x || py < b.y || px >= b.x + b.w || py >= b.y + b.h) {
        line += top.frag
        continue
      }
      const x = Math.floor((px - b.x) / CELL_W) + (top.ox ?? 0)
      const y = Math.floor((py - b.y) / CELL_H) + (top.oy ?? 0)
      const here = s.player.frag === top.frag && s.player.x === x && s.player.y === y
      line += here ? "*" : tileAt(frags[top.frag], x, y, s.world)
    }
    lines.push(`${String(r).padStart(2)}|${line}`)
  }
  return lines.join("\n")
}

/**
 * Every single thing the player could do first: drag any room to any cell,
 * or bring any room forward. Crops are left out; there are too many.
 */
export function firstMoves(level: Level, s: SimState, view: Viewport): Move[] {
  const out: Move[] = []
  const cols = playCols(view)
  const rows = Math.floor((view.h - TASKBAR_H) / CELL_H)
  for (const r of level.rooms) {
    if (!s.rooms[r.id].hidden) out.push({ raise: r.id })
    if (!draggable(r, s.world)) continue
    const v = s.rooms[r.id].view
    for (let row = 2 - v.oy; row + v.oy + v.rows <= rows; row++) {
      for (let col = 1 - v.ox; col + v.ox + v.cols <= cols; col++) {
        out.push({ place: r.id, col, row })
      }
    }
  }
  return out
}
