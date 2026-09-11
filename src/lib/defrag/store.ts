/**
 * defrag — the state every window of the game shares.
 *
 * The controller and each room are separate windows, and so separate React
 * trees with no common parent below the desktop. They meet here: a tiny store
 * the controller writes and the rooms subscribe to. Plain module state is
 * enough, since there is only ever one game on the desktop. The terminal
 * reaches the game through here too, for `ps` and `kill`.
 */

import { newWorld, type Player, type View, type World } from "./engine"
import { LEVELS, revealed } from "./levels"

export type Status = "intro" | "playing" | "won" | "done"

export interface DefragState {
  level: number
  status: Status
  player: Player | null
  world: World
  moves: number
  /** Per room, the edge tiles that currently meet another room, as "x,y". */
  links: Record<string, string[]>
  /** Per room, the part of it its window shows right now. */
  views: Record<string, View>
  /** Last refused step, for a moment of feedback where the player stands. */
  bump: { frag: string; x: number; y: number; at: number } | null
  /** A line for the player: why a step was refused, or what just happened. */
  note: string | null
}

export const initialState: DefragState = {
  level: 0,
  status: "intro",
  player: null,
  world: newWorld(),
  moves: 0,
  links: {},
  views: {},
  bump: null,
  note: null,
}

type Listener = () => void

let state = initialState
const listeners = new Set<Listener>()

export const getState = (): DefragState => state

export function setState(next: Partial<DefragState>): void {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

export function subscribe(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/* ── Processes, for the terminal ──────────────────────────────────────── */

export interface Proc {
  pid: number
  name: string
  /** Whether the player has found this pid written down anywhere. */
  known: boolean
}

/** The running level's processes, as `ps` shows them. */
export function processes(): Proc[] {
  const g = state
  if (g.status !== "playing") return []
  const level = LEVELS[g.level]
  const known = revealed(level, g.world)
  return level.rooms
    .filter((r) => r.pid && !g.world.killed.includes(r.id))
    .map((r) => ({ pid: r.pid!, name: r.title, known: known.includes(r.pid!) }))
}

/**
 * Kills a process of the running level, if the player has earned it: its pid
 * has to have been read somewhere. Guessing is not finding. The window closes
 * when the controller sees the world change.
 */
export function killProcess(pid: number): { ok: boolean; message: string } {
  const g = state
  const level = g.status === "playing" ? LEVELS[g.level] : undefined
  const room = level?.rooms.find((r) => r.pid === pid && !g.world.killed.includes(r.id))
  if (!level || !room || !revealed(level, g.world).includes(pid)) {
    return { ok: false, message: `kill: (${pid}) - no such process` }
  }
  if (g.player?.frag === room.id) {
    return { ok: false, message: `kill: (${pid}) - you are standing in it` }
  }
  setState({
    world: { ...g.world, killed: [...g.world.killed, room.id] },
    note: `${room.title} was killed.`,
  })
  return { ok: true, message: `[${pid}]  killed  ${room.title}` }
}

/* ── Progress ─────────────────────────────────────────────────────────── */

const PROGRESS_KEY = "sarkin.defrag"

/** The furthest level reached, so a returning player picks up where they were. */
export function loadReached(): number {
  try {
    const n = Number(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}").reached)
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), LEVELS.length) : 0
  } catch {
    return 0
  }
}

export function saveReached(level: number): void {
  try {
    const best = Math.max(level, loadReached())
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ reached: best }))
  } catch {
    // Storage unavailable: progress lasts for the session only.
  }
}
