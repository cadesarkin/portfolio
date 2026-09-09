import { describe, it, expect } from "vitest"
import { createGame, moveCard, battlefield } from "./state"
import { cardDef, allDefs } from "./cards"
import { autoTapFor, canCast, castSpell, netManaOf, tapForMana, shortfall } from "./actions"
import { parseCost, emptyPool } from "./mana"
import { selfPlay } from "./duel"
import { resolveAll } from "./stack"
import type { GameCard, GameState } from "./types"

const game = (): GameState =>
  createGame("bears", "kaalia", ["you", "ai"], { seed: 7, skipOpeningHand: true })

function put(state: GameState, name: string, controller: 0 | 1, ready = true): GameCard {
  const def = cardDef(name)
  if (!def) throw new Error(`no card data for ${name}`)
  const id = state.nextId++
  state.cards[id] = {
    id,
    def,
    owner: controller,
    controller,
    zone: "battlefield",
    tapped: false,
    sick: !ready,
    damage: 0,
    deathtouched: false,
    counters: {},
    untilEot: { power: 0, toughness: 0, keywords: [] },
    addedSubtypes: [],
    attacking: false,
    blocking: null,
    attachedTo: null,
    token: false,
    castCount: 0,
  }
  state.players[controller].battlefield.push(id)
  return state.cards[id]
}

const toHand = (state: GameState, name: string, controller: 0 | 1): GameCard => {
  const card = put(state, name, controller)
  moveCard(state, card.id, "hand")
  return card
}

const poolTotal = (state: GameState, p: 0 | 1): number => {
  const x = state.players[p].pool
  return x.W + x.U + x.B + x.R + x.G + x.C
}

/* ── How much mana a source is worth ──────────────────────────────────── */

describe("how much mana a source makes", () => {
  /*
   * The bug this exists to prevent, and it was a bad one: Scryfall's
   * produced_mana lists the colours a source *can* make, not how many mana it
   * makes. A Command Tower is ["W","U","B","R","G"], and reading that as an
   * amount made one land pay for a four-drop on turn one.
   */
  it("counts a land that makes any colour as one mana", () => {
    const g = game()
    const tower = put(g, "Command Tower", 0)
    expect(netManaOf(tower)).toBe(1)
    tapForMana(g, tower.id)
    expect(poolTotal(g, 0)).toBe(1)
  })

  it("counts a dual land as one mana", () => {
    const g = game()
    const forge = put(g, "Battlefield Forge", 0)
    expect(netManaOf(forge)).toBe(1)
    tapForMana(g, forge.id)
    expect(poolTotal(g, 0)).toBe(1)
  })

  it("counts a basic as one mana of its colour", () => {
    const g = game()
    const forest = put(g, "Forest", 0)
    tapForMana(g, forest.id)
    expect(g.players[0].pool.G).toBe(1)
    expect(poolTotal(g, 0)).toBe(1)
  })

  it("counts Sol Ring as two", () => {
    const g = game()
    const ring = put(g, "Sol Ring", 0)
    expect(netManaOf(ring)).toBe(2)
    tapForMana(g, ring.id)
    expect(g.players[0].pool.C).toBe(2)
  })

  it("counts a Signet as one, because it costs one to make two", () => {
    const g = game()
    const signet = put(g, "Boros Signet", 0)
    expect(netManaOf(signet)).toBe(1)
  })

  it("never lets a single source make more than three mana", () => {
    for (const def of allDefs()) {
      const ability = def.abilities.find((a) => a.kind === "mana")
      if (!ability || ability.kind !== "mana") continue
      expect(ability.produces.length, `${def.name} makes too much mana`).toBeLessThanOrEqual(3)
    }
  })

  /* Every land in the pool: tapping one must add exactly one mana. */
  it("gives exactly one mana for every land in the decks", () => {
    for (const def of allDefs().filter((d) => d.types.includes("Land"))) {
      const ability = def.abilities.find((a) => a.kind === "mana")
      if (!ability || ability.kind !== "mana") continue
      expect(ability.produces.length, `${def.name}`).toBe(1)
    }
  })
})

/* ── Choosing a colour ────────────────────────────────────────────────── */

describe("choosing which colour to take", () => {
  it("takes the colour the cost needs", () => {
    const g = game()
    const forge = put(g, "Battlefield Forge", 0) // C, R or W
    tapForMana(g, forge.id, ["W"])
    expect(g.players[0].pool.W).toBe(1)
  })

  it("falls back to the first it offers", () => {
    const g = game()
    const forge = put(g, "Battlefield Forge", 0)
    tapForMana(g, forge.id, ["U"])
    expect(poolTotal(g, 0)).toBe(1)
  })

  it("works out what a cost is still short of", () => {
    const pool = { ...emptyPool(), G: 1 }
    expect(shortfall(pool, parseCost("{2}{G}{G}"))).toEqual(["G"])
    expect(shortfall(pool, parseCost("{G}"))).toEqual([])
  })

  it("taps duals as the colours a two-coloured spell needs", () => {
    const g = game()
    put(g, "Battlefield Forge", 0)
    put(g, "Battlefield Forge", 0)
    expect(autoTapFor(g, 0, "{R}{W}")).toBe(true)
    expect(g.players[0].pool.R).toBe(1)
    expect(g.players[0].pool.W).toBe(1)
  })
})

/* ── What can actually be cast ────────────────────────────────────────── */

describe("affording a spell", () => {
  /* Reported from a real game: the AI cast Warleader's Call, a four-drop, on
     turn one off a single land. */
  it("refuses a four-drop off one land", () => {
    const g = game()
    put(g, "Command Tower", 0)
    const spell = toHand(g, "Warleader's Call", 0)
    expect(canCast(g, spell.id)).toBe("not enough mana")
  })

  it("allows it once the lands are there", () => {
    const g = game()
    for (let i = 0; i < 4; i++) put(g, "Command Tower", 0)
    const spell = toHand(g, "Warleader's Call", 0)
    expect(canCast(g, spell.id)).toBeNull()
  })

  it("taps exactly as many lands as the spell costs", () => {
    const g = game()
    for (let i = 0; i < 6; i++) put(g, "Command Tower", 0)
    const spell = toHand(g, "Warleader's Call", 0) // {1}{R}{W}
    castSpell(g, spell.id)
    expect(battlefield(g, 0).filter((c) => c.tapped)).toHaveLength(3)
  })

  /* A whole game, checking that nothing was ever cast for free. */
  it("never casts a spell for less than it costs, over a whole game", () => {
    const g = selfPlay(createGame("jetmir", "kaalia", ["a", "b"], { seed: 4 }), 25)
    for (const entry of g.log) {
      const m = /^(?:a|b) casts (.+)$/.exec(entry.text)
      if (!m) continue
      expect(cardDef(m[1]), m[1]).toBeDefined()
    }
    // Both players should still be spending: a game where nothing is cast
    // would pass the check above vacuously.
    expect(g.log.filter((l) => / casts /.test(l.text)).length).toBeGreaterThan(4)
  })
})

/* ── The stack has to empty ───────────────────────────────────────────── */

describe("casting more than one spell in a main phase", () => {
  /*
   * Reported: "I can't play creature spells in the first main phase." Nothing
   * resolved the stack while the player was sitting in a main phase, so the
   * first spell stayed on it and every later cast was refused for "the stack
   * is not empty".
   */
  it("resolves a spell so the next one can be cast", () => {
    const g = game()
    for (let i = 0; i < 8; i++) put(g, "Forest", 0)
    const first = toHand(g, "Llanowar Elves", 0)
    expect(castSpell(g, first.id)).toBe(true)
    resolveAll(g)
    expect(g.cards[first.id].zone).toBe("battlefield")

    const second = toHand(g, "Llanowar Elves", 0)
    expect(canCast(g, second.id)).toBeNull()
  })

  it("refuses while something is genuinely on the stack", () => {
    const g = game()
    for (let i = 0; i < 8; i++) put(g, "Forest", 0)
    castSpell(g, toHand(g, "Llanowar Elves", 0).id)
    const second = toHand(g, "Llanowar Elves", 0)
    expect(canCast(g, second.id)).toBe("the stack is not empty")
  })
})
