/**
 * Mana costs and pools.
 *
 * Costs are read straight from the printed string, so `{3}{G}{G}` is the source
 * of truth rather than a hand-copied number. Payment is deliberately simple: it
 * spends coloured mana on coloured pips first, then anything left on generic,
 * which is the choice a player would make without thinking.
 */

import type { ManaSymbol, Pool } from "./types"

export const emptyPool = (): Pool => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 })

export const poolTotal = (p: Pool): number =>
  p.W + p.U + p.B + p.R + p.G + p.C

/** A parsed cost: the coloured pips it needs, and how much generic. */
export interface Cost {
  generic: number
  pips: ManaSymbol[]
  /** How many {X} symbols the cost has. */
  x: number
  /** Symbols the parser did not understand, such as hybrid. */
  unusual: string[]
}

const SYMBOLS: ManaSymbol[] = ["W", "U", "B", "R", "G", "C"]

/**
 * Parses `{3}{G}{G}` into three generic and two green.
 *
 * Hybrid, Phyrexian and {X} are collected rather than dropped: a cost with
 * anything unusual in it is still payable at its known part, and the caller can
 * see that something was not understood instead of a spell going off cheap.
 */
export function parseCost(cost: string): Cost {
  const out: Cost = { generic: 0, pips: [], x: 0, unusual: [] }
  for (const m of cost.matchAll(/\{([^}]+)\}/g)) {
    const sym = m[1].toUpperCase()
    const n = Number(sym)
    if (Number.isFinite(n)) {
      out.generic += n
      continue
    }
    if (SYMBOLS.includes(sym as ManaSymbol)) {
      out.pips.push(sym as ManaSymbol)
      continue
    }
    if (sym === "X") {
      out.x += 1
      continue
    }
    // Hybrid and Phyrexian: charge the cheapest half, which is one generic.
    out.unusual.push(sym)
    out.generic += 1
  }
  return out
}

/** What the cost comes to, not counting X, which the caller chooses. */
export const costTotal = (c: Cost): number => c.generic + c.pips.length

/** Whether a cost has an X in it that the caller must choose a value for. */
export const hasX = (c: Cost): boolean => c.x > 0

/** Whether a pool could pay a cost, without changing it. */
export function canPay(pool: Pool, cost: Cost, extraGeneric = 0): boolean {
  return payFrom(pool, cost, extraGeneric) !== null
}

/**
 * Spends a cost from a pool, returning what is left, or null if it cannot.
 *
 * Coloured pips come out of their own colour first. Whatever generic remains is
 * paid from colourless, then from the colours with the most spare mana, so a
 * single green is not spent on generic while a green pip still needs paying.
 */
export function payFrom(pool: Pool, cost: Cost, extraGeneric = 0): Pool | null {
  const left: Pool = { ...pool }

  for (const pip of cost.pips) {
    if (left[pip] <= 0) return null
    left[pip] -= 1
  }

  let generic = cost.generic + extraGeneric
  if (generic > 0 && left.C > 0) {
    const spend = Math.min(left.C, generic)
    left.C -= spend
    generic -= spend
  }
  while (generic > 0) {
    // Spend from whichever colour has most to spare.
    let best: ManaSymbol | null = null
    for (const s of SYMBOLS) {
      if (left[s] > 0 && (best === null || left[s] > left[best])) best = s
    }
    if (best === null) return null
    left[best] -= 1
    generic -= 1
  }
  return left
}

export function addMana(pool: Pool, symbols: ManaSymbol[]): Pool {
  const out = { ...pool }
  for (const s of symbols) out[s] += 1
  return out
}

/** A cost rendered back to `{2}{G}` form, for the log and the UI. */
export function formatCost(c: Cost): string {
  const parts: string[] = []
  if (c.generic > 0) parts.push(`{${c.generic}}`)
  for (const p of c.pips) parts.push(`{${p}}`)
  return parts.join("") || "{0}"
}
