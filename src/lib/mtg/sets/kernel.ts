/**
 * KERNEL — a card set of our own, where every card works.
 *
 * The real Commander decks run on this same engine and about half their
 * non-creature spells still resolve doing nothing, because oracle text was
 * written for a rules system far larger than this one. This set inverts that:
 * the cards are designed against the vocabulary the engine already has, so
 * there is nothing to approximate and nothing to mark as inert. A test asserts
 * it — every card here must come out `encoded: "full"`.
 *
 * The theme is the machine the desktop is pretending to be. Two processes fight
 * for a box: creatures are processes, lands are volumes, life is uptime. The
 * engine is untouched — its colours are still WUBRG and its keywords are still
 * `flying` and `trample`; only the words on screen are themed, which is what
 * keeps combat and the stack from needing to know about any of this.
 */

import type { Ability, CardDef, Colour, Effect, Keyword, TokenSpec } from "../types"

/* ── Building a card ──────────────────────────────────────────────────── */

interface Spec {
  name: string
  cost: string
  /** Engine type. The themed name is applied by the flavour layer. */
  type: "Creature" | "Instant" | "Sorcery" | "Enchantment" | "Artifact" | "Land"
  subtypes?: string[]
  pt?: [number, number]
  keywords?: Keyword[]
  /** Rules text as printed. Kept in step with `abilities` by hand. */
  text: string
  abilities?: Ability[]
  produces?: Colour[] | "any" | "colourless"
  entersTapped?: boolean
  attach?: { kind: "equipment" | "aura"; equipCost?: string }
  rarity?: string
}

const COLOUR_OF: Record<string, Colour> = {
  "{W}": "W",
  "{U}": "U",
  "{B}": "B",
  "{R}": "R",
  "{G}": "G",
}

function coloursIn(cost: string): Colour[] {
  const out = new Set<Colour>()
  for (const m of cost.matchAll(/\{[WUBRG]\}/g)) out.add(COLOUR_OF[m[0]])
  return [...out]
}

function build(spec: Spec): CardDef {
  const produces =
    spec.produces === "any"
      ? (["W", "U", "B", "R", "G"] as Colour[])
      : spec.produces === "colourless"
        ? []
        : (spec.produces ?? [])

  const abilities: Ability[] = [...(spec.abilities ?? [])]
  if (spec.type === "Land") {
    const options =
      spec.produces === "colourless" ? (["C"] as const) : (produces as ("W" | "U" | "B" | "R" | "G")[])
    abilities.unshift({ kind: "mana", cost: { tap: true }, produces: [[...options]] })
  }

  return {
    name: spec.name,
    cost: spec.cost,
    cmc: [...spec.cost.matchAll(/\{([^}]+)\}/g)].reduce((n, m) => {
      const v = Number(m[1])
      return n + (Number.isFinite(v) ? v : m[1] === "X" ? 0 : 1)
    }, 0),
    types: [spec.type],
    subtypes: spec.subtypes ?? [],
    supertypes: [],
    colours: coloursIn(spec.cost),
    power: spec.pt ? spec.pt[0] : null,
    toughness: spec.pt ? spec.pt[1] : null,
    text: spec.text,
    keywords: spec.keywords ?? [],
    produces: spec.produces === "colourless" ? ["C"] : produces,
    abilities,
    entersTapped: spec.entersTapped ?? false,
    attach: spec.attach,
    // Everything here is written against effects the engine runs. That is the
    // entire point of the set, and a test holds it to it.
    encoded: "full",
    rarity: spec.rarity ?? "common",
    set: "KRN",
  }
}

/* ── Shorthands ───────────────────────────────────────────────────────── */

const thread = (
  name: string,
  power: number,
  toughness: number,
  colours: Colour[],
  keywords: Keyword[] = []
): TokenSpec => ({
  name,
  power,
  toughness,
  types: ["Creature"],
  subtypes: ["Thread"],
  colours,
  keywords,
})

const yours = { types: ["Creature"], controller: "you" as const }
const allYours = { what: "creature" as const, controller: "you" as const, count: "all" as const }
const target = { what: "creature" as const, controller: "any" as const, chosen: true }
const yourTarget = { what: "creature" as const, controller: "you" as const, chosen: true }
const theirFace = { what: "player" as const, controller: "opponent" as const }

const etb = (...effects: Effect[]): Ability => ({
  kind: "triggered",
  on: { when: "enters", who: "self" },
  effects,
})
const onAttack = (...effects: Effect[]): Ability => ({
  kind: "triggered",
  on: { when: "attacks", who: "self" },
  effects,
})
const onDeath = (...effects: Effect[]): Ability => ({
  kind: "triggered",
  on: { when: "dies", who: "self" },
  effects,
})
const spell = (...effects: Effect[]): Ability => ({ kind: "spell", effects })

/* ── Volumes ──────────────────────────────────────────────────────────── */

const VOLUMES: Spec[] = [
  { name: "Core Sector", cost: "", type: "Land", text: "{T}: Add {R}.", produces: ["R"] },
  { name: "Heap Block", cost: "", type: "Land", text: "{T}: Add {G}.", produces: ["G"] },
  { name: "Net Segment", cost: "", type: "Land", text: "{T}: Add {U}.", produces: ["U"] },
  { name: "UI Buffer", cost: "", type: "Land", text: "{T}: Add {W}.", produces: ["W"] },
  { name: "Cold Storage", cost: "", type: "Land", text: "{T}: Add {B}.", produces: ["B"] },
  {
    name: "Shared Volume",
    cost: "",
    type: "Land",
    text: "This volume enters tapped.\n{T}: Add one mana of any color.",
    produces: "any",
    entersTapped: true,
    rarity: "uncommon",
  },
  {
    name: "Swap Partition",
    cost: "",
    type: "Land",
    text: "{T}: Add {C}.\nWhen this volume enters, you gain 1 life.",
    produces: "colourless",
    abilities: [etb({ do: "gainLife", amount: 1, who: "you" })],
  },
]

/* ── RUNAWAY — core and heap: processes that grow and overflow ────────── */

const RUNAWAY: Spec[] = [
  {
    name: "Init Thread",
    cost: "{G}",
    type: "Creature",
    subtypes: ["Thread"],
    pt: [1, 1],
    text: "{T}: Add {G}.",
    abilities: [{ kind: "mana", cost: { tap: true }, produces: [["G"]] }],
  },
  {
    name: "Spawn Worker",
    cost: "{1}{G}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [2, 2],
    text: "When this process enters, create a 1/1 green Thread creature token.",
    abilities: [etb({ do: "token", count: 1, token: thread("Thread", 1, 1, ["G"]) })],
  },
  {
    name: "Hot Loop",
    cost: "{1}{R}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [3, 1],
    keywords: ["haste"],
    text: "Preempt.",
  },
  {
    name: "Segfault Daemon",
    cost: "{1}{R}",
    type: "Creature",
    subtypes: ["Daemon"],
    pt: [2, 1],
    keywords: ["deathtouch"],
    text: "Fatal.",
  },
  {
    name: "Memory Leak",
    cost: "{2}{G}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [2, 3],
    keywords: ["trample"],
    text: "Overflow.\nAt the beginning of your upkeep, put a +1/+1 counter on this process.",
    abilities: [
      {
        kind: "triggered",
        on: { when: "upkeep", controller: "you" },
        effects: [
          { do: "counters", counter: "+1/+1", amount: 1, target: { what: "self" } },
        ],
      },
    ],
    rarity: "uncommon",
  },
  {
    name: "Fork Bomb",
    cost: "{3}{G}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [3, 3],
    text: "When this process enters, create two 1/1 green Thread creature tokens.",
    abilities: [etb({ do: "token", count: 2, token: thread("Thread", 1, 1, ["G"]) })],
    rarity: "uncommon",
  },
  {
    name: "Scheduler",
    cost: "{2}{G}",
    type: "Creature",
    subtypes: ["Daemon"],
    pt: [2, 4],
    text: "Whenever another process you control enters, put a +1/+1 counter on it.",
    abilities: [
      {
        kind: "triggered",
        on: { when: "enters", who: "other", filter: yours },
        effects: [
          { do: "counters", counter: "+1/+1", amount: 1, target: yourTarget },
        ],
      },
    ],
    rarity: "rare",
  },
  {
    name: "Kernel Panic",
    cost: "{4}{R}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [5, 4],
    keywords: ["trample"],
    text: "Overflow.\nWhen this process enters, it deals 2 damage to your opponent.",
    abilities: [etb({ do: "damage", amount: 2, target: theirFace })],
    rarity: "rare",
  },
  {
    name: "Runaway Process",
    cost: "{5}{G}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [6, 6],
    keywords: ["trample"],
    text: "Overflow.\nWhen this process enters, draw a card.",
    abilities: [etb({ do: "draw", amount: 1, who: "you" })],
    rarity: "rare",
  },
  {
    name: "Nice Value",
    cost: "{G}",
    type: "Instant",
    text: "Target process you control gets +2/+2 until end of turn.",
    abilities: [
      spell({ do: "buff", power: 2, toughness: 2, target: yourTarget, until: "eot" }),
    ],
  },
  {
    name: "Raise Priority",
    cost: "{1}{R}",
    type: "Instant",
    text: "Target process gains overflow and preempt until end of turn.",
    abilities: [
      spell(
        { do: "grant", keyword: "trample", target, until: "eot" },
        { do: "grant", keyword: "haste", target, until: "eot" }
      ),
    ],
  },
  {
    name: "Kill Signal",
    cost: "{2}{R}",
    type: "Instant",
    text: "This interrupt deals 4 damage to target process.",
    abilities: [spell({ do: "damage", amount: 4, target })],
  },
  {
    name: "Allocate",
    cost: "{X}{G}",
    type: "Sorcery",
    text: "Put X +1/+1 counters on target process you control.",
    abilities: [
      spell({ do: "counters", counter: "+1/+1", amount: { count: "x" }, target: yourTarget }),
    ],
    rarity: "uncommon",
  },
  {
    name: "Spawn Pool",
    cost: "{X}{G}",
    type: "Sorcery",
    text: "Create X 1/1 green Thread creature tokens.",
    abilities: [
      spell({ do: "token", count: { count: "x" }, token: thread("Thread", 1, 1, ["G"]) }),
    ],
    rarity: "uncommon",
  },
  {
    name: "Thermal Throttle",
    cost: "{2}{R}",
    type: "Sorcery",
    text: "This script deals 2 damage to each process.",
    abilities: [
      spell({
        do: "damage",
        amount: 2,
        target: { what: "creature", controller: "any", count: "all" },
      }),
    ],
    rarity: "uncommon",
  },
  {
    name: "Unbounded Recursion",
    cost: "{3}{G}{G}",
    type: "Sorcery",
    text: "Processes you control get +2/+2 and gain overflow until end of turn.",
    abilities: [
      spell(
        { do: "buff", power: 2, toughness: 2, target: allYours, until: "eot" },
        { do: "grant", keyword: "trample", target: allYours, until: "eot" }
      ),
    ],
    rarity: "rare",
  },
  {
    name: "Overclock",
    cost: "{2}{R}",
    type: "Enchantment",
    text: "Processes you control get +1/+0 and have preempt.",
    abilities: [
      { kind: "static", effect: { kind: "buff", filter: yours, power: 1, toughness: 0 } },
      { kind: "static", effect: { kind: "grant", filter: yours, keyword: "haste" } },
    ],
    rarity: "rare",
  },
  {
    name: "Heat Sink",
    cost: "{2}",
    type: "Artifact",
    text: "Equipped process gets +1/+2.\nAttach {1}",
    attach: { kind: "equipment", equipCost: "{1}" },
    abilities: [{ kind: "static", effect: { kind: "equippedBuff", power: 1, toughness: 2 } }],
  },
]

/* ── FIREWALL — ui and net: blockers, threads, and card flow ──────────── */

const FIREWALL: Spec[] = [
  {
    name: "Watchdog",
    cost: "{W}",
    type: "Creature",
    subtypes: ["Daemon"],
    pt: [1, 3],
    keywords: ["vigilance"],
    text: "Async.",
  },
  {
    name: "Packet Sniffer",
    cost: "{1}{U}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [1, 2],
    text: "When this process enters, draw a card.",
    abilities: [etb({ do: "draw", amount: 1, who: "you" })],
  },
  {
    name: "Port Scanner",
    cost: "{1}{U}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [2, 1],
    keywords: ["flying"],
    text: "Kernel.",
  },
  {
    name: "Firewall Rule",
    cost: "{2}{W}",
    type: "Creature",
    subtypes: ["Daemon"],
    pt: [0, 5],
    keywords: ["defender", "reach"],
    text: "Blocking. Firewall.",
  },
  {
    name: "Load Balancer",
    cost: "{2}{W}",
    type: "Creature",
    subtypes: ["Daemon"],
    pt: [2, 2],
    text: "When this daemon enters, create two 1/1 white Thread creature tokens.",
    abilities: [etb({ do: "token", count: 2, token: thread("Thread", 1, 1, ["W"]) })],
    rarity: "uncommon",
  },
  {
    name: "Supervisor",
    cost: "{3}{W}",
    type: "Creature",
    subtypes: ["Daemon"],
    pt: [3, 4],
    text: "Processes you control get +1/+1.",
    abilities: [
      { kind: "static", effect: { kind: "buff", filter: yours, power: 1, toughness: 1 } },
    ],
    rarity: "rare",
  },
  {
    name: "Deep Packet Inspector",
    cost: "{3}{U}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [3, 3],
    keywords: ["flying"],
    text: "Kernel.\nWhenever this process attacks, draw a card.",
    abilities: [onAttack({ do: "draw", amount: 1, who: "you" })],
    rarity: "rare",
  },
  {
    name: "Root Certificate",
    cost: "{4}{W}",
    type: "Creature",
    subtypes: ["Daemon"],
    pt: [4, 6],
    keywords: ["vigilance", "lifelink"],
    text: "Async. Restore.",
    rarity: "rare",
  },
  {
    name: "Drop Packet",
    cost: "{U}",
    type: "Instant",
    text: "Return target process to its owner's hand.",
    abilities: [spell({ do: "bounce", target })],
  },
  {
    name: "Sandbox",
    cost: "{1}{W}",
    type: "Instant",
    text: "Target process you control gains sandboxed and immutable until end of turn.",
    abilities: [
      spell(
        { do: "grant", keyword: "hexproof", target: yourTarget, until: "eot" },
        { do: "grant", keyword: "indestructible", target: yourTarget, until: "eot" }
      ),
    ],
  },
  {
    name: "Rate Limit",
    cost: "{1}{U}",
    type: "Instant",
    text: "Tap target process. Draw a card.",
    abilities: [spell({ do: "tap", target }, { do: "draw", amount: 1, who: "you" })],
  },
  {
    name: "Halt",
    cost: "{2}{W}",
    type: "Instant",
    text: "Prevent all combat damage that would be dealt this turn.",
    abilities: [spell({ do: "preventCombatDamage" })],
    rarity: "uncommon",
  },
  {
    name: "Quarantine",
    cost: "{2}{W}",
    type: "Sorcery",
    text: "Exile target process.",
    abilities: [spell({ do: "exile", target })],
  },
  {
    name: "Poll",
    cost: "{2}{U}",
    type: "Sorcery",
    text: "Draw two cards.",
    abilities: [spell({ do: "draw", amount: 2, who: "you" })],
  },
  {
    name: "Fork Pool",
    cost: "{X}{W}",
    type: "Sorcery",
    text: "Create X 1/1 white Thread creature tokens.",
    abilities: [
      spell({ do: "token", count: { count: "x" }, token: thread("Thread", 1, 1, ["W"]) }),
    ],
    rarity: "uncommon",
  },
  {
    name: "Cache Warm",
    cost: "{3}{U}",
    type: "Sorcery",
    text: "Draw three cards.",
    abilities: [spell({ do: "draw", amount: 3, who: "you" })],
    rarity: "uncommon",
  },
  {
    name: "Access Control List",
    cost: "{2}{W}",
    type: "Enchantment",
    text: "Processes you control have async.",
    abilities: [
      { kind: "static", effect: { kind: "grant", filter: yours, keyword: "vigilance" } },
    ],
    rarity: "rare",
  },
  {
    name: "Signing Key",
    cost: "{2}",
    type: "Artifact",
    text: "Equipped process gets +1/+1 and has sandboxed.\nAttach {1}",
    attach: { kind: "equipment", equipCost: "{1}" },
    abilities: [
      { kind: "static", effect: { kind: "equippedBuff", power: 1, toughness: 1 } },
      { kind: "static", effect: { kind: "equippedGrant", keyword: "hexproof" } },
    ],
  },
]

/* ── ROOTKIT — disk and core: sacrifice, recursion, reach for the face ── */

const ROOTKIT: Spec[] = [
  {
    name: "Orphan Process",
    cost: "{B}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [2, 1],
    text: "When this process dies, you lose 1 life and draw a card.",
    abilities: [
      onDeath({ do: "loseLife", amount: 1, who: "you" }, { do: "draw", amount: 1, who: "you" }),
    ],
  },
  {
    name: "Zombie Thread",
    cost: "{1}{B}",
    type: "Creature",
    subtypes: ["Thread"],
    pt: [2, 2],
    keywords: ["menace"],
    text: "Redundant.",
  },
  {
    name: "Privilege Escalation",
    cost: "{2}{B}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [3, 2],
    keywords: ["flying"],
    text: "Kernel.\nWhen this process enters, each opponent loses 1 life.",
    abilities: [etb({ do: "loseLife", amount: 1, who: "opponent" })],
    rarity: "uncommon",
  },
  {
    name: "Buffer Overrun",
    cost: "{2}{R}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [4, 2],
    keywords: ["trample"],
    text: "Overflow.",
  },
  {
    name: "Rootkit",
    cost: "{3}{B}",
    type: "Creature",
    subtypes: ["Daemon"],
    pt: [3, 3],
    keywords: ["deathtouch"],
    text: "Fatal.\nWhenever this daemon attacks, each opponent loses 1 life.",
    abilities: [onAttack({ do: "loseLife", amount: 1, who: "opponent" })],
    rarity: "rare",
  },
  {
    name: "Crash Dump",
    cost: "{4}{B}",
    type: "Creature",
    subtypes: ["Process"],
    pt: [4, 4],
    text: "When this process enters, return a process card from your graveyard to the battlefield under your control.",
    abilities: [etb({ do: "reanimate", who: "you" })],
    rarity: "rare",
  },
  {
    name: "Reaper Daemon",
    cost: "{3}{R}",
    type: "Creature",
    subtypes: ["Daemon"],
    pt: [4, 3],
    keywords: ["haste", "lifelink"],
    text: "Preempt. Restore.",
    rarity: "rare",
  },
  {
    name: "Null Pointer",
    cost: "{B}",
    type: "Instant",
    text: "Destroy target process. You lose 1 life.",
    abilities: [spell({ do: "destroy", target }, { do: "loseLife", amount: 1, who: "you" })],
    rarity: "uncommon",
  },
  {
    name: "Trap Handler",
    cost: "{1}{B}",
    type: "Instant",
    text: "Target process gets -3/-3 until end of turn.",
    abilities: [
      spell({ do: "buff", power: -3, toughness: -3, target, until: "eot" }),
    ],
  },
  {
    name: "Stack Smash",
    cost: "{1}{R}",
    type: "Instant",
    text: "This interrupt deals 3 damage to any target.",
    abilities: [spell({ do: "damage", amount: 3, target: theirFace })],
  },
  {
    name: "Core Dump",
    cost: "{2}{B}",
    type: "Sorcery",
    text: "Return a process card from your graveyard to the battlefield under your control.",
    abilities: [spell({ do: "reanimate", who: "you" })],
    rarity: "uncommon",
  },
  {
    name: "Kill -9",
    cost: "{2}{B}",
    type: "Sorcery",
    text: "Destroy target process.",
    abilities: [spell({ do: "destroy", target })],
  },
  {
    name: "Reboot",
    cost: "{4}{B}",
    type: "Sorcery",
    text: "Destroy all processes.",
    abilities: [
      spell({ do: "destroy", target: { what: "creature", controller: "any", count: "all" } }),
    ],
    rarity: "rare",
  },
  {
    name: "Log Rotate",
    cost: "{1}{B}",
    type: "Sorcery",
    text: "Draw two cards. You lose 2 life.",
    abilities: [
      spell({ do: "draw", amount: 2, who: "you" }, { do: "loseLife", amount: 2, who: "you" }),
    ],
  },
  {
    name: "Escalate",
    cost: "{X}{B}",
    type: "Sorcery",
    text: "Create X 1/1 black Thread creature tokens with fatal.",
    abilities: [
      spell({
        do: "token",
        count: { count: "x" },
        token: thread("Thread", 1, 1, ["B"], ["deathtouch"]),
      }),
    ],
    rarity: "rare",
  },
  {
    name: "Cron Job",
    cost: "{2}{B}",
    type: "Enchantment",
    text: "At the beginning of your upkeep, draw a card and you lose 1 life.",
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
    rarity: "rare",
  },
  {
    name: "Watchdog Timer",
    cost: "{3}{R}",
    type: "Enchantment",
    text: "Whenever a process you control enters, this daemon deals 1 damage to your opponent.",
    abilities: [
      {
        kind: "triggered",
        on: { when: "enters", who: "other", filter: yours },
        effects: [{ do: "damage", amount: 1, target: theirFace }],
      },
    ],
    rarity: "rare",
  },
  {
    name: "Debugger",
    cost: "{2}",
    type: "Artifact",
    text: "Equipped process gets +2/+0 and has fatal.\nAttach {2}",
    attach: { kind: "equipment", equipCost: "{2}" },
    abilities: [
      { kind: "static", effect: { kind: "equippedBuff", power: 2, toughness: 0 } },
      { kind: "static", effect: { kind: "equippedGrant", keyword: "deathtouch" } },
    ],
    rarity: "uncommon",
  },
]

/* ── The set ──────────────────────────────────────────────────────────── */

const ALL_SPECS: Spec[] = [...VOLUMES, ...RUNAWAY, ...FIREWALL, ...ROOTKIT]

export const KERNEL_CARDS: Record<string, CardDef> = Object.fromEntries(
  ALL_SPECS.map((s) => [s.name, build(s)])
)

/** A decklist: how many of each card, and which volumes it runs. */
interface DeckSpec {
  id: string
  name: string
  blurb: string
  volumes: [string, number][]
  cards: [string, number][]
}

export const KERNEL_DECKS: DeckSpec[] = [
  {
    id: "runaway",
    name: "RUNAWAY",
    blurb: "processes that grow until the box falls over",
    volumes: [
      ["Heap Block", 9],
      ["Core Sector", 5],
      ["Shared Volume", 2],
    ],
    cards: [
      ["Init Thread", 2],
      ["Hot Loop", 2],
      ["Segfault Daemon", 2],
      ["Spawn Worker", 2],
      ["Memory Leak", 1],
      ["Scheduler", 1],
      ["Fork Bomb", 2],
      ["Kernel Panic", 1],
      ["Runaway Process", 1],
      ["Nice Value", 1],
      ["Raise Priority", 1],
      ["Kill Signal", 2],
      ["Allocate", 1],
      ["Spawn Pool", 1],
      ["Thermal Throttle", 1],
      ["Unbounded Recursion", 1],
      ["Overclock", 1],
      ["Heat Sink", 1],
    ],
  },
  {
    id: "firewall",
    name: "FIREWALL",
    blurb: "hold the port, read the traffic, win later",
    volumes: [
      ["UI Buffer", 7],
      ["Net Segment", 7],
      ["Shared Volume", 2],
    ],
    cards: [
      ["Watchdog", 2],
      ["Packet Sniffer", 2],
      ["Port Scanner", 2],
      ["Firewall Rule", 2],
      ["Load Balancer", 2],
      ["Supervisor", 1],
      ["Deep Packet Inspector", 2],
      ["Root Certificate", 1],
      ["Drop Packet", 1],
      ["Sandbox", 1],
      ["Rate Limit", 1],
      ["Halt", 1],
      ["Quarantine", 1],
      ["Poll", 1],
      ["Fork Pool", 1],
      ["Cache Warm", 1],
      ["Access Control List", 1],
      ["Signing Key", 1],
    ],
  },
  {
    id: "rootkit",
    name: "ROOTKIT",
    blurb: "own the box, and make it cost them uptime",
    volumes: [
      ["Cold Storage", 8],
      ["Core Sector", 6],
      ["Swap Partition", 2],
    ],
    cards: [
      ["Orphan Process", 2],
      ["Zombie Thread", 2],
      ["Privilege Escalation", 2],
      ["Buffer Overrun", 2],
      ["Rootkit", 1],
      ["Reaper Daemon", 1],
      ["Crash Dump", 1],
      ["Null Pointer", 1],
      ["Trap Handler", 1],
      ["Stack Smash", 2],
      ["Kill -9", 2],
      ["Core Dump", 1],
      ["Reboot", 1],
      ["Log Rotate", 1],
      ["Escalate", 1],
      ["Cron Job", 1],
      ["Watchdog Timer", 1],
      ["Debugger", 1],
    ],
  },
]

/** The full list for a deck, expanded to one entry per copy. */
export function kernelDeckList(id: string): string[] | undefined {
  const deck = KERNEL_DECKS.find((d) => d.id === id)
  if (!deck) return undefined
  const out: string[] = []
  for (const [name, n] of [...deck.volumes, ...deck.cards]) {
    for (let i = 0; i < n; i++) out.push(name)
  }
  return out
}

export const KERNEL_DECK_IDS = KERNEL_DECKS.map((d) => d.id)
