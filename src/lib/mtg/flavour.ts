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

import type { Colour, Keyword } from "./types"

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
