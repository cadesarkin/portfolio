import { describe, it, expect } from "vitest"
import {
  createGame,
  draw,
  move,
  canMove,
  canStackTableau,
  canStackFoundation,
  cardsAt,
  autoTarget,
  autoplay,
  SUITS,
  type Card,
  type Game,
  type Suit,
} from "./solitaire"

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const card = (suit: Suit, rank: number, faceUp = true): Card => ({
  suit,
  rank,
  faceUp,
})

/** A game with empty piles, so tests can place exactly what they need. */
function bare(): Game {
  return {
    stock: [],
    waste: [],
    foundations: { S: [], H: [], D: [], C: [] },
    tableau: [[], [], [], [], [], [], []],
    moves: 0,
    won: false,
  }
}

describe("deal", () => {
  it("deals 1..7 cards across seven piles", () => {
    const g = createGame(seeded(1))
    expect(g.tableau.map((p) => p.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("leaves 24 cards in the stock", () => {
    expect(createGame(seeded(1)).stock).toHaveLength(24)
  })

  it("turns exactly the last card of each pile face up", () => {
    const g = createGame(seeded(3))
    for (const pile of g.tableau) {
      expect(pile[pile.length - 1].faceUp).toBe(true)
      expect(pile.slice(0, -1).every((c) => !c.faceUp)).toBe(true)
    }
  })

  it("deals a full 52-card deck with no duplicates", () => {
    const g = createGame(seeded(5))
    const all = [...g.stock, ...g.tableau.flat()]
    expect(all).toHaveLength(52)
    expect(new Set(all.map((c) => `${c.suit}${c.rank}`)).size).toBe(52)
  })
})

describe("draw", () => {
  it("moves a card from stock to waste, face up", () => {
    const g = draw(createGame(seeded(1)))
    expect(g.stock).toHaveLength(23)
    expect(g.waste).toHaveLength(1)
    expect(g.waste[0].faceUp).toBe(true)
  })

  it("recycles the waste when the stock runs out", () => {
    let g = createGame(seeded(1))
    for (let i = 0; i < 24; i++) g = draw(g)
    expect(g.stock).toHaveLength(0)
    expect(g.waste).toHaveLength(24)
    g = draw(g)
    expect(g.stock).toHaveLength(24)
    expect(g.waste).toHaveLength(0)
    expect(g.stock.every((c) => !c.faceUp)).toBe(true)
  })

  it("does nothing when both stock and waste are empty", () => {
    const g = bare()
    expect(draw(g)).toBe(g)
  })
})

describe("stacking rules", () => {
  it("tableau builds down in alternating colours", () => {
    expect(canStackTableau(card("H", 5), card("S", 6))).toBe(true)
    expect(canStackTableau(card("D", 5), card("C", 6))).toBe(true)
  })

  it("rejects same colour on the tableau", () => {
    expect(canStackTableau(card("H", 5), card("D", 6))).toBe(false)
    expect(canStackTableau(card("S", 5), card("C", 6))).toBe(false)
  })

  it("rejects a non-descending rank", () => {
    expect(canStackTableau(card("H", 5), card("S", 7))).toBe(false)
    expect(canStackTableau(card("H", 7), card("S", 6))).toBe(false)
  })

  it("only a king starts an empty tableau pile", () => {
    expect(canStackTableau(card("H", 13), undefined)).toBe(true)
    expect(canStackTableau(card("H", 12), undefined)).toBe(false)
  })

  it("will not stack onto a face-down card", () => {
    expect(canStackTableau(card("H", 5), card("S", 6, false))).toBe(false)
  })

  it("foundations start with an ace and build up by suit", () => {
    expect(canStackFoundation(card("S", 1), [])).toBe(true)
    expect(canStackFoundation(card("S", 2), [])).toBe(false)
    expect(canStackFoundation(card("S", 2), [card("S", 1)])).toBe(true)
    expect(canStackFoundation(card("H", 2), [card("S", 1)])).toBe(false)
    expect(canStackFoundation(card("S", 3), [card("S", 1)])).toBe(false)
  })
})

describe("moving", () => {
  it("moves a run of face-up cards together", () => {
    const g = bare()
    g.tableau[0] = [card("S", 8, false), card("S", 7), card("H", 6)]
    g.tableau[1] = [card("H", 8)]
    const next = move(g, { from: "tableau", pile: 0, index: 1 }, { to: "tableau", pile: 1 })
    expect(next.tableau[1].map((c) => c.rank)).toEqual([8, 7, 6])
    expect(next.tableau[0]).toHaveLength(1)
  })

  it("flips the card exposed by moving a run", () => {
    const g = bare()
    g.tableau[0] = [card("S", 8, false), card("S", 7)]
    g.tableau[1] = [card("H", 8)]
    const next = move(g, { from: "tableau", pile: 0, index: 1 }, { to: "tableau", pile: 1 })
    expect(next.tableau[0][0].faceUp).toBe(true)
  })

  it("refuses to pick up a run containing a face-down card", () => {
    const g = bare()
    g.tableau[0] = [card("S", 7, false), card("H", 6)]
    expect(cardsAt(g, { from: "tableau", pile: 0, index: 0 })).toEqual([])
  })

  it("refuses a multi-card move to a foundation", () => {
    const g = bare()
    g.tableau[0] = [card("S", 2), card("H", 1)]
    expect(
      canMove(g, { from: "tableau", pile: 0, index: 0 }, { to: "foundation", suit: "S" })
    ).toBe(false)
  })

  it("refuses a foundation move of the wrong suit", () => {
    const g = bare()
    g.waste = [card("H", 1)]
    expect(canMove(g, { from: "waste" }, { to: "foundation", suit: "S" })).toBe(false)
  })

  it("refuses to move a pile onto itself", () => {
    const g = bare()
    g.tableau[0] = [card("S", 13)]
    expect(
      canMove(g, { from: "tableau", pile: 0, index: 0 }, { to: "tableau", pile: 0 })
    ).toBe(false)
  })

  it("leaves the game untouched on an illegal move", () => {
    const g = bare()
    g.tableau[0] = [card("H", 5)]
    g.tableau[1] = [card("D", 6)]
    expect(move(g, { from: "tableau", pile: 0, index: 0 }, { to: "tableau", pile: 1 })).toBe(g)
  })

  it("moves a card back off a foundation", () => {
    const g = bare()
    g.foundations.S = [card("S", 1), card("S", 2)]
    g.tableau[0] = [card("H", 3)]
    const next = move(g, { from: "foundation", suit: "S" }, { to: "tableau", pile: 0 })
    expect(next.foundations.S).toHaveLength(1)
    expect(next.tableau[0]).toHaveLength(2)
  })

  it("counts a move", () => {
    const g = bare()
    g.tableau[0] = [card("H", 5)]
    g.tableau[1] = [card("S", 6)]
    const next = move(g, { from: "tableau", pile: 0, index: 0 }, { to: "tableau", pile: 1 })
    expect(next.moves).toBe(g.moves + 1)
  })
})

describe("winning", () => {
  it("declares a win when all four foundations are complete", () => {
    const g = bare()
    for (const s of SUITS) {
      g.foundations[s] = Array.from({ length: 13 }, (_, i) => card(s, i + 1))
    }
    // Remove the last king so one legal move completes the game.
    g.foundations.S.pop()
    g.tableau[0] = [card("S", 13)]
    const next = move(g, { from: "tableau", pile: 0, index: 0 }, { to: "foundation", suit: "S" })
    expect(next.won).toBe(true)
  })

  it("is not won while a card is outstanding", () => {
    expect(createGame(seeded(1)).won).toBe(false)
  })
})

describe("autoTarget", () => {
  it("prefers a foundation when one accepts the card", () => {
    const g = bare()
    g.waste = [card("S", 1)]
    expect(autoTarget(g, { from: "waste" })).toEqual({ to: "foundation", suit: "S" })
  })

  it("falls back to a legal tableau pile", () => {
    const g = bare()
    g.waste = [card("H", 5)]
    g.tableau[2] = [card("S", 6)]
    expect(autoTarget(g, { from: "waste" })).toEqual({ to: "tableau", pile: 2 })
  })

  it("returns null when nothing accepts the card", () => {
    const g = bare()
    g.waste = [card("H", 5)]
    g.tableau[0] = [card("D", 6)]
    expect(autoTarget(g, { from: "waste" })).toBeNull()
  })
})

describe("autoplay", () => {
  it("sends everything it can to the foundations", () => {
    const g = bare()
    g.tableau[0] = [card("S", 1)]
    g.tableau[1] = [card("S", 2)]
    g.tableau[2] = [card("H", 1)]
    const next = autoplay(g)
    expect(next.foundations.S.map((c) => c.rank)).toEqual([1, 2])
    expect(next.foundations.H.map((c) => c.rank)).toEqual([1])
  })

  it("terminates when no card can be played", () => {
    const g = bare()
    g.tableau[0] = [card("S", 5)]
    expect(autoplay(g).foundations.S).toHaveLength(0)
  })
})
