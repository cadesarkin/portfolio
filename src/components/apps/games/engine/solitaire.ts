/** Klondike solitaire rules. Pure — no DOM, no rendering. */

export type Suit = "S" | "H" | "D" | "C"
export const SUITS: Suit[] = ["S", "H", "D", "C"]
export const RANKS = "A23456789TJQK"

export interface Card {
  suit: Suit
  /** 1 = ace, 13 = king. */
  rank: number
  faceUp: boolean
}

export interface Game {
  /** Face-down draw pile. */
  stock: Card[]
  /** Face-up discard; only the last card is playable. */
  waste: Card[]
  /** Four ascending suit piles. */
  foundations: Record<Suit, Card[]>
  /** Seven piles; only the trailing face-up run is movable. */
  tableau: Card[][]
  moves: number
  won: boolean
}

export const isRed = (s: Suit) => s === "H" || s === "D"

/** Where a drag started. */
export type Source =
  | { from: "waste" }
  | { from: "tableau"; pile: number; index: number }
  | { from: "foundation"; suit: Suit }

export type Target =
  | { to: "tableau"; pile: number }
  | { to: "foundation"; suit: Suit }

function deck(rng: () => number): Card[] {
  const cards: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      cards.push({ suit, rank, faceUp: false })
    }
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

export function createGame(rng: () => number = Math.random): Game {
  const cards = deck(rng)
  const tableau: Card[][] = []
  for (let pile = 0; pile < 7; pile++) {
    const run = cards.splice(0, pile + 1)
    run[run.length - 1].faceUp = true
    tableau.push(run)
  }
  return {
    stock: cards,
    waste: [],
    foundations: { S: [], H: [], D: [], C: [] },
    tableau,
    moves: 0,
    won: false,
  }
}

function clone(g: Game): Game {
  return {
    stock: g.stock.map((c) => ({ ...c })),
    waste: g.waste.map((c) => ({ ...c })),
    foundations: {
      S: g.foundations.S.map((c) => ({ ...c })),
      H: g.foundations.H.map((c) => ({ ...c })),
      D: g.foundations.D.map((c) => ({ ...c })),
      C: g.foundations.C.map((c) => ({ ...c })),
    },
    tableau: g.tableau.map((p) => p.map((c) => ({ ...c }))),
    moves: g.moves,
    won: g.won,
  }
}

/** Turns the top stock card face up; recycles the waste when the stock is out. */
export function draw(g: Game): Game {
  const next = clone(g)
  if (next.stock.length === 0) {
    if (next.waste.length === 0) return g
    next.stock = next.waste.reverse().map((c) => ({ ...c, faceUp: false }))
    next.waste = []
  } else {
    const card = next.stock.pop()!
    next.waste.push({ ...card, faceUp: true })
  }
  next.moves += 1
  return next
}

/** Tableau builds down in alternating colours; only a king starts an empty pile. */
export function canStackTableau(card: Card, onto: Card | undefined): boolean {
  if (!onto) return card.rank === 13
  if (!onto.faceUp) return false
  return isRed(card.suit) !== isRed(onto.suit) && card.rank === onto.rank - 1
}

/** Foundations build up by suit from the ace. */
export function canStackFoundation(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return card.rank === 1
  const top = pile[pile.length - 1]
  return top.suit === card.suit && card.rank === top.rank + 1
}

/** The cards a source picks up: a single card, or a face-up tableau run. */
export function cardsAt(g: Game, src: Source): Card[] {
  if (src.from === "waste") {
    const top = g.waste[g.waste.length - 1]
    return top ? [top] : []
  }
  if (src.from === "foundation") {
    const top = g.foundations[src.suit][g.foundations[src.suit].length - 1]
    return top ? [top] : []
  }
  const pile = g.tableau[src.pile]
  if (!pile) return []
  const run = pile.slice(src.index)
  // A run is only movable if every card in it is already face up.
  return run.every((c) => c.faceUp) ? run : []
}

function removeFrom(g: Game, src: Source, count: number) {
  if (src.from === "waste") {
    g.waste.splice(g.waste.length - count, count)
  } else if (src.from === "foundation") {
    g.foundations[src.suit].splice(g.foundations[src.suit].length - count, count)
  } else {
    const pile = g.tableau[src.pile]
    pile.splice(pile.length - count, count)
    // Expose whatever the moved run was covering.
    const last = pile[pile.length - 1]
    if (last && !last.faceUp) last.faceUp = true
  }
}

export function canMove(g: Game, src: Source, dst: Target): boolean {
  const moving = cardsAt(g, src)
  if (moving.length === 0) return false

  if (dst.to === "foundation") {
    // Foundations take one card at a time, and it must match the pile's suit.
    if (moving.length !== 1) return false
    if (moving[0].suit !== dst.suit) return false
    return canStackFoundation(moving[0], g.foundations[dst.suit])
  }

  const pile = g.tableau[dst.pile]
  if (!pile) return false
  // Moving a run onto its own pile is a no-op, not a move.
  if (src.from === "tableau" && src.pile === dst.pile) return false
  return canStackTableau(moving[0], pile[pile.length - 1])
}

export function move(g: Game, src: Source, dst: Target): Game {
  if (!canMove(g, src, dst)) return g
  const next = clone(g)
  const moving = cardsAt(g, src).map((c) => ({ ...c }))
  removeFrom(next, src, moving.length)

  if (dst.to === "foundation") next.foundations[dst.suit].push(...moving)
  else next.tableau[dst.pile].push(...moving)

  next.moves += 1
  next.won = SUITS.every((s) => next.foundations[s].length === 13)
  return next
}

/**
 * The best target for a double-click: a foundation if one accepts it, else the
 * first tableau pile that does.
 */
export function autoTarget(g: Game, src: Source): Target | null {
  const moving = cardsAt(g, src)
  if (moving.length === 0) return null

  if (moving.length === 1) {
    const suit = moving[0].suit
    if (canMove(g, src, { to: "foundation", suit })) {
      return { to: "foundation", suit }
    }
  }
  for (let pile = 0; pile < g.tableau.length; pile++) {
    if (canMove(g, src, { to: "tableau", pile })) return { to: "tableau", pile }
  }
  return null
}

/** Sends every card it can to the foundations. Used by the "autoplay" button. */
export function autoplay(g: Game): Game {
  let next = g
  let moved = true
  while (moved) {
    moved = false
    const sources: Source[] = [
      { from: "waste" },
      ...next.tableau.map(
        (p, pile): Source => ({ from: "tableau", pile, index: p.length - 1 })
      ),
    ]
    for (const src of sources) {
      const cards = cardsAt(next, src)
      if (cards.length !== 1) continue
      const target: Target = { to: "foundation", suit: cards[0].suit }
      if (canMove(next, src, target)) {
        next = move(next, src, target)
        moved = true
      }
    }
  }
  return next
}
