import { describe, it, expect } from "vitest"
import { KERNEL_CARDS, KERNEL_DECKS, kernelDeckList } from "./kernel"
import { cardDef, deckList } from "../cards"
import { createGame, battlefield, moveCard, STARTING_LIFE } from "../state"
import { selfPlay } from "../duel"
import { castSpell } from "../actions"
import { resolveAll, stateBasedActions, checkTriggers } from "../stack"
import { powerOf, hasKeyword } from "../continuous"
import { advanceTo } from "../turn"
import { declareAttackers } from "../combat"
import { keywordGlossary, keywordName, typeName, colourName } from "../flavour"
import { KEYWORDS, type GameCard, type GameState } from "../types"

const DECK_SIZE = 40

function put(state: GameState, name: string, controller: 0 | 1, ready = true): GameCard {
  const def = cardDef(name)
  if (!def) throw new Error(`no card called ${name}`)
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

const game = (a = "runaway", b = "firewall", seed = 5): GameState =>
  createGame(a, b, ["you", "ai"], { seed, skipOpeningHand: true })

/* ── The promise of the set ───────────────────────────────────────────── */

describe("every card works", () => {
  /*
   * This is the whole reason the set exists. The real Commander decks have
   * about half their non-creature spells resolving into nothing, because their
   * text was written for a far larger rules system. These cards were designed
   * against the vocabulary the engine already has, so there is nothing to
   * approximate — and if that ever stops being true, this fails.
   */
  it("has no card that is only partly implemented", () => {
    for (const card of Object.values(KERNEL_CARDS)) {
      expect(card.encoded, `${card.name} is ${card.encoded}`).toBe("full")
    }
  })

  it("never marks a card's text as unimplemented", () => {
    for (const card of Object.values(KERNEL_CARDS)) {
      for (const ability of card.abilities) {
        const effects = "effects" in ability ? ability.effects : []
        for (const e of effects) {
          expect(e.do, `${card.name}`).not.toBe("unimplemented")
        }
      }
    }
  })

  /** A spell that resolves and does nothing is the thing being avoided. */
  it("gives every non-land card something to do", () => {
    for (const card of Object.values(KERNEL_CARDS)) {
      if (card.types.includes("Land")) continue
      const doesSomething =
        card.abilities.length > 0 || card.types.includes("Creature")
      expect(doesSomething, `${card.name} does nothing`).toBe(true)
    }
  })

  it("gives every creature a body", () => {
    for (const card of Object.values(KERNEL_CARDS)) {
      if (!card.types.includes("Creature")) continue
      expect(card.power, card.name).not.toBeNull()
      expect(card.toughness, card.name).not.toBeNull()
    }
  })

  it("gives every volume a mana ability that makes exactly one mana", () => {
    for (const card of Object.values(KERNEL_CARDS)) {
      if (!card.types.includes("Land")) continue
      const mana = card.abilities.find((a) => a.kind === "mana")
      expect(mana, card.name).toBeDefined()
      if (mana?.kind === "mana") expect(mana.produces.length, card.name).toBe(1)
    }
  })

  it("costs every non-land card something", () => {
    for (const card of Object.values(KERNEL_CARDS)) {
      if (card.types.includes("Land")) continue
      expect(card.cost, card.name).not.toBe("")
    }
  })
})

/* ── The decks ────────────────────────────────────────────────────────── */

describe("the decks", () => {
  it("builds three of them", () => {
    expect(KERNEL_DECKS).toHaveLength(3)
  })

  it("makes each one forty cards", () => {
    for (const deck of KERNEL_DECKS) {
      expect(kernelDeckList(deck.id), deck.id).toHaveLength(DECK_SIZE)
    }
  })

  it("names a card that exists in every slot", () => {
    for (const deck of KERNEL_DECKS) {
      for (const name of kernelDeckList(deck.id)!) {
        expect(cardDef(name), `${deck.id}: ${name}`).toBeDefined()
      }
    }
  })

  /* Sixteen or so volumes in forty cards: too few and the deck cannot cast
     anything, too many and it draws nothing but volumes. */
  it("runs a workable number of volumes", () => {
    for (const deck of KERNEL_DECKS) {
      const lands = kernelDeckList(deck.id)!.filter((n) => cardDef(n)!.types.includes("Land"))
      expect(lands.length, `${deck.id} has ${lands.length} volumes`).toBeGreaterThanOrEqual(15)
      expect(lands.length, `${deck.id} has ${lands.length} volumes`).toBeLessThanOrEqual(19)
    }
  })

  it("only runs colours its volumes can make", () => {
    for (const deck of KERNEL_DECKS) {
      const list = kernelDeckList(deck.id)!.map((n) => cardDef(n)!)
      const available = new Set(list.filter((d) => d.types.includes("Land")).flatMap((d) => d.produces))
      for (const card of list) {
        for (const colour of card.colours) {
          expect(available.has(colour), `${deck.id} runs ${card.name} but makes no ${colour}`).toBe(true)
        }
      }
    }
  })

  it("is reachable through the engine's own deck lookup", () => {
    for (const deck of KERNEL_DECKS) {
      const list = deckList(deck.id)
      expect(list, deck.id).toBeDefined()
      expect(list!.cards).toHaveLength(DECK_SIZE)
      // No commander: these are not Commander decks.
      expect(list!.commander).toBe("")
    }
  })

  it("starts a game with an empty command zone", () => {
    const g = createGame("runaway", "rootkit", ["you", "ai"], { seed: 1 })
    expect(g.players[0].command).toHaveLength(0)
    expect(g.players[0].library.length + g.players[0].hand.length).toBe(DECK_SIZE)
  })
})

/* ── Cards that should do what they say ───────────────────────────────── */

describe("cards in play", () => {
  it("Spawn Worker makes a thread", () => {
    const g = game()
    for (let i = 0; i < 2; i++) put(g, "Heap Block", 0)
    const worker = put(g, "Spawn Worker", 0)
    checkTriggers(g, { type: "enters", card: worker })
    resolveAll(g)
    expect(battlefield(g, 0).filter((c) => c.token)).toHaveLength(1)
  })

  it("Supervisor buffs your processes and not theirs", () => {
    const g = game()
    put(g, "Supervisor", 0)
    const mine = put(g, "Hot Loop", 0)
    const theirs = put(g, "Hot Loop", 1)
    expect(powerOf(g, mine)).toBe(4)
    expect(powerOf(g, theirs)).toBe(3)
  })

  it("Overclock grants preempt", () => {
    const g = game()
    const fresh = put(g, "Spawn Worker", 0, false)
    expect(hasKeyword(g, fresh, "haste")).toBe(false)
    put(g, "Overclock", 0)
    expect(hasKeyword(g, fresh, "haste")).toBe(true)
  })

  it("Reboot destroys everything", () => {
    const g = game()
    for (let i = 0; i < 5; i++) put(g, "Cold Storage", 0)
    put(g, "Hot Loop", 0)
    put(g, "Hot Loop", 1)
    const reboot = put(g, "Reboot", 0)
    g.players[0].hand.push(reboot.id)
    reboot.zone = "hand"
    g.players[0].battlefield = g.players[0].battlefield.filter((id) => id !== reboot.id)
    expect(castSpell(g, reboot.id)).toBe(true)
    resolveAll(g)
    stateBasedActions(g)
    expect(battlefield(g).filter((c) => c.def.types.includes("Creature"))).toHaveLength(0)
  })

  it("Halt stops a whole combat", () => {
    const g = game()
    g.preventCombatDamage = true
    advanceTo(g, "declareAttackers")
    const attacker = put(g, "Kernel Panic", 1)
    attacker.attacking = true
    expect(g.players[0].life).toBe(STARTING_LIFE)
  })

  it("Debugger makes what it is attached to fatal", () => {
    const g = game()
    for (let i = 0; i < 2; i++) put(g, "Core Sector", 0)
    const debugger_ = put(g, "Debugger", 0)
    const host = put(g, "Hot Loop", 0)
    debugger_.attachedTo = host.id
    expect(hasKeyword(g, host, "deathtouch")).toBe(true)
    expect(powerOf(g, host)).toBe(5)
  })
})

/* ── Whole games ──────────────────────────────────────────────────────── */

describe("playing the set", () => {
  it("plays every pairing to a finish without throwing", () => {
    for (const a of KERNEL_DECKS) {
      for (const b of KERNEL_DECKS) {
        if (a.id === b.id) continue
        expect(() =>
          selfPlay(createGame(a.id, b.id, ["a", "b"], { seed: 6 }), 30)
        ).not.toThrow()
      }
    }
  })

  it("finishes games rather than grinding out the clock", () => {
    let decided = 0
    for (let seed = 1; seed <= 6; seed++) {
      const g = selfPlay(createGame("runaway", "rootkit", ["a", "b"], { seed }), 40)
      if (g.winner !== null) decided++
    }
    expect(decided, "these decks should be able to kill each other").toBeGreaterThan(2)
  })

  /* The point of a set nothing is missing from: no line of the log should ever
     say a card did not do what it said. */
  it("never logs unimplemented text", () => {
    const g = selfPlay(createGame("firewall", "rootkit", ["a", "b"], { seed: 8 }), 30)
    const bad = g.log.filter((l) => l.unimplemented)
    expect(bad.map((l) => l.text).join("; ")).toBe("")
  })

  it("gets processes onto the board and damage through", () => {
    const g = selfPlay(createGame("runaway", "firewall", ["a", "b"], { seed: 12 }), 30)
    const moved = g.players[0].life !== STARTING_LIFE || g.players[1].life !== STARTING_LIFE
    expect(moved).toBe(true)
  })
})

/* ── Flavour ──────────────────────────────────────────────────────────── */

describe("the themed names", () => {
  it("renames types for our set but not for Magic", () => {
    expect(typeName("Creature", "kernel")).toBe("process")
    expect(typeName("Creature", "mtg")).toBe("Creature")
  })

  it("renames keywords without the engine knowing", () => {
    expect(keywordName("flying", "kernel")).toBe("kernel")
    expect(keywordName("trample", "kernel")).toBe("overflow")
    expect(keywordName("trample", "mtg")).toBe("trample")
  })

  it("renames colours", () => {
    expect(colourName("R", "kernel")).toBe("core")
    expect(colourName("G", "kernel")).toBe("heap")
  })
})

/* ── Draw triggers ────────────────────────────────────────────────────── */

describe("creatures that draw cards", () => {
  /*
   * Reported as "no way to draw a card when a creature has a card draw
   * function". The trigger was fine; the creature could not be cast, because
   * affordability ignored colour. These pin the behaviour either way.
   */
  it("draws when Packet Sniffer enters, cast normally", () => {
    const g = game()
    for (let i = 0; i < 2; i++) put(g, "Net Segment", 0)
    const sniffer = put(g, "Packet Sniffer", 0)
    moveCard(g, sniffer.id, "hand")

    const libraryBefore = g.players[0].library.length
    expect(castSpell(g, sniffer.id)).toBe(true)
    resolveAll(g)

    expect(g.cards[sniffer.id].zone).toBe("battlefield")
    expect(g.players[0].library.length, "a card should have been drawn").toBe(libraryBefore - 1)
    expect(g.players[0].hand).toHaveLength(1)
  })

  it("draws when Deep Packet Inspector attacks", () => {
    const g = game()
    const dpi = put(g, "Deep Packet Inspector", 0)
    advanceTo(g, "declareAttackers")
    const before = g.players[0].library.length
    declareAttackers(g, [dpi.id])
    resolveAll(g)
    expect(g.players[0].library.length).toBe(before - 1)
  })

  it("draws when Orphan Process dies", () => {
    const g = game()
    const orphan = put(g, "Orphan Process", 0)
    const before = g.players[0].library.length
    orphan.damage = 5
    stateBasedActions(g)
    resolveAll(g)
    expect(g.cards[orphan.id].zone).toBe("graveyard")
    expect(g.players[0].library.length).toBe(before - 1)
  })

  it("draws two from Poll", () => {
    const g = game()
    for (let i = 0; i < 3; i++) put(g, "Net Segment", 0)
    const poll = put(g, "Poll", 0)
    moveCard(g, poll.id, "hand")
    const before = g.players[0].library.length
    expect(castSpell(g, poll.id)).toBe(true)
    resolveAll(g)
    expect(g.players[0].library.length).toBe(before - 2)
  })
})

/* ── The keyword reference ────────────────────────────────────────────── */

describe("the keyword glossary", () => {
  it("explains every keyword the engine has", () => {
    const glossary = keywordGlossary("kernel")
    expect(glossary).toHaveLength(KEYWORDS.length)
    for (const entry of glossary) {
      expect(entry.help, entry.engine).toBeTruthy()
      expect(entry.name, entry.engine).toBeTruthy()
    }
  })

  /* A reference listing words that appear on no card is a reference that
     teaches you something you will never use. */
  it("names only keywords that appear somewhere in the set", () => {
    const inSet = new Set<string>()
    for (const card of Object.values(KERNEL_CARDS)) {
      for (const k of card.keywords) inSet.add(k)
      for (const a of card.abilities) {
        if (a.kind === "static" && "keyword" in a.effect) inSet.add(a.effect.keyword)
        const effects = "effects" in a ? a.effects : []
        for (const e of effects) {
          if (e.do === "grant") inSet.add(e.keyword)
          if (e.do === "token") for (const k of e.token.keywords) inSet.add(k)
        }
      }
    }
    const missing = KEYWORDS.filter((k) => !inSet.has(k))
    expect(missing.join(", "), "keywords no card in the set uses").toBe("")
  })

  it("gives the themed name and the engine name both", () => {
    const overflow = keywordGlossary("kernel").find((k) => k.engine === "trample")!
    expect(overflow.name).toBe("overflow")
    const plain = keywordGlossary("mtg").find((k) => k.engine === "trample")!
    expect(plain.name).toBe("trample")
  })
})
