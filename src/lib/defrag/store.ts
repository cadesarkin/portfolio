/**
 * defrag — the state every window of the game shares.
 *
 * The controller and each room are separate windows, and so separate React
 * trees with no common parent below the desktop. They meet here: a tiny store
 * the controller writes and the rooms subscribe to. Plain module state is
 * enough, since there is only ever one game on the desktop.
 */

import type { Player } from "./engine"

export type Status = "intro" | "playing" | "won" | "done"

export interface DefragState {
  level: number
  status: Status
  player: Player | null
  moves: number
  /** Per room, the ports that currently meet another room, as "x,y". */
  links: Record<string, string[]>
  /** Last refused step, for a moment of feedback where the player stands. */
  bump: { frag: string; x: number; y: number; at: number } | null
  /** Why the last step was refused, in words, or null after a good step. */
  note: string | null
}

export const initialState: DefragState = {
  level: 0,
  status: "intro",
  player: null,
  moves: 0,
  links: {},
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

/* ── Progress ─────────────────────────────────────────────────────────── */

const PROGRESS_KEY = "sarkin.defrag"

/** The furthest level reached, so a returning player picks up where they were. */
export function loadReached(): number {
  try {
    const n = Number(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}").reached)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
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
