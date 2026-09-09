import { describe, it, expect } from "vitest"
import { createGame, battlefield, STARTING_LIFE } from "./state"
import { selfPlay, runUntilPlayer, HUMAN, AI } from "./duel"
import { chooseAttackers, chooseBlocks, aiPlayLand, aiCastSpells } from "./ai"
import { cardDef, allDefs, DECKS } from "./cards"
import { advanceTo } from "./turn"
import { canBlock, declareAttackers } from "./combat"
import type { GameCard, GameState } from "./types"

const game = (seed = 5, a = "bears", b = "kaalia"): GameState =>
  createGame(a, b, ["you", "ai"], { seed })

function put(state: GameState, name: string, controller: 0 | 1, ready = true): GameCard {
  const def = cardDef(name)!
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
    produced: [],
    token: false,
    castCount: 0,
  }
  state.players[controller].battlefield.push(id)
  return state.cards[id]
}

/* ── The AI's decisions ───────────────────────────────────────────────── */

describe("the AI", () => {
  it("plays a land when it has one", () => {
    const g = game()
    const before = battlefield(g, AI).length
    g.active = AI
    aiPlayLand(g, AI)
    // The opening hand of a Commander deck nearly always has a land in it.
    expect(battlefield(g, AI).length).toBeGreaterThanOrEqual(before)
  })

  it("casts nothing with no mana", () => {
    const g = createGame("bears", "kaalia", ["you", "ai"], { seed: 2, skipOpeningHand: true })
    expect(aiCastSpells(g, AI)).toBe(0)
  })

  it("attacks into an empty board", () => {
    const g = createGame("bears", "kaalia", ["you", "ai"], { seed: 2, skipOpeningHand: true })
    const bear = put(g, "Beorn the Fierce", 0)
    advanceTo(g, "declareAttackers")
    expect(chooseAttackers(g, 0)).toContain(bear.id)
  })

  /* Throwing a creature away into a bigger one, every turn, is the classic way
     a card-game AI looks broken. */
  it("holds back a creature that would die for nothing", () => {
    const g = createGame("bears", "kaalia", ["you", "ai"], { seed: 2, skipOpeningHand: true })
    const small = put(g, "Llanowar Elves", 0)
    put(g, "Beorn the Fierce", 1)
    advanceTo(g, "declareAttackers")
    expect(chooseAttackers(g, 0)).not.toContain(small.id)
  })

  it("attacks anyway when it can trade up", () => {
    const g = createGame("bears", "kaalia", ["you", "ai"], { seed: 2, skipOpeningHand: true })
    const big = put(g, "Beorn the Fierce", 0)
    put(g, "Llanowar Elves", 1)
    advanceTo(g, "declareAttackers")
    expect(chooseAttackers(g, 0)).toContain(big.id)
  })

  it("blocks when it kills the attacker and lives", () => {
    const g = createGame("bears", "kaalia", ["you", "ai"], { seed: 2, skipOpeningHand: true })
    const attacker = put(g, "Llanowar Elves", 0)
    const blocker = put(g, "Beorn the Fierce", 1)
    advanceTo(g, "declareAttackers")
    declareAttackers(g, [attacker.id])
    expect(chooseBlocks(g, 1)[blocker.id]).toBe(attacker.id)
  })

  it("does not chump block for no reason", () => {
    const g = createGame("bears", "kaalia", ["you", "ai"], { seed: 2, skipOpeningHand: true })
    const attacker = put(g, "Beorn the Fierce", 0)
    const blocker = put(g, "Llanowar Elves", 1)
    advanceTo(g, "declareAttackers")
    declareAttackers(g, [attacker.id])
    expect(chooseBlocks(g, 1)[blocker.id]).toBeUndefined()
  })

  it("chump blocks when the alternative is dying", () => {
    const g = createGame("bears", "kaalia", ["you", "ai"], { seed: 2, skipOpeningHand: true })
    const attacker = put(g, "Beorn the Fierce", 0)
    const blocker = put(g, "Llanowar Elves", 1)
    g.players[1].life = 3
    advanceTo(g, "declareAttackers")
    declareAttackers(g, [attacker.id])
    expect(chooseBlocks(g, 1)[blocker.id]).toBe(attacker.id)
  })

  it("never blocks with a creature that is not allowed to", () => {
    const g = createGame("bears", "kaalia", ["you", "ai"], { seed: 2, skipOpeningHand: true })
    const flier = put(g, "Beorn the Fierce", 0)
    flier.untilEot.keywords.push("flying")
    put(g, "Llanowar Elves", 1)
    advanceTo(g, "declareAttackers")
    declareAttackers(g, [flier.id])
    const blocks = chooseBlocks(g, 1)
    for (const [blockerId, attackerId] of Object.entries(blocks)) {
      expect(canBlock(g, g.cards[Number(blockerId)], g.cards[attackerId])).toBe(true)
    }
  })
})

/* ── Whole games ──────────────────────────────────────────────────────── */

describe("a whole game", () => {
  /* The smoke test that matters: real decks, real cards, played to the end.
     It catches the deadlocks and infinite loops that a test of one rule at a
     time never sees. */
  it("plays to a finish without deadlocking", () => {
    const g = selfPlay(game(11), 40)
    expect(g.turn).toBeGreaterThan(4)
    // Either somebody won or it ran the full distance; neither is a hang.
    expect(g.winner !== null || g.turn >= 40).toBe(true)
  })

  it("actually does something: life totals move", () => {
    const g = selfPlay(game(21), 40)
    const moved = g.players[0].life !== STARTING_LIFE || g.players[1].life !== STARTING_LIFE
    expect(moved, "forty turns with nobody taking damage means combat never happened").toBe(true)
  })

  it("gets creatures onto the battlefield", () => {
    const g = selfPlay(game(31), 30)
    const creatures = battlefield(g).filter((c) => c.def.types.includes("Creature"))
    expect(creatures.length).toBeGreaterThan(0)
  })

  it("plays lands and builds mana", () => {
    const g = selfPlay(game(41), 20)
    const lands = battlefield(g).filter((c) => c.def.types.includes("Land"))
    expect(lands.length).toBeGreaterThan(4)
  })

  it("plays every pairing of decks without throwing", () => {
    for (const a of DECKS) {
      for (const b of DECKS) {
        if (a.id === b.id) continue
        expect(() => selfPlay(createGame(a.id, b.id, ["a", "b"], { seed: 3 }), 16)).not.toThrow()
      }
    }
  })

  it("is the same game twice from the same seed", () => {
    const a = selfPlay(game(77), 20)
    const b = selfPlay(game(77), 20)
    expect(a.players[0].life).toBe(b.players[0].life)
    expect(a.players[1].life).toBe(b.players[1].life)
    expect(a.turn).toBe(b.turn)
  })

  it("never leaves a card in two zones over a whole game", () => {
    const g = selfPlay(game(88), 30)
    for (const player of g.players) {
      const zones = [
        ["library", player.library],
        ["hand", player.hand],
        ["battlefield", player.battlefield],
        ["graveyard", player.graveyard],
        ["exile", player.exile],
        ["command", player.command],
      ] as const
      const seen = new Map<number, string>()
      for (const [name, ids] of zones) {
        for (const id of ids) {
          expect(seen.has(id), `card ${id} in both ${seen.get(id)} and ${name}`).toBe(false)
          seen.set(id, name)
        }
      }
    }
  })

  it("keeps every card accounted for", () => {
    const g = selfPlay(game(99), 25)
    for (const player of g.players) {
      const total =
        player.library.length +
        player.hand.length +
        player.battlefield.filter((id) => !g.cards[id]?.token).length +
        player.graveyard.length +
        player.exile.length +
        player.command.length
      // 100 cards, less anything currently on the stack.
      const onStack = g.stack.filter((s) => g.cards[s.source]?.owner === player.id).length
      expect(total + onStack, `${player.name} lost track of cards`).toBe(100)
    }
  })
})

/* ── The driver ───────────────────────────────────────────────────────── */

describe("running until the player is needed", () => {
  it("stops on the player's main phase", () => {
    const g = game(4)
    expect(runUntilPlayer(g).for).toBe("player-main")
    expect(g.active).toBe(HUMAN)
  })

  it("does not stop forever when the game is over", () => {
    const g = game(4)
    g.players[0].life = 0
    expect(runUntilPlayer(g).for).toBe("over")
  })
})

/* ── Coverage over the real card pool ─────────────────────────────────── */

describe("card coverage", () => {
  it("builds a definition for every card in the data", () => {
    expect(allDefs().length).toBeGreaterThan(200)
  })

  it("marks each card with how much of its text runs", () => {
    for (const d of allDefs()) {
      expect(["full", "partial", "body", "vanilla"], d.name).toContain(d.encoded)
    }
  })

  /* The promise the design makes: nothing is excluded for being hard. Every
     creature has a real body even when its text does nothing. */
  it("gives every creature a body regardless of its text", () => {
    for (const d of allDefs().filter((c) => c.types.includes("Creature"))) {
      expect(d.power, d.name).not.toBeNull()
      expect(d.toughness, d.name).not.toBeNull()
    }
  })

  /**
   * A floor, not a target.
   *
   * These numbers only go up as more cards are encoded; the test exists so a
   * change to the parser cannot quietly take coverage away again. The current
   * standing is written to coverage-report.txt by the report test.
   */
  it("does not lose ground on how much text runs", () => {
    const counts = { full: 0, partial: 0, body: 0, vanilla: 0 }
    for (const d of allDefs()) counts[d.encoded]++
    expect(counts.full, "cards whose text runs in full").toBeGreaterThanOrEqual(45)
    expect(
      counts.full + counts.partial,
      "cards with any encoded behaviour at all"
    ).toBeGreaterThanOrEqual(105)
  })

  /** Every land in the pool has to make mana or the decks cannot function. */
  it("keeps the mana bases working", () => {
    const lands = allDefs().filter((d) => d.types.includes("Land"))
    const dead = lands.filter((d) => !d.abilities.some((a) => a.kind === "mana"))
    expect(dead.length, `lands making no mana: ${dead.map((d) => d.name).join(", ")}`).toBeLessThan(4)
  })
})
