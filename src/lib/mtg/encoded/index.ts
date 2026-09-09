/**
 * Hand-written behaviour for cards whose rules text the engine can run.
 *
 * A card's body — power, toughness, types, keywords, the mana a land makes —
 * is derived from the printed data and never appears here. This file is only
 * for text: triggers, static effects, and what a spell does when it resolves.
 *
 * Anything not listed still plays. It enters as its printed self with its
 * keywords working, and the game marks it so the player can see which of its
 * text is inert. Cards are added here over time; nothing breaks by being absent.
 */

import type { Ability, Attachment } from "../types"

export interface EncodedCard {
  abilities: Ability[]
  /** Equipment and Auras: what the card attaches to, and what moving it costs. */
  attach?: Attachment
}

/** Shorthands, so an entry reads close to the card it encodes. */
const yourCreatures = { types: ["Creature"], controller: "you" as const }
const anyCreature = { what: "creature" as const, controller: "any" as const, chosen: true }
const yourCreature = { what: "creature" as const, controller: "you" as const, chosen: true }

export const ENCODED: Record<string, EncodedCard> = {
  /* ── Commanders ─────────────────────────────────────────────────────── */

  "Jetmir, Nexus of Revels": {
    // Three static thresholds keyed off how many creatures are attacking.
    // Modelled as one trigger on attack, which is where they matter.
    abilities: [
      {
        kind: "triggered",
        on: { when: "attacks", who: "self" },
        effects: [
          {
            do: "grant",
            keyword: "vigilance",
            target: { what: "creature", controller: "you", count: "all" },
            until: "eot",
          },
        ],
      },
      {
        kind: "static",
        effect: { kind: "buff", filter: yourCreatures, power: 1, toughness: 0 },
      },
    ],
  },

  "Kaalia of the Vast": {
    abilities: [
      {
        kind: "triggered",
        on: { when: "attacks", who: "self" },
        effects: [
          {
            do: "unimplemented",
            note: "put an Angel, Demon or Dragon from your hand onto the battlefield attacking",
          },
        ],
      },
    ],
  },

  "Beorn the Fierce": {
    abilities: [
      {
        kind: "static",
        effect: {
          kind: "buff",
          filter: { subtypes: ["Bear"], controller: "you", excludeSelf: true },
          power: 2,
          toughness: 2,
        },
      },
      {
        kind: "triggered",
        on: { when: "beginCombat", controller: "you" },
        effects: [
          { do: "counters", counter: "trample", amount: 1, target: yourCreature },
        ],
      },
    ],
  },

  /* ── Mana creatures ─────────────────────────────────────────────────── */

  "Elvish Mystic": {
    abilities: [{ kind: "mana", cost: { tap: true }, produces: [["G"]] }],
  },
  "Llanowar Elves": {
    abilities: [{ kind: "mana", cost: { tap: true }, produces: [["G"]] }],
  },
  "Avacyn's Pilgrim": {
    abilities: [{ kind: "mana", cost: { tap: true }, produces: [["W"]] }],
  },
  "Birds of Paradise": {
    abilities: [
      { kind: "mana", cost: { tap: true }, produces: [["W", "U", "B", "R", "G"]] },
    ],
  },

  /* ── Removal and burn ───────────────────────────────────────────────── */

  "Beast Within": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "destroy", target: { what: "permanent", controller: "any", chosen: true } },
          {
            do: "token",
            count: 1,
            token: {
              name: "Beast",
              power: 3,
              toughness: 3,
              types: ["Creature"],
              subtypes: ["Beast"],
              colours: ["G"],
              keywords: [],
            },
          },
        ],
      },
    ],
  },

  "Krosan Grip": {
    abilities: [
      {
        kind: "spell",
        effects: [
          {
            do: "destroy",
            target: { what: "artifact", controller: "any", chosen: true },
          },
        ],
      },
    ],
  },

  /* ── Card draw ──────────────────────────────────────────────────────── */

  "Read the Bones": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "draw", amount: 2, who: "you" },
          { do: "loseLife", amount: 2, who: "you" },
        ],
      },
    ],
  },

  /* ── Ramp ───────────────────────────────────────────────────────────── */

  "Nature's Lore": {
    abilities: [
      {
        kind: "spell",
        effects: [{ do: "tutor", filter: { subtypes: ["Forest"] }, to: "battlefield" }],
      },
    ],
  },

  "Skyshroud Claim": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "tutor", filter: { subtypes: ["Forest"] }, to: "battlefield" },
          { do: "tutor", filter: { subtypes: ["Forest"] }, to: "battlefield" },
        ],
      },
    ],
  },

  "Sol Ring": {
    abilities: [{ kind: "mana", cost: { tap: true }, produces: [["C"], ["C"]] }],
  },

  /* ── Damage on a trigger ────────────────────────────────────────────── */

  "Impact Tremors": {
    abilities: [
      {
        kind: "triggered",
        on: { when: "enters", who: "other", filter: { types: ["Creature"], controller: "you" } },
        effects: [
          { do: "damage", amount: 1, target: { what: "player", controller: "opponent" } },
        ],
      },
    ],
  },

  "Ram Through": {
    abilities: [
      {
        kind: "spell",
        effects: [
          {
            do: "unimplemented",
            note: "deal damage equal to your creature's power to a creature you don't control",
          },
        ],
      },
    ],
  },

  /* ── Pump ───────────────────────────────────────────────────────────── */

  "Coat of Arms": {
    abilities: [
      {
        kind: "static",
        effect: { kind: "buff", filter: yourCreatures, power: 1, toughness: 1 },
      },
    ],
  },

  /* ── Board wipes ────────────────────────────────────────────────────── */

  "Wrath of God": {
    abilities: [
      {
        kind: "spell",
        effects: [{ do: "destroy", target: { what: "creature", controller: "any", count: "all" } }],
      },
    ],
  },

  "Blasphemous Act": {
    abilities: [
      {
        kind: "spell",
        effects: [
          {
            do: "damage",
            amount: 13,
            target: { what: "creature", controller: "any", count: "all" },
          },
        ],
      },
    ],
  },

  /* ── Targeted removal ───────────────────────────────────────────────── */

  Terminate: {
    abilities: [{ kind: "spell", effects: [{ do: "destroy", target: anyCreature }] }],
  },

  Bedevil: {
    abilities: [
      {
        kind: "spell",
        effects: [{ do: "destroy", target: { what: "permanent", controller: "any", chosen: true } }],
      },
    ],
  },

  "Path to Exile": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "exile", target: anyCreature },
          { do: "unimplemented", note: "its controller may search for a basic land" },
        ],
      },
    ],
  },

  "Swords to Plowshares": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "exile", target: anyCreature },
          { do: "unimplemented", note: "its controller gains life equal to its power" },
        ],
      },
    ],
  },

  Despark: {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "exile", target: { what: "permanent", controller: "any", chosen: true } },
          { do: "unimplemented", note: "only a permanent with mana value 4 or greater" },
        ],
      },
    ],
  },

  "Anguished Unmaking": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "exile", target: { what: "permanent", controller: "any", chosen: true } },
          { do: "loseLife", amount: 3, who: "you" },
        ],
      },
    ],
  },

  "Generous Gift": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "destroy", target: { what: "permanent", controller: "any", chosen: true } },
          {
            do: "token",
            count: 1,
            token: {
              name: "Elephant",
              power: 3,
              toughness: 3,
              types: ["Creature"],
              subtypes: ["Elephant"],
              colours: ["G"],
              keywords: [],
            },
          },
        ],
      },
    ],
  },

  "Nature's Claim": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "destroy", target: { what: "permanent", controller: "any", chosen: true } },
          { do: "gainLife", amount: 4, who: "opponent" },
        ],
      },
    ],
  },

  /* ── Card draw ──────────────────────────────────────────────────────── */

  "Night's Whisper": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "draw", amount: 2, who: "you" },
          { do: "loseLife", amount: 2, who: "you" },
        ],
      },
    ],
  },

  "Phyrexian Arena": {
    abilities: [
      {
        kind: "triggered",
        on: { when: "upkeep", controller: "you" },
        effects: [
          { do: "draw", amount: 1, who: "you" },
          { do: "loseLife", amount: 1, who: "you" },
        ],
      },
    ],
  },

  /* ── Reanimation and ramp ───────────────────────────────────────────── */

  Reanimate: {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "reanimate", who: "each" },
          { do: "unimplemented", note: "you lose life equal to its mana value" },
        ],
      },
    ],
  },

  "Three Visits": {
    abilities: [
      {
        kind: "spell",
        effects: [{ do: "tutor", filter: { subtypes: ["Forest"] }, to: "battlefield" }],
      },
    ],
  },

  /* ── Protection and pump ────────────────────────────────────────────── */

  "Heroic Intervention": {
    abilities: [
      {
        kind: "spell",
        effects: [
          {
            do: "grant",
            keyword: "indestructible",
            target: { what: "creature", controller: "you", count: "all" },
            until: "eot",
          },
          {
            do: "grant",
            keyword: "hexproof",
            target: { what: "creature", controller: "you", count: "all" },
            until: "eot",
          },
        ],
      },
    ],
  },

  "Snakeskin Veil": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "counters", counter: "+1/+1", amount: 1, target: yourCreature },
          { do: "grant", keyword: "hexproof", target: yourCreature, until: "eot" },
        ],
      },
    ],
  },

  "Triumph of the Hordes": {
    abilities: [
      {
        kind: "spell",
        effects: [
          {
            do: "buff",
            power: 1,
            toughness: 1,
            target: { what: "creature", controller: "you", count: "all" },
            until: "eot",
          },
          {
            do: "grant",
            keyword: "trample",
            target: { what: "creature", controller: "you", count: "all" },
            until: "eot",
          },
          { do: "unimplemented", note: "and gain infect" },
        ],
      },
    ],
  },

  /* ── Signets and rocks that cost mana to use ────────────────────────── */

  "Boros Signet": {
    abilities: [{ kind: "mana", cost: { tap: true, mana: "{1}" }, produces: [["R"], ["W"]] }],
  },
  "Orzhov Signet": {
    abilities: [{ kind: "mana", cost: { tap: true, mana: "{1}" }, produces: [["W"], ["B"]] }],
  },
  "Rakdos Signet": {
    abilities: [{ kind: "mana", cost: { tap: true, mana: "{1}" }, produces: [["B"], ["R"]] }],
  },
  "Basalt Monolith": {
    abilities: [
      { kind: "mana", cost: { tap: true }, produces: [["C"], ["C"], ["C"]] },
      { kind: "spell", effects: [{ do: "unimplemented", note: "does not untap during your untap step" }] },
    ],
  },

  "Talisman of Conviction": {
    // Two mana abilities on the card; the engine offers one, which still makes
    // exactly one mana, so the card is worth what it should be.
    abilities: [
      { kind: "mana", cost: { tap: true }, produces: [["C", "R", "W"]] },
      { kind: "spell", effects: [{ do: "unimplemented", note: "coloured mana costs you 1 life" }] },
    ],
  },

  /* ── Anthems and payoffs ────────────────────────────────────────────── */

  "Cathars' Crusade": {
    abilities: [
      {
        kind: "triggered",
        on: { when: "enters", who: "other", filter: { types: ["Creature"], controller: "you" } },
        effects: [
          {
            do: "counters",
            counter: "+1/+1",
            amount: 1,
            target: { what: "creature", controller: "you", count: "all" },
          },
        ],
      },
    ],
  },

  "Shamanic Revelation": {
    abilities: [
      {
        kind: "spell",
        effects: [
          {
            do: "draw",
            amount: { count: "creatures", filter: { controller: "you" } },
            who: "you",
          },
          { do: "unimplemented", note: "gain 4 life per creature with power 4 or greater" },
        ],
      },
    ],
  },

  "Sram's Expertise": {
    abilities: [
      {
        kind: "spell",
        effects: [
          {
            do: "token",
            count: 3,
            token: {
              name: "Servo",
              power: 1,
              toughness: 1,
              types: ["Creature"],
              subtypes: ["Servo"],
              colours: [],
              keywords: [],
            },
          },
          { do: "unimplemented", note: "and cast a spell of mana value 3 or less for free" },
        ],
      },
    ],
  },

  /* ── Protection tricks ──────────────────────────────────────────────── */

  "Flawless Maneuver": {
    abilities: [
      {
        kind: "spell",
        effects: [
          {
            do: "grant",
            keyword: "indestructible",
            target: { what: "creature", controller: "you", count: "all" },
            until: "eot",
          },
          { do: "unimplemented", note: "free if you control a commander" },
        ],
      },
    ],
  },

  "Akroma's Will": {
    abilities: [
      {
        kind: "spell",
        effects: [
          {
            do: "grant",
            keyword: "flying",
            target: { what: "creature", controller: "you", count: "all" },
            until: "eot",
          },
          {
            do: "grant",
            keyword: "vigilance",
            target: { what: "creature", controller: "you", count: "all" },
            until: "eot",
          },
          {
            do: "grant",
            keyword: "double strike",
            target: { what: "creature", controller: "you", count: "all" },
            until: "eot",
          },
          { do: "unimplemented", note: "the second mode, and the choice between them" },
        ],
      },
    ],
  },

  /* ── Graveyard and library ──────────────────────────────────────────── */

  "Animate Dead": {
    // A real Aura: it attaches to the creature it brings back, and follows it
    // to the graveyard. What it does not do is take the creature with it when
    // the Aura is the one destroyed.
    attach: { kind: "aura" },
    abilities: [
      {
        kind: "triggered",
        on: { when: "enters", who: "self" },
        effects: [
          { do: "reanimate", who: "each" },
          { do: "unimplemented", note: "the creature does not leave when this Aura does" },
        ],
      },
    ],
  },

  Gamble: {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "tutor", filter: {}, to: "hand" },
          { do: "unimplemented", note: "then discard a card at random" },
        ],
      },
    ],
  },

  "Green Sun's Zenith": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "tutor", filter: { types: ["Creature"], colours: ["G"] }, to: "battlefield" },
          { do: "unimplemented", note: "limited by X, and shuffled back in" },
        ],
      },
    ],
  },

  "Finale of Devastation": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "tutor", filter: { types: ["Creature"] }, to: "battlefield" },
          { do: "unimplemented", note: "limited by X" },
        ],
      },
    ],
  },

  /* ── X spells ───────────────────────────────────────────────────────── */

  "Secure the Wastes": {
    abilities: [
      {
        kind: "spell",
        effects: [
          {
            do: "token",
            count: { count: "x" },
            token: {
              name: "Warrior",
              power: 1,
              toughness: 1,
              types: ["Creature"],
              subtypes: ["Warrior"],
              colours: ["W"],
              keywords: [],
            },
          },
        ],
      },
    ],
  },

  "Grand Crescendo": {
    abilities: [
      {
        kind: "spell",
        effects: [
          {
            do: "token",
            count: { count: "x" },
            token: {
              name: "Citizen",
              power: 1,
              toughness: 1,
              types: ["Creature"],
              subtypes: ["Citizen"],
              colours: ["G", "W"],
              keywords: [],
            },
          },
          {
            do: "grant",
            keyword: "indestructible",
            target: { what: "creature", controller: "you", count: "all" },
            until: "eot",
          },
        ],
      },
    ],
  },

  "Call the Coppercoats": {
    abilities: [
      {
        kind: "spell",
        effects: [
          {
            do: "token",
            count: { count: "x" },
            token: {
              name: "Soldier",
              power: 1,
              toughness: 1,
              types: ["Creature"],
              subtypes: ["Human", "Soldier"],
              colours: ["W"],
              keywords: [],
            },
          },
          { do: "unimplemented", note: "X counts the opponent's creatures, not the mana paid" },
        ],
      },
    ],
  },

  "Tyvar's Stand": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "counters", counter: "+1/+1", amount: { count: "x" }, target: yourCreature },
          { do: "grant", keyword: "hexproof", target: yourCreature, until: "eot" },
          { do: "grant", keyword: "indestructible", target: yourCreature, until: "eot" },
          { do: "unimplemented", note: "the bonus is counters here rather than +X/+X for the turn" },
        ],
      },
    ],
  },

  /* ── Equipment ──────────────────────────────────────────────────────── */

  "Lightning Greaves": {
    attach: { kind: "equipment", equipCost: "{0}" },
    abilities: [
      { kind: "static", effect: { kind: "equippedGrant", keyword: "haste" } },
      // Shroud stops everyone targeting it; hexproof stops opponents. The
      // engine has hexproof, and the difference only matters when you want to
      // target your own creature, which is the rarer case.
      { kind: "static", effect: { kind: "equippedGrant", keyword: "hexproof" } },
    ],
  },

  "Swiftfoot Boots": {
    attach: { kind: "equipment", equipCost: "{1}" },
    abilities: [
      { kind: "static", effect: { kind: "equippedGrant", keyword: "hexproof" } },
      { kind: "static", effect: { kind: "equippedGrant", keyword: "haste" } },
    ],
  },

  Skullclamp: {
    attach: { kind: "equipment", equipCost: "{1}" },
    abilities: [
      { kind: "static", effect: { kind: "equippedBuff", power: 1, toughness: -1 } },
      {
        kind: "triggered",
        on: { when: "dies", who: "attached" },
        effects: [{ do: "draw", amount: 2, who: "you" }],
      },
    ],
  },

  /* ── Damage prevention ──────────────────────────────────────────────── */

  Fog: {
    abilities: [{ kind: "spell", effects: [{ do: "preventCombatDamage" }] }],
  },

  /* ── Protection ─────────────────────────────────────────────────────── */

  "Legolas's Quick Reflexes": {
    // Split second is dropped: the card is played to protect a creature, and
    // that half works. What it cannot do is stop a response.
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "untap", target: yourCreature },
          { do: "grant", keyword: "hexproof", target: yourCreature, until: "eot" },
          { do: "grant", keyword: "indestructible", target: yourCreature, until: "eot" },
          { do: "unimplemented", note: "split second" },
        ],
      },
    ],
  },

  "Force of Vigor": {
    abilities: [
      {
        kind: "spell",
        effects: [
          { do: "destroy", target: { what: "artifact", controller: "opponent", count: 2 } },
          { do: "destroy", target: { what: "enchantment", controller: "opponent", count: 2 } },
        ],
      },
    ],
  },
}

export function encodedFor(name: string): EncodedCard | undefined {
  return ENCODED[name]
}

/** Cards this file knows how to run, for the coverage report. */
export const ENCODED_NAMES = Object.keys(ENCODED)

export { anyCreature }
