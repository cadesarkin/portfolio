/**
 * What the engine's concepts are called on screen.
 *
 * The engine's colours are WUBRG and its keywords are `flying` and `trample`,
 * because that is what combat and the stack were written against and renaming
 * them would mean touching every rule. So the theming lives here, at the edge:
 * the same `flying` that the blocking rules check reads as "kernel" on a card.
 *
 * The real Commander decks are shown with their printed names; only cards from
 * our own set are themed, because Wrath of God is not a script.
 */

import { KEYWORDS, type Colour, type Keyword } from "./types"

export type Flavour = "mtg" | "kernel"

const KERNEL_TYPES: Record<string, string> = {
  Creature: "process",
  Instant: "interrupt",
  Sorcery: "script",
  Enchantment: "daemon",
  Artifact: "module",
  Land: "volume",
}

const KERNEL_KEYWORDS: Record<Keyword, string> = {
  flying: "kernel",
  reach: "firewall",
  trample: "overflow",
  deathtouch: "fatal",
  lifelink: "restore",
  vigilance: "async",
  haste: "preempt",
  "first strike": "realtime",
  "double strike": "pipelined",
  menace: "redundant",
  defender: "blocking",
  hexproof: "sandboxed",
  indestructible: "immutable",
  flash: "hotpatch",
}

const KERNEL_COLOURS: Record<Colour, string> = {
  W: "ui",
  U: "net",
  B: "disk",
  R: "core",
  G: "heap",
}

export const typeName = (type: string, flavour: Flavour): string =>
  flavour === "kernel" ? (KERNEL_TYPES[type] ?? type.toLowerCase()) : type

export const keywordName = (kw: Keyword, flavour: Flavour): string =>
  flavour === "kernel" ? KERNEL_KEYWORDS[kw] : kw

export const colourName = (c: Colour, flavour: Flavour): string =>
  flavour === "kernel" ? KERNEL_COLOURS[c] : c

/** What a player's life total is called. */
export const lifeName = (flavour: Flavour): string =>
  flavour === "kernel" ? "uptime" : "life"

export const typeLine = (types: string[], flavour: Flavour): string =>
  types.map((t) => typeName(t, flavour)).join(" ")

/**
 * What each keyword actually does in this engine.
 *
 * Written from the rules as implemented, not from Magic in general: "fatal"
 * says any damage is lethal because that is what the state-based action checks,
 * and "sandboxed" says your opponent cannot target it because that is exactly
 * the restriction `canTarget` applies.
 */
const HELP: Record<Keyword, string> = {
  flying: "Can only be blocked by creatures with kernel or firewall.",
  reach: "Can block creatures with kernel.",
  trample: "Damage past what the blockers can absorb hits the defending player.",
  deathtouch: "Any damage it deals is lethal, however small.",
  lifelink: "Damage it deals also gains its controller that much.",
  vigilance: "Does not tap when it attacks, so it can still block.",
  haste: "Can attack the turn it arrives.",
  "first strike": "Deals its combat damage before creatures without it.",
  "double strike": "Deals combat damage in both passes, first and regular.",
  menace: "Cannot be blocked by fewer than two creatures.",
  defender: "Cannot attack.",
  hexproof: "Your opponent cannot choose it as a target.",
  indestructible: "Damage and destroy effects do not kill it.",
  flash: "Can be cast outside your own main phase.",
}

export const keywordHelp = (kw: Keyword): string => HELP[kw]

/** Every keyword, with its themed name and what it does. Used by the table's reference panel. */
export const keywordGlossary = (
  flavour: Flavour
): { name: string; engine: Keyword; help: string }[] =>
  KEYWORDS.map((k) => ({ name: keywordName(k, flavour), engine: k, help: HELP[k] }))
