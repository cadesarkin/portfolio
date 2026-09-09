/**
 * What a permanent's characteristics actually are right now.
 *
 * A creature's power is not what is printed on it: it is the printed value plus
 * counters, plus every static buff on the battlefield that applies to it, plus
 * anything granted until end of turn. Nothing else in the engine should ever
 * read `def.power` directly — combat, state-based actions and the UI all come
 * through here, so they cannot disagree about how big something is.
 *
 * This is a deliberately flat model. Real Magic applies continuous effects in
 * seven numbered layers with timestamps and dependency ordering; the cards in
 * these decks do not need that, and a layer system nothing exercises would be
 * elaborate code with no test that could fail.
 */

import { battlefield } from "./state"
import type { Filter, GameCard, GameState, Keyword } from "./types"

/** Whether a permanent matches a filter, from the point of view of `source`. */
export function matches(card: GameCard, filter: Filter, source?: GameCard): boolean {
  if (filter.excludeSelf && source && card.id === source.id) return false
  if (filter.types && !filter.types.some((t) => card.def.types.includes(t))) return false
  if (filter.subtypes) {
    const subs = [...card.def.subtypes, ...card.addedSubtypes]
    if (!filter.subtypes.some((s) => subs.includes(s))) return false
  }
  if (filter.colours && !filter.colours.some((c) => card.def.colours.includes(c))) return false
  if (filter.controller && filter.controller !== "any" && source) {
    const wantSame = filter.controller === "you"
    const same = card.controller === source.controller
    if (wantSame !== same) return false
  }
  return true
}

interface Modifiers {
  power: number
  toughness: number
  keywords: Keyword[]
}

/** Every static effect on the battlefield that applies to this permanent. */
function staticModifiers(state: GameState, card: GameCard): Modifiers {
  const mod: Modifiers = { power: 0, toughness: 0, keywords: [] }
  for (const source of battlefield(state)) {
    for (const ability of source.def.abilities) {
      if (ability.kind !== "static") continue
      const effect = ability.effect

      // Equipment and Auras act only on what they are attached to.
      if (effect.kind === "equippedBuff" || effect.kind === "equippedGrant") {
        if (source.attachedTo !== card.id) continue
        if (effect.kind === "equippedBuff") {
          mod.power += effect.power
          mod.toughness += effect.toughness
        } else if (!mod.keywords.includes(effect.keyword)) {
          mod.keywords.push(effect.keyword)
        }
        continue
      }

      if (!matches(card, effect.filter, source)) continue
      if (effect.kind === "buff") {
        mod.power += effect.power
        mod.toughness += effect.toughness
      } else if (effect.kind === "grant" && !mod.keywords.includes(effect.keyword)) {
        mod.keywords.push(effect.keyword)
      }
    }
  }
  return mod
}

/**
 * Whether `card` may be chosen as a target by `byController`.
 *
 * Hexproof is the reason the protection spells in these decks exist; without
 * this it was a word printed on a card that changed nothing.
 */
export function canTarget(state: GameState, card: GameCard, byController: 0 | 1): boolean {
  if (card.zone !== "battlefield") return false
  if (card.controller === byController) return true
  return !hasKeyword(state, card, "hexproof")
}

/** Everything currently attached to a permanent. */
export const attachmentsOf = (state: GameState, card: GameCard): GameCard[] =>
  battlefield(state).filter((c) => c.attachedTo === card.id)

/** Counters that do more than sit there. */
const COUNTER_KEYWORDS: Record<string, Keyword> = {
  trample: "trample",
  flying: "flying",
  vigilance: "vigilance",
  lifelink: "lifelink",
  deathtouch: "deathtouch",
  menace: "menace",
  indestructible: "indestructible",
  "first strike": "first strike",
}

export function powerOf(state: GameState, card: GameCard): number {
  const base = card.def.power ?? 0
  const plus = card.counters["+1/+1"] ?? 0
  const minus = card.counters["-1/-1"] ?? 0
  return base + plus - minus + card.untilEot.power + staticModifiers(state, card).power
}

export function toughnessOf(state: GameState, card: GameCard): number {
  const base = card.def.toughness ?? 0
  const plus = card.counters["+1/+1"] ?? 0
  const minus = card.counters["-1/-1"] ?? 0
  return base + plus - minus + card.untilEot.toughness + staticModifiers(state, card).toughness
}

/** Every keyword the permanent has: printed, granted, or from a counter. */
export function keywordsOf(state: GameState, card: GameCard): Keyword[] {
  const out = new Set<Keyword>(card.def.keywords)
  for (const k of card.untilEot.keywords) out.add(k)
  for (const k of staticModifiers(state, card).keywords) out.add(k)
  for (const [name, count] of Object.entries(card.counters)) {
    const kw = COUNTER_KEYWORDS[name]
    if (kw && count > 0) out.add(kw)
  }
  return [...out]
}

export const hasKeyword = (state: GameState, card: GameCard, kw: Keyword): boolean =>
  keywordsOf(state, card).includes(kw)

/** Subtypes including any gained in play. */
export const subtypesOf = (card: GameCard): string[] => [
  ...card.def.subtypes,
  ...card.addedSubtypes,
]
