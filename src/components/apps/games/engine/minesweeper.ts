/** Minesweeper rules. Pure — no DOM, no rendering. */

export type CellState = "hidden" | "revealed" | "flagged"

export interface Cell {
  mine: boolean
  /** Adjacent mine count; meaningless until mines are placed. */
  adj: number
  state: CellState
}

export type Status = "ready" | "playing" | "won" | "lost"

export interface Board {
  cells: Cell[]
  w: number
  h: number
  mines: number
  status: Status
  /** Mines are placed on the first reveal, so it can never be a mine. */
  placed: boolean
}

export const idx = (b: { w: number }, x: number, y: number) => y * b.w + x

export function createBoard(w = 9, h = 9, mines = 10): Board {
  return {
    w,
    h,
    mines,
    status: "ready",
    placed: false,
    cells: Array.from({ length: w * h }, () => ({
      mine: false,
      adj: 0,
      state: "hidden" as CellState,
    })),
  }
}

function neighbors(b: Board, i: number): number[] {
  const x = i % b.w
  const y = Math.floor(i / b.w)
  const out: number[] = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= b.w || ny >= b.h) continue
      out.push(idx(b, nx, ny))
    }
  }
  return out
}

/**
 * Places mines, keeping `safe` and its neighbours clear.
 *
 * Deferring placement until the first click is what guarantees the opening
 * move is never a loss, and usually opens a useful region rather than a single
 * numbered cell.
 */
function placeMines(b: Board, safe: number, rng: () => number): Board {
  const forbidden = new Set([safe, ...neighbors(b, safe)])
  const candidates: number[] = []
  for (let i = 0; i < b.cells.length; i++) {
    if (!forbidden.has(i)) candidates.push(i)
  }

  // Fisher-Yates over the candidates, then take the first `mines`.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  const cells = b.cells.map((c) => ({ ...c }))
  for (const i of candidates.slice(0, Math.min(b.mines, candidates.length))) {
    cells[i].mine = true
  }

  const next = { ...b, cells, placed: true }
  for (let i = 0; i < cells.length; i++) {
    cells[i].adj = neighbors(next, i).filter((n) => cells[n].mine).length
  }
  return next
}

function countRevealed(b: Board) {
  return b.cells.filter((c) => c.state === "revealed").length
}

function checkWin(b: Board): Board {
  if (b.status !== "playing") return b
  const safeCells = b.w * b.h - b.mines
  return countRevealed(b) === safeCells ? { ...b, status: "won" } : b
}

/**
 * Reveals a cell, flooding through zero-adjacency regions.
 *
 * Iterative rather than recursive: an opening move on a large empty board can
 * cascade through hundreds of cells, which is enough to blow the call stack in
 * a naive recursive implementation.
 */
export function reveal(board: Board, i: number, rng: () => number = Math.random): Board {
  if (board.status === "won" || board.status === "lost") return board
  if (board.cells[i].state !== "hidden") return board

  let b = board
  if (!b.placed) b = { ...placeMines(b, i, rng), status: "playing" }
  if (b.status === "ready") b = { ...b, status: "playing" }

  const cells = b.cells.map((c) => ({ ...c }))

  if (cells[i].mine) {
    // Expose every mine, the way the original does on a loss.
    for (const c of cells) if (c.mine) c.state = "revealed"
    return { ...b, cells, status: "lost" }
  }

  const stack = [i]
  const seen = new Set<number>()
  while (stack.length > 0) {
    const cur = stack.pop()!
    if (seen.has(cur)) continue
    seen.add(cur)

    const cell = cells[cur]
    if (cell.state === "flagged" || cell.state === "revealed") continue
    cell.state = "revealed"

    if (cell.adj === 0) {
      for (const n of neighbors(b, cur)) {
        if (cells[n].state === "hidden") stack.push(n)
      }
    }
  }

  return checkWin({ ...b, cells })
}

export function toggleFlag(board: Board, i: number): Board {
  if (board.status === "won" || board.status === "lost") return board
  const cell = board.cells[i]
  if (cell.state === "revealed") return board

  const cells = board.cells.map((c) => ({ ...c }))
  cells[i].state = cell.state === "flagged" ? "hidden" : "flagged"
  return { ...board, cells }
}

/**
 * Reveals a revealed number's hidden neighbours when its flag count matches.
 *
 * The standard "chord" shortcut. Wrong flags lose the game, as they should.
 */
export function chord(board: Board, i: number, rng: () => number = Math.random): Board {
  const cell = board.cells[i]
  if (cell.state !== "revealed" || cell.adj === 0) return board

  const ns = neighbors(board, i)
  const flags = ns.filter((n) => board.cells[n].state === "flagged").length
  if (flags !== cell.adj) return board

  let b = board
  for (const n of ns) {
    if (b.cells[n].state === "hidden") b = reveal(b, n, rng)
  }
  return b
}

export function flagsUsed(b: Board) {
  return b.cells.filter((c) => c.state === "flagged").length
}
