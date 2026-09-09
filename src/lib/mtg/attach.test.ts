import { describe, it, expect } from "vitest"
import { createGame, moveCard, battlefield, STARTING_LIFE } from "./state"
import { cardDef } from "./cards"
import { canEquip, equip, castSpell } from "./actions"
import { advanceTo } from "./turn"
import { resolveAll, stateBasedActions } from "./stack"
import { declareAttackers, declareBlockers, combatDamage } from "./combat"
import { canTarget, hasKeyword, powerOf, toughnessOf, attachmentsOf } from "./continuous"
import { aiEquip, chooseBlocks } from "./ai"
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

/* ── Equipment ────────────────────────────────────────────────────────── */

describe("equipment", () => {
  it("is recognised as an Equipment", () => {
    expect(cardDef("Lightning Greaves")?.attach?.kind).toBe("equipment")
    expect(cardDef("Skullclamp")?.attach?.equipCost).toBe("{1}")
  })

  it("attaches to your own creature", () => {
    const g = game()
    const boots = put(g, "Lightning Greaves", 0)
    const bear = put(g, "Beorn the Fierce", 0)
    expect(canEquip(g, boots.id, bear.id)).toBeNull()
    expect(equip(g, boots.id, bear.id)).toBe(true)
    expect(boots.attachedTo).toBe(bear.id)
    expect(attachmentsOf(g, bear)).toHaveLength(1)
  })

  it("refuses to attach to the opponent's creature", () => {
    const g = game()
    const boots = put(g, "Lightning Greaves", 0)
    const theirs = put(g, "Beorn the Fierce", 1)
    expect(canEquip(g, boots.id, theirs.id)).toBe("only your own creatures")
  })

  it("refuses to attach to something that is not a creature", () => {
    const g = game()
    const boots = put(g, "Lightning Greaves", 0)
    const land = put(g, "Forest", 0)
    expect(canEquip(g, boots.id, land.id)).toBe("not a creature")
  })

  it("is sorcery speed", () => {
    const g = game()
    const boots = put(g, "Lightning Greaves", 0)
    const bear = put(g, "Beorn the Fierce", 0)
    advanceTo(g, "declareAttackers")
    expect(canEquip(g, boots.id, bear.id)).toBe("only in a main phase")
  })

  it("charges the equip cost", () => {
    const g = game()
    const clamp = put(g, "Skullclamp", 0)
    const bear = put(g, "Beorn the Fierce", 0)
    put(g, "Forest", 0)
    expect(equip(g, clamp.id, bear.id)).toBe(true)
    expect(battlefield(g, 0).filter((c) => c.tapped)).toHaveLength(1)
  })

  it("refuses when the equip cost cannot be paid", () => {
    const g = game()
    const clamp = put(g, "Skullclamp", 0)
    const bear = put(g, "Beorn the Fierce", 0)
    expect(canEquip(g, clamp.id, bear.id)).toBe("not enough mana")
  })

  it("grants its keywords to the creature it is on", () => {
    const g = game()
    const boots = put(g, "Lightning Greaves", 0)
    const bear = put(g, "Beorn the Fierce", 0, false)
    expect(hasKeyword(g, bear, "haste")).toBe(false)
    equip(g, boots.id, bear.id)
    expect(hasKeyword(g, bear, "haste")).toBe(true)
    expect(hasKeyword(g, bear, "hexproof")).toBe(true)
  })

  it("does not grant them to anything else", () => {
    const g = game()
    const boots = put(g, "Lightning Greaves", 0)
    const bear = put(g, "Beorn the Fierce", 0)
    const other = put(g, "Llanowar Elves", 0)
    equip(g, boots.id, bear.id)
    expect(hasKeyword(g, other, "haste")).toBe(false)
  })

  it("changes power and toughness", () => {
    const g = game()
    const clamp = put(g, "Skullclamp", 0)
    const elf = put(g, "Llanowar Elves", 0) // 1/1
    put(g, "Forest", 0)
    equip(g, clamp.id, elf.id)
    expect(powerOf(g, elf)).toBe(2)
    expect(toughnessOf(g, elf)).toBe(0)
  })

  /* Skullclamp on a 1/1 kills it, which is the whole card. */
  it("kills a creature whose toughness it drops to zero, and draws", () => {
    const g = game()
    const clamp = put(g, "Skullclamp", 0)
    const elf = put(g, "Llanowar Elves", 0)
    put(g, "Forest", 0)
    const before = g.players[0].hand.length
    equip(g, clamp.id, elf.id)
    stateBasedActions(g)
    resolveAll(g)
    expect(g.cards[elf.id].zone).toBe("graveyard")
    expect(g.players[0].hand.length).toBe(before + 2)
  })

  /* A dead creature must not keep handing out its buffs. */
  it("falls off when its creature dies, and stays on the battlefield", () => {
    const g = game()
    const boots = put(g, "Lightning Greaves", 0)
    const elf = put(g, "Llanowar Elves", 0)
    equip(g, boots.id, elf.id)
    elf.damage = 5
    stateBasedActions(g)
    expect(g.cards[elf.id].zone).toBe("graveyard")
    expect(boots.attachedTo).toBeNull()
    expect(boots.zone).toBe("battlefield")
  })

  it("comes off when the Equipment itself leaves", () => {
    const g = game()
    const boots = put(g, "Lightning Greaves", 0)
    const bear = put(g, "Beorn the Fierce", 0)
    equip(g, boots.id, bear.id)
    moveCard(g, boots.id, "graveyard")
    expect(hasKeyword(g, bear, "haste")).toBe(false)
  })

  it("moves from one creature to another", () => {
    const g = game()
    const boots = put(g, "Lightning Greaves", 0)
    const first = put(g, "Llanowar Elves", 0)
    const second = put(g, "Beorn the Fierce", 0)
    equip(g, boots.id, first.id)
    equip(g, boots.id, second.id)
    expect(boots.attachedTo).toBe(second.id)
    expect(hasKeyword(g, first, "haste")).toBe(false)
    expect(hasKeyword(g, second, "haste")).toBe(true)
  })

  it("is put on the biggest creature by the AI", () => {
    const g = game()
    g.active = 0
    const boots = put(g, "Lightning Greaves", 0)
    put(g, "Llanowar Elves", 0)
    const big = put(g, "Beorn the Fierce", 0)
    expect(aiEquip(g, 0)).toBe(1)
    expect(boots.attachedTo).toBe(big.id)
  })
})

/* ── Hexproof ─────────────────────────────────────────────────────────── */

describe("hexproof", () => {
  it("stops an opponent choosing it", () => {
    const g = game()
    const mine = put(g, "Beorn the Fierce", 0)
    mine.untilEot.keywords.push("hexproof")
    expect(canTarget(g, mine, 1)).toBe(false)
  })

  it("still lets its own controller choose it", () => {
    const g = game()
    const mine = put(g, "Beorn the Fierce", 0)
    mine.untilEot.keywords.push("hexproof")
    expect(canTarget(g, mine, 0)).toBe(true)
  })

  it("leaves an ordinary creature targetable", () => {
    const g = game()
    const mine = put(g, "Beorn the Fierce", 0)
    expect(canTarget(g, mine, 1)).toBe(true)
  })

  /* Lightning Greaves exists to make its creature untouchable. */
  it("comes with the boots", () => {
    const g = game()
    const boots = put(g, "Lightning Greaves", 0)
    const bear = put(g, "Beorn the Fierce", 0)
    expect(canTarget(g, bear, 1)).toBe(true)
    equip(g, boots.id, bear.id)
    expect(canTarget(g, bear, 1)).toBe(false)
  })
})

/* ── Fog ──────────────────────────────────────────────────────────────── */

describe("preventing combat damage", () => {
  it("stops all of it for the turn", () => {
    const g = game()
    for (let i = 0; i < 3; i++) put(g, "Forest", 0)
    const attacker = put(g, "Beorn the Fierce", 1)
    advanceTo(g, "main1")
    expect(g.active).toBe(1)

    castSpell(g, toHand(g, "Fog", 0).id)
    resolveAll(g)
    expect(g.preventCombatDamage).toBe(true)

    advanceTo(g, "declareAttackers")
    declareAttackers(g, [attacker.id])
    combatDamage(g)
    expect(g.players[0].life).toBe(STARTING_LIFE)
  })

  it("also spares the creatures in combat", () => {
    const g = game()
    g.preventCombatDamage = true
    advanceTo(g, "declareAttackers")
    const attacker = put(g, "Beorn the Fierce", 0)
    const blocker = put(g, "Llanowar Elves", 1)
    declareAttackers(g, [attacker.id])
    declareBlockers(g, { [blocker.id]: attacker.id })
    combatDamage(g)
    stateBasedActions(g)
    expect(g.cards[blocker.id].zone).toBe("battlefield")
  })

  it("wears off at end of turn", () => {
    const g = game()
    g.preventCombatDamage = true
    advanceTo(g, "cleanup")
    expect(g.preventCombatDamage).toBe(false)
  })
})

/* ── Legolas's Quick Reflexes ─────────────────────────────────────────── */

describe("Legolas's Quick Reflexes", () => {
  it("untaps and protects the creature", () => {
    const g = game()
    put(g, "Forest", 0)
    const bear = put(g, "Beorn the Fierce", 0)
    bear.tapped = true
    const spell = toHand(g, "Legolas's Quick Reflexes", 0)
    expect(castSpell(g, spell.id, [{ kind: "card", id: bear.id }])).toBe(true)
    resolveAll(g)
    expect(bear.tapped).toBe(false)
    expect(hasKeyword(g, bear, "hexproof")).toBe(true)
    expect(hasKeyword(g, bear, "indestructible")).toBe(true)
    expect(canTarget(g, bear, 1)).toBe(false)
  })

  it("says that split second is not implemented", () => {
    const g = game()
    put(g, "Forest", 0)
    const bear = put(g, "Beorn the Fierce", 0)
    castSpell(g, toHand(g, "Legolas's Quick Reflexes", 0).id, [{ kind: "card", id: bear.id }])
    resolveAll(g)
    expect(g.log.some((l) => l.unimplemented && /split second/i.test(l.text))).toBe(true)
  })
})

/* ── Blocking a menace creature ───────────────────────────────────────── */

describe("the AI against menace", () => {
  /* Assigning one blocker to a menace creature is not a legal block, so an AI
     that only ever picked one could never block menace at all. */
  it("commits two blockers or none", () => {
    const g = game()
    advanceTo(g, "declareAttackers")
    const attacker = put(g, "Llanowar Elves", 0)
    attacker.untilEot.keywords.push("menace")
    attacker.untilEot.power = 6
    const a = put(g, "Beorn the Fierce", 1)
    const b = put(g, "Beorn the Fierce", 1)
    declareAttackers(g, [attacker.id])
    const blocks = chooseBlocks(g, 1)
    const assigned = Object.values(blocks).filter((id) => id === attacker.id)
    expect(assigned.length === 0 || assigned.length >= 2).toBe(true)
    expect([a.id, b.id]).toContain(Number(Object.keys(blocks)[0] ?? a.id))
  })

  it("does not block menace with its only creature", () => {
    const g = game()
    advanceTo(g, "declareAttackers")
    const attacker = put(g, "Beorn the Fierce", 0)
    attacker.untilEot.keywords.push("menace")
    const lone = put(g, "Llanowar Elves", 1)
    declareAttackers(g, [attacker.id])
    expect(chooseBlocks(g, 1)[lone.id]).toBeUndefined()
  })

  it("blocks menace with two when they can kill it", () => {
    const g = game()
    advanceTo(g, "declareAttackers")
    const attacker = put(g, "Llanowar Elves", 0)
    attacker.untilEot.keywords.push("menace")
    const a = put(g, "Beorn the Fierce", 1)
    const b = put(g, "Beorn the Fierce", 1)
    declareAttackers(g, [attacker.id])
    const blocks = chooseBlocks(g, 1)
    expect(blocks[a.id]).toBe(attacker.id)
    expect(blocks[b.id]).toBe(attacker.id)

    // And the block is legal once declared.
    declareBlockers(g, blocks)
    expect(g.cards[a.id].blocking).toBe(attacker.id)
    expect(g.cards[b.id].blocking).toBe(attacker.id)
  })
})

/* ── Auras ────────────────────────────────────────────────────────────── */

describe("auras", () => {
  it("is recognised as an Aura", () => {
    expect(cardDef("Animate Dead")?.attach?.kind).toBe("aura")
  })

  it("attaches to the creature it brings back", () => {
    const g = game()
    for (let i = 0; i < 2; i++) put(g, "Swamp", 0)
    const dead = put(g, "Beorn the Fierce", 0)
    moveCard(g, dead.id, "graveyard")

    const aura = toHand(g, "Animate Dead", 0)
    expect(castSpell(g, aura.id)).toBe(true)
    resolveAll(g)
    expect(g.cards[dead.id].zone).toBe("battlefield")
    expect(g.cards[aura.id].attachedTo).toBe(dead.id)
  })

  /* An Aura with nothing to enchant goes to the graveyard; an Equipment does
     not. That difference is the whole reason the two are separate kinds. */
  it("goes to the graveyard when its creature dies", () => {
    const g = game()
    for (let i = 0; i < 2; i++) put(g, "Swamp", 0)
    const dead = put(g, "Llanowar Elves", 0)
    moveCard(g, dead.id, "graveyard")
    const aura = toHand(g, "Animate Dead", 0)
    castSpell(g, aura.id)
    resolveAll(g)
    expect(g.cards[aura.id].attachedTo).toBe(dead.id)

    g.cards[dead.id].damage = 9
    stateBasedActions(g)
    expect(g.cards[dead.id].zone).toBe("graveyard")
    expect(g.cards[aura.id].zone).toBe("graveyard")
  })
})
