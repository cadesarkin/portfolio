/**
 * Leaderboard definitions and validation. Pure — no Redis, no DOM.
 *
 * Scores are submitted by the browser and are therefore forgeable. That is a
 * deliberate, accepted trade for a portfolio: the caps below exist to stop a
 * bogus value from breaking the display, not to stop cheating.
 */

export type Direction = "high" | "low"

export interface Board {
  id: string
  label: string
  /** Which end of the sorted set wins. */
  direction: Direction
  /** Rendered after the value, e.g. "m" or "s". */
  unit: string
  /** Values beyond this are rejected as implausible. */
  max: number
}

export const BOARDS: Board[] = [
  {
    id: "cube-runner",
    label: "cube runner",
    direction: "high",
    unit: "m",
    max: 1_000_000,
  },
  { id: "snake", label: "snake", direction: "high", unit: "pts", max: 10_000 },
  {
    id: "minesweeper-beginner",
    label: "minesweeper · beginner",
    direction: "low",
    unit: "s",
    max: 999,
  },
  {
    id: "minesweeper-intermediate",
    label: "minesweeper · intermediate",
    direction: "low",
    unit: "s",
    max: 999,
  },
  {
    id: "minesweeper-expert",
    label: "minesweeper · expert",
    direction: "low",
    unit: "s",
    max: 999,
  },
  {
    id: "solitaire",
    label: "solitaire · fewest moves",
    direction: "low",
    unit: "mv",
    max: 10_000,
  },
]

export const TOP_N = 10

export const boardById = (id: string): Board | undefined =>
  BOARDS.find((b) => b.id === id)

/**
 * Three-letter initials, arcade style.
 *
 * The format is the moderation strategy. A-Z only and exactly three characters
 * means the space of possible entries is finite and enumerable, so the
 * offensive subset can actually be listed — unlike free text, where unicode
 * homoglyphs, leetspeak and spacing tricks make a filter unwinnable.
 */
const BLOCKED = new Set([
  "ASS", "FUK", "FUC", "FCK", "FUX", "SHT", "SHI", "CUM", "CUN", "CNT",
  "TIT", "TIS", "SEX", "SXX", "PIS", "PSS", "DIK", "DIC", "DCK", "COK",
  "COC", "PEN", "VAG", "JIZ", "FAG", "FGT", "FAG", "NIG", "NGR", "NGA",
  "NIQ", "KKK", "SPC", "WOP", "JAP", "GOK", "CHK", "KYK", "RAP", "RPE",
  "HOE", "SLT", "WHR", "BCH", "BTC", "PRN", "PRO", "XXX", "GAY", "HTL",
  "HIT", "NZI", "NAZ", "SS8", "H8R", "KYS", "DIE", "SUX", "ANL", "BUT",
  "BUM", "FAP", "MLF", "STD", "HIV", "PDF", "PED", "CP1", "CP2", "ISS",
])

export interface InitialsResult {
  ok: boolean
  value?: string
  error?: string
}

export function validateInitials(raw: string): InitialsResult {
  const value = (raw ?? "").trim().toUpperCase()
  if (value.length === 0) return { ok: false, error: "enter three letters" }
  if (!/^[A-Z]{3}$/.test(value)) {
    return { ok: false, error: "three letters, A-Z only" }
  }
  if (BLOCKED.has(value)) return { ok: false, error: "pick something else" }
  return { ok: true, value }
}

export interface ScoreResult {
  ok: boolean
  value?: number
  error?: string
}

/** Rejects anything that would render as nonsense or break the ordering. */
export function validateScore(board: Board, raw: unknown): ScoreResult {
  // The type is checked before coercing, because Number() maps null, "", []
  // and false all to 0 — every one of which would otherwise be accepted as a
  // legitimate score of zero.
  const isNumeric =
    typeof raw === "number" ||
    (typeof raw === "string" && raw.trim().length > 0)
  if (!isNumeric) return { ok: false, error: "score must be a number" }

  const n = Number(raw)
  if (!Number.isFinite(n)) return { ok: false, error: "score must be a number" }
  if (n < 0) return { ok: false, error: "score must not be negative" }
  if (n > board.max) return { ok: false, error: "score is out of range" }
  // Whole numbers only: every board counts metres, points, seconds or moves.
  return { ok: true, value: Math.round(n) }
}

export interface Entry {
  initials: string
  score: number
  at: number
}

/** Formats a score for display, e.g. "1,420 m" or "38 s". */
export function formatScore(board: Board, score: number): string {
  return `${score.toLocaleString("en-US")} ${board.unit}`
}

/**
 * Whether a score earns a place, given the board's current entries.
 *
 * Used by the games to decide whether to ask for initials at all — nobody
 * wants a name prompt for a run that will not appear.
 */
export function qualifies(
  board: Board,
  score: number,
  entries: Entry[]
): boolean {
  if (entries.length < TOP_N) return true
  const worst = entries[entries.length - 1]
  if (!worst) return true
  return board.direction === "high"
    ? score > worst.score
    : score < worst.score
}

/** Sorts entries into display order for a board. */
export function rank(board: Board, entries: Entry[]): Entry[] {
  const sorted = [...entries].sort((a, b) =>
    board.direction === "high" ? b.score - a.score : a.score - b.score
  )
  return sorted.slice(0, TOP_N)
}
