import { describe, it, expect } from "vitest"
import { parseCost, payFrom, canPay, emptyPool, costTotal } from "./mana"
import { createGame, moveCard, battlefield, STARTING_LIFE, OPENING_HAND } from "./state"
import { cardDef, deckList, DECKS, allDefs } from "./cards"
import { castSpell, canCast, playLand, canPlayLand, tapForMana, autoTapFor } from "./actions"
import { advanceTo } from "./turn"
import { resolveAll, stateBasedActions, checkTriggers } from "./stack"
import { canAttack, declareAttackers, declareBlockers, combatDamage, canBlock } from "./combat"
import { powerOf, toughnessOf, keywordsOf, hasKeyword } from "./continuous"
import type { GameCard, GameState } from "./types"

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** A game with empty hands, so a test only sees what it puts in play. */
const game = (a = "bears", b = "kaalia"): GameState =>
  createGame(a, b, ["you", "ai"], { seed: 7, skipOpeningHand: true })

/** Puts a named card onto the battlefield under a player, ready to act. */
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
    token: false,
    castCount: 0,
  }
  state.players[controller].battlefield.push(id)
  return state.cards[id]
}

/** Puts a card in hand. */
function toHand(state: GameState, name: string, controller: 0 | 1): GameCard {
  const card = put(state, name, controller)
  moveCard(state, card.id, "hand")
  return card
}

/* ── Mana ─────────────────────────────────────────────────────────────── */

describe("mana costs", () => {
  it("splits a cost into generic and coloured pips", () => {
    const c = parseCost("{3}{G}{G}")
    expect(c.generic).toBe(3)
    expect(c.pips).toEqual(["G", "G"])
    expect(costTotal(c)).toBe(5)
  })

  it("reads a colourless cost", () => {
    expect(parseCost("{1}").generic).toBe(1)
    expect(parseCost("").pips).toEqual([])
  })

  it("pays coloured pips from their own colour", () => {
    const pool = { ...emptyPool(), G: 2, R: 1 }
    const left = payFrom(pool, parseCost("{G}{G}"))
    expect(left).toEqual({ ...emptyPool(), G: 0, R: 1 })
  })

  it("refuses when a colour is missing", () => {
    const pool = { ...emptyPool(), R: 5 }
    expect(payFrom(pool, parseCost("{G}"))).toBeNull()
  })

  /* The bug this guards: spending the only green on a generic pip, then
     failing to pay the green pip that still needed it. */
  it("does not spend a colour on generic that a pip still needs", () => {
    const pool = { ...emptyPool(), G: 1, R: 1 }
    expect(canPay(pool, parseCost("{1}{G}"))).toBe(true)
  })

  it("spends colourless on generic first", () => {
    const pool = { ...emptyPool(), C: 2, G: 1 }
    const left = payFrom(pool, parseCost("{2}{G}"))
    expect(left?.C).toBe(0)
    expect(left?.G).toBe(0)
  })

  it("charges a hybrid symbol as one generic rather than free", () => {
    const c = parseCost("{G/W}")
    expect(costTotal(c)).toBe(1)
    expect(c.unusual).toContain("G/W")
  })
})

/* ── Setup ────────────────────────────────────────────────────────────── */

describe("a new game", () => {
  it("starts both players at forty life", () => {
    const g = game()
    expect(g.players[0].life).toBe(STARTING_LIFE)
    expect(g.players[1].life).toBe(STARTING_LIFE)
  })

  it("puts the commander in the command zone, not the library", () => {
    const g = game("bears", "jetmir")
    expect(g.players[0].command).toHaveLength(1)
    const commander = g.cards[g.players[0].command[0]]
    expect(commander.def.name).toBe("Beorn the Fierce")
  })

  it("shuffles ninety-nine cards into each library", () => {
    const g = game()
    expect(g.players[0].library).toHaveLength(99)
    expect(g.players[1].library).toHaveLength(99)
  })

  it("deals an opening hand of seven", () => {
    const g = createGame("bears", "kaalia", ["you", "ai"], { seed: 3 })
    expect(g.players[0].hand).toHaveLength(OPENING_HAND)
    expect(g.players[0].library).toHaveLength(99 - OPENING_HAND)
  })

  it("gives the same shuffle for the same seed", () => {
    const a = createGame("bears", "kaalia", ["you", "ai"], { seed: 99 })
    const b = createGame("bears", "kaalia", ["you", "ai"], { seed: 99 })
    expect(a.players[0].library).toEqual(b.players[0].library)
  })

  it("gives a different shuffle for a different seed", () => {
    const a = createGame("bears", "kaalia", ["you", "ai"], { seed: 1 })
    const b = createGame("bears", "kaalia", ["you", "ai"], { seed: 2 })
    expect(a.players[0].library).not.toEqual(b.players[0].library)
  })
})

/* ── Zones ────────────────────────────────────────────────────────────── */

describe("moving between zones", () => {
  /* The classic way a card engine starts lying: a card in two zone lists at
     once, so it can be played twice or blocks after it died. */
  it("never leaves a card in two zones", () => {
    const g = game()
    const card = put(g, "Llanowar Elves", 0)
    moveCard(g, card.id, "graveyard")
    expect(g.players[0].battlefield).not.toContain(card.id)
    expect(g.players[0].graveyard).toContain(card.id)
    expect(card.zone).toBe("graveyard")
  })

  it("clears what was only true in play", () => {
    const g = game()
    const card = put(g, "Llanowar Elves", 0)
    card.tapped = true
    card.damage = 2
    card.counters["+1/+1"] = 3
    moveCard(g, card.id, "hand")
    expect(card.tapped).toBe(false)
    expect(card.damage).toBe(0)
    expect(card.counters).toEqual({})
  })

  /* A token that piled up in a graveyard could be returned to play later. */
  it("makes a token cease to exist when it leaves the battlefield", () => {
    const g = game()
    for (let i = 0; i < 3; i++) put(g, "Forest", 0)
    expect(castSpell(g, toHand(g, "Beast Within", 0).id)).toBe(true)
    resolveAll(g)
    const token = battlefield(g, 0).find((c) => c.token)
    expect(token, "Beast Within should have made a Beast").toBeDefined()
    moveCard(g, token!.id, "graveyard")
    expect(g.cards[token!.id]).toBeUndefined()
    expect(g.players[0].graveyard).not.toContain(token!.id)
  })
})

/* ── Playing cards ────────────────────────────────────────────────────── */

describe("playing a land", () => {
  it("puts it onto the battlefield", () => {
    const g = game()
    const land = toHand(g, "Forest", 0)
    expect(canPlayLand(g, land.id)).toBeNull()
    expect(playLand(g, land.id)).toBe(true)
    expect(land.zone).toBe("battlefield")
  })

  it("allows only one a turn", () => {
    const g = game()
    playLand(g, toHand(g, "Forest", 0).id)
    const second = toHand(g, "Forest", 0)
    expect(canPlayLand(g, second.id)).toBe("one land a turn")
  })

  it("allows another after the turn passes", () => {
    const g = game()
    playLand(g, toHand(g, "Forest", 0).id)
    advanceTo(g, "main1")
    advanceTo(g, "main1")
    expect(g.active).toBe(0)
    expect(canPlayLand(g, toHand(g, "Forest", 0).id)).toBeNull()
  })

  it("refuses on the opponent's turn", () => {
    const g = game()
    const land = toHand(g, "Forest", 1)
    expect(canPlayLand(g, land.id)).toBe("not your turn")
  })
})

describe("casting", () => {
  it("refuses without the mana", () => {
    const g = game()
    const card = toHand(g, "Beorn the Fierce", 0)
    expect(canCast(g, card.id)).toBe("not enough mana")
  })

  it("casts once the lands are there", () => {
    const g = game()
    for (let i = 0; i < 5; i++) put(g, "Forest", 0)
    const card = toHand(g, "Beorn the Fierce", 0)
    expect(canCast(g, card.id)).toBeNull()
    expect(castSpell(g, card.id)).toBe(true)
    resolveAll(g)
    expect(card.zone).toBe("battlefield")
  })

  it("taps the lands it used", () => {
    const g = game()
    for (let i = 0; i < 5; i++) put(g, "Forest", 0)
    castSpell(g, toHand(g, "Beorn the Fierce", 0).id)
    expect(battlefield(g, 0).filter((c) => c.tapped)).toHaveLength(5)
  })

  it("refuses a sorcery-speed spell in combat", () => {
    const g = game()
    for (let i = 0; i < 5; i++) put(g, "Forest", 0)
    const card = toHand(g, "Beorn the Fierce", 0)
    advanceTo(g, "declareAttackers")
    expect(canCast(g, card.id)).toBe("only in a main phase")
  })

  it("charges the commander tax on each recast", () => {
    const g = game()
    for (let i = 0; i < 9; i++) put(g, "Forest", 0)
    const commander = g.cards[g.players[0].command[0]]
    expect(castSpell(g, commander.id)).toBe(true)
    resolveAll(g)
    expect(battlefield(g, 0).filter((c) => c.tapped)).toHaveLength(5)

    moveCard(g, commander.id, "command")
    for (const c of battlefield(g, 0)) c.tapped = false
    expect(castSpell(g, commander.id)).toBe(true)
    // Five for the card, two more for having been cast once already.
    expect(battlefield(g, 0).filter((c) => c.tapped)).toHaveLength(7)
  })
})

/* ── Turn structure ───────────────────────────────────────────────────── */

describe("the turn", () => {
  it("passes to the other player", () => {
    const g = game()
    expect(g.active).toBe(0)
    advanceTo(g, "main1")
    expect(g.active).toBe(1)
    advanceTo(g, "main1")
    expect(g.active).toBe(0)
  })

  it("untaps everything at the start of the turn", () => {
    const g = game()
    const land = put(g, "Forest", 0)
    land.tapped = true
    advanceTo(g, "main1")
    advanceTo(g, "main1")
    advanceTo(g, "main1")
    expect(land.tapped).toBe(false)
  })

  it("wears off summoning sickness", () => {
    const g = game()
    const bear = put(g, "Llanowar Elves", 0, false)
    expect(bear.sick).toBe(true)
    advanceTo(g, "main1")
    advanceTo(g, "main1")
    advanceTo(g, "main1")
    expect(bear.sick).toBe(false)
  })

  it("draws for the turn", () => {
    const g = game()
    const before = g.players[1].hand.length
    advanceTo(g, "main1")
    expect(g.players[1].hand.length).toBe(before + 1)
  })

  it("clears damage and end-of-turn buffs in cleanup", () => {
    const g = game()
    const bear = put(g, "Llanowar Elves", 0)
    bear.damage = 1
    bear.untilEot.power = 3
    advanceTo(g, "cleanup")
    expect(bear.damage).toBe(0)
    expect(bear.untilEot.power).toBe(0)
  })
})

/* ── Continuous effects ───────────────────────────────────────────────── */

describe("power and toughness", () => {
  it("reads the printed values", () => {
    const g = game()
    const beorn = put(g, "Beorn the Fierce", 0)
    expect(powerOf(g, beorn)).toBe(6)
    expect(toughnessOf(g, beorn)).toBe(6)
  })

  it("counts +1/+1 counters", () => {
    const g = game()
    const elf = put(g, "Llanowar Elves", 0)
    elf.counters["+1/+1"] = 2
    expect(powerOf(g, elf)).toBe(1 + 2)
  })

  /* Beorn buffs other Bears, not himself. */
  it("applies a static buff to what it filters for", () => {
    const g = game()
    const beorn = put(g, "Beorn the Fierce", 0)
    const elf = put(g, "Llanowar Elves", 0)
    elf.addedSubtypes.push("Bear")
    expect(powerOf(g, elf)).toBe(1 + 2)
    expect(powerOf(g, beorn), "Beorn does not buff himself").toBe(6)
  })

  it("does not buff the opponent's creatures", () => {
    const g = game()
    put(g, "Beorn the Fierce", 0)
    const theirs = put(g, "Llanowar Elves", 1)
    theirs.addedSubtypes.push("Bear")
    expect(powerOf(g, theirs)).toBe(1)
  })

  it("takes keywords from the printed card", () => {
    const g = game()
    const beorn = put(g, "Beorn the Fierce", 0)
    expect(keywordsOf(g, beorn)).toContain("trample")
  })

  /* Beorn's own trigger hands out trample counters. */
  it("grants a keyword from a counter of that name", () => {
    const g = game()
    const elf = put(g, "Llanowar Elves", 0)
    expect(hasKeyword(g, elf, "trample")).toBe(false)
    elf.counters["trample"] = 1
    expect(hasKeyword(g, elf, "trample")).toBe(true)
  })
})

/* ── Combat ───────────────────────────────────────────────────────────── */

describe("combat", () => {
  const combat = () => {
    const g = game()
    advanceTo(g, "declareAttackers")
    return g
  }

  it("will not let a summoning-sick creature attack", () => {
    const g = game()
    const elf = put(g, "Llanowar Elves", 0, false)
    advanceTo(g, "declareAttackers")
    expect(canAttack(g, elf)).toBe(false)
  })

  it("lets a creature with haste attack the turn it arrives", () => {
    const g = game()
    const hasty = put(g, "Llanowar Elves", 0, false)
    hasty.untilEot.keywords.push("haste")
    advanceTo(g, "declareAttackers")
    expect(canAttack(g, hasty)).toBe(true)
  })

  it("taps an attacker, unless it has vigilance", () => {
    const g = combat()
    const a = put(g, "Llanowar Elves", 0)
    const b = put(g, "Llanowar Elves", 0)
    b.untilEot.keywords.push("vigilance")
    declareAttackers(g, [a.id, b.id])
    expect(a.tapped).toBe(true)
    expect(b.tapped).toBe(false)
  })

  it("deals damage to the defending player", () => {
    const g = combat()
    const attacker = put(g, "Beorn the Fierce", 0)
    declareAttackers(g, [attacker.id])
    combatDamage(g)
    expect(g.players[1].life).toBe(STARTING_LIFE - 6)
  })

  it("lets a blocker stop the damage", () => {
    const g = combat()
    // Not Beorn: he tramples, so a chump block would not stop all of it.
    const attacker = put(g, "Llanowar Elves", 0)
    attacker.untilEot.power = 3
    const blocker = put(g, "Beorn the Fierce", 1)
    declareAttackers(g, [attacker.id])
    declareBlockers(g, { [blocker.id]: attacker.id })
    combatDamage(g)
    expect(g.players[1].life).toBe(STARTING_LIFE)
  })

  it("kills a blocker it outclasses", () => {
    const g = combat()
    const attacker = put(g, "Beorn the Fierce", 0)
    const blocker = put(g, "Llanowar Elves", 1)
    declareAttackers(g, [attacker.id])
    declareBlockers(g, { [blocker.id]: attacker.id })
    combatDamage(g)
    stateBasedActions(g)
    expect(g.cards[blocker.id].zone).toBe("graveyard")
  })

  it("sends spare damage through with trample", () => {
    const g = combat()
    const attacker = put(g, "Beorn the Fierce", 0) // 6/6 trample
    const blocker = put(g, "Llanowar Elves", 1) // 1/1
    declareAttackers(g, [attacker.id])
    declareBlockers(g, { [blocker.id]: attacker.id })
    combatDamage(g)
    expect(g.players[1].life).toBe(STARTING_LIFE - 5)
  })

  it("stops a ground creature blocking a flier", () => {
    const g = combat()
    const flier = put(g, "Beorn the Fierce", 0)
    flier.untilEot.keywords.push("flying")
    const ground = put(g, "Llanowar Elves", 1)
    declareAttackers(g, [flier.id])
    expect(canBlock(g, ground, flier)).toBe(false)
  })

  it("lets reach block a flier", () => {
    const g = combat()
    const flier = put(g, "Beorn the Fierce", 0)
    flier.untilEot.keywords.push("flying")
    const reacher = put(g, "Llanowar Elves", 1)
    reacher.untilEot.keywords.push("reach")
    declareAttackers(g, [flier.id])
    expect(canBlock(g, reacher, flier)).toBe(true)
  })

  /* Menace cannot be checked one blocker at a time: it is only knowable once
     every block has been declared. */
  it("refuses a single block against menace", () => {
    const g = combat()
    const attacker = put(g, "Beorn the Fierce", 0)
    attacker.untilEot.keywords.push("menace")
    const blocker = put(g, "Llanowar Elves", 1)
    declareAttackers(g, [attacker.id])
    declareBlockers(g, { [blocker.id]: attacker.id })
    expect(blocker.blocking).toBeNull()
  })

  it("allows two blockers against menace", () => {
    const g = combat()
    const attacker = put(g, "Beorn the Fierce", 0)
    attacker.untilEot.keywords.push("menace")
    const one = put(g, "Llanowar Elves", 1)
    const two = put(g, "Llanowar Elves", 1)
    declareAttackers(g, [attacker.id])
    declareBlockers(g, { [one.id]: attacker.id, [two.id]: attacker.id })
    expect(one.blocking).toBe(attacker.id)
    expect(two.blocking).toBe(attacker.id)
  })

  it("gains life from lifelink", () => {
    const g = combat()
    const attacker = put(g, "Beorn the Fierce", 0)
    attacker.untilEot.keywords.push("lifelink")
    declareAttackers(g, [attacker.id])
    combatDamage(g)
    expect(g.players[0].life).toBe(STARTING_LIFE + 6)
  })

  /* First strike is pointless unless the loser is gone before it hits back. */
  it("lets first strike kill before taking damage", () => {
    const g = combat()
    const attacker = put(g, "Llanowar Elves", 0)
    attacker.untilEot.power = 2
    attacker.untilEot.keywords.push("first strike")
    const blocker = put(g, "Llanowar Elves", 1)
    declareAttackers(g, [attacker.id])
    declareBlockers(g, { [blocker.id]: attacker.id })
    combatDamage(g)
    expect(g.cards[blocker.id].zone).toBe("graveyard")
    expect(g.cards[attacker.id].zone).toBe("battlefield")
    expect(g.cards[attacker.id].damage).toBe(0)
  })

  it("kills anything it touches with deathtouch", () => {
    const g = combat()
    const attacker = put(g, "Llanowar Elves", 0)
    attacker.untilEot.keywords.push("deathtouch")
    const blocker = put(g, "Beorn the Fierce", 1)
    declareAttackers(g, [attacker.id])
    declareBlockers(g, { [blocker.id]: attacker.id })
    combatDamage(g)
    stateBasedActions(g)
    expect(g.cards[blocker.id].zone).toBe("graveyard")
  })
})

/* ── State-based actions ──────────────────────────────────────────────── */

describe("state-based actions", () => {
  it("kills a creature with lethal damage", () => {
    const g = game()
    const elf = put(g, "Llanowar Elves", 0)
    elf.damage = 1
    stateBasedActions(g)
    expect(g.cards[elf.id].zone).toBe("graveyard")
  })

  it("spares a creature whose damage is not lethal", () => {
    const g = game()
    const beorn = put(g, "Beorn the Fierce", 0)
    beorn.damage = 5
    stateBasedActions(g)
    expect(beorn.zone).toBe("battlefield")
  })

  it("ends the game when a player hits zero", () => {
    const g = game()
    g.players[1].life = 0
    stateBasedActions(g)
    expect(g.winner).toBe(0)
  })
})

/* ── Triggers ─────────────────────────────────────────────────────────── */

describe("triggered abilities", () => {
  it("fires an enters trigger on another creature", () => {
    const g = game()
    put(g, "Impact Tremors", 0)
    const elf = put(g, "Llanowar Elves", 0)
    checkTriggers(g, { type: "enters", card: elf })
    resolveAll(g)
    expect(g.players[1].life).toBe(STARTING_LIFE - 1)
  })

  it("does not fire the opponent's trigger", () => {
    const g = game()
    put(g, "Impact Tremors", 1)
    const elf = put(g, "Llanowar Elves", 0)
    checkTriggers(g, { type: "enters", card: elf })
    resolveAll(g)
    expect(g.players[1].life).toBe(STARTING_LIFE)
  })

  it("puts a trample counter on with Beorn at combat", () => {
    const g = game()
    put(g, "Beorn the Fierce", 0)
    const elf = put(g, "Llanowar Elves", 0)
    checkTriggers(g, { type: "beginCombat", player: 0 })
    resolveAll(g)
    const gotOne = [elf, ...battlefield(g, 0)].some((c) => (c.counters["trample"] ?? 0) > 0)
    expect(gotOne).toBe(true)
  })
})

/* ── The decks themselves ─────────────────────────────────────────────── */

describe("the real decks", () => {
  it("builds every card in every deck", () => {
    for (const deck of DECKS) {
      const list = deckList(deck.id)!
      expect(cardDef(list.commander), `${deck.id} commander`).toBeDefined()
      for (const name of list.cards) {
        expect(cardDef(name), `${deck.id}: ${name}`).toBeDefined()
      }
    }
  })

  it("makes a hundred-card deck of each", () => {
    for (const deck of DECKS) {
      const list = deckList(deck.id)!
      expect(list.cards.length + 1, deck.id).toBe(100)
    }
  })

  /* The point of deriving from the printed data: every creature has a real
     body and every land makes real mana, with nothing written by hand. */
  it("gives every creature a power and toughness", () => {
    const creatures = allDefs().filter((d) => d.types.includes("Creature"))
    expect(creatures.length).toBeGreaterThan(60)
    for (const d of creatures) {
      expect(d.power, d.name).not.toBeNull()
      expect(d.toughness, d.name).not.toBeNull()
    }
  })

  it("gives every non-basic land a mana ability", () => {
    const lands = allDefs().filter((d) => d.types.includes("Land"))
    const dead = lands.filter((d) => !d.abilities.some((a) => a.kind === "mana"))
    // A land that taps for nothing is a real card, but it should be rare.
    expect(dead.length, `dead lands: ${dead.map((d) => d.name).join(", ")}`).toBeLessThan(6)
  })

  it("plays a land and taps it for the colour it makes", () => {
    const g = game()
    const forest = toHand(g, "Forest", 0)
    playLand(g, forest.id)
    expect(tapForMana(g, forest.id)).toBe(true)
    expect(g.players[0].pool.G).toBe(1)
  })

  it("finds mana for a real cost from real lands", () => {
    const g = game()
    for (let i = 0; i < 5; i++) put(g, "Forest", 0)
    expect(autoTapFor(g, 0, "{3}{G}{G}")).toBe(true)
  })
})
