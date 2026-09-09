/**
 * Turning the baked Scryfall data into definitions the engine can play.
 *
 * Most of a card comes out of the data for nothing: power, toughness, the type
 * line, subtypes, keywords and which colours a land taps for are all printed
 * facts. That covers the body of all 227 cards without a line of hand-written
 * behaviour — every creature enters as its real self, every land makes its real
 * mana. Rules text on top of that is encoded by hand in `encoded/`.
 */

import raw from "../mtg-data.json"
import { encodedFor } from "./encoded"
import { KERNEL_CARDS, kernelDeckList } from "./sets/kernel"
import { autoEncode } from "./encoded/auto"
import {
  KEYWORDS,
  type Ability,
  type CardDef,
  type Colour,
  type Attachment,
  type Encoded,
  type Keyword,
  type ManaSymbol,
} from "./types"

interface RawCard {
  name: string
  cmc: number
  cost: string
  type: string
  fullType: string
  colors: string[]
  rarity: string
  set: string
  text: string
  power?: string | null
  toughness?: string | null
  loyalty?: string | null
  keywords?: string[]
  subtypes?: string[]
  produces?: string[]
}

interface RawDeck {
  id: string
  commander: string
  entries: { count: number; name: string }[]
}

const DATA = raw as unknown as {
  generated: string
  decks: RawDeck[]
  cards: Record<string, RawCard>
}

export const DECKS = DATA.decks

const SUPERTYPES = ["Legendary", "Basic", "Snow", "World"]
const CARD_TYPES = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Land",
  "Planeswalker",
  "Battle",
]

/**
 * Power and toughness as a number.
 *
 * A printed `*` is a characteristic-defining ability — its value comes from the
 * board, which this engine does not compute. It becomes 0, and the card is
 * marked as not fully encoded rather than quietly playing as a 0/0.
 */
function stat(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const hasStar = (c: RawCard): boolean =>
  c.power === "*" || c.toughness === "*" || (c.power ?? "").includes("*")

function parseKeywords(list: string[] | undefined): Keyword[] {
  const out: Keyword[] = []
  for (const k of list ?? []) {
    const lower = k.toLowerCase() as Keyword
    if (KEYWORDS.includes(lower)) out.push(lower)
  }
  return out
}

/** The mana a land or rock taps for, from Scryfall's produced_mana. */
function parseProduces(list: string[] | undefined): ManaSymbol[] {
  const out: ManaSymbol[] = []
  for (const m of list ?? []) {
    if (m === "W" || m === "U" || m === "B" || m === "R" || m === "G" || m === "C") {
      out.push(m)
    }
  }
  return out
}

function hasUnimplemented(a: Ability): boolean {
  const effects = "effects" in a ? a.effects : []
  return effects.some((e) => e.do === "unimplemented")
}

/**
 * Mana abilities every land and rock gets for free.
 *
 * Derived rather than encoded: `produced_mana` is a printed fact, so a land
 * that taps for two colours does so without anyone writing it down.
 */
function derivedManaAbilities(c: RawCard, types: string[]): Ability[] {
  const produces = parseProduces(c.produces)
  if (produces.length === 0) return []
  // A creature that taps for mana needs its ability encoded with the right
  // cost; only lands and artifacts get one for nothing.
  if (types.includes("Creature")) return []
  // One mana, of any colour the card is printed as making.
  return [{ kind: "mana", cost: { tap: true }, produces: [produces] }]
}

/**
 * Builds a definition: printed body, then behaviour.
 *
 * Behaviour comes from a hand-written entry where one exists, and from parsing
 * the oracle text where it does not. A hand entry wins outright rather than
 * merging — the reason a card is written by hand is that the parser got it
 * wrong or could not see it, so letting the parser add to it would put the
 * mistake back.
 */
function build(c: RawCard): CardDef {
  const front = c.fullType.split(" — ")[0]
  const supertypes = SUPERTYPES.filter((t) => front.includes(t))
  const types = CARD_TYPES.filter((t) => front.includes(t))
  const keywords = parseKeywords(c.keywords)
  const permanent = types.some((t) =>
    ["Creature", "Artifact", "Enchantment", "Land", "Planeswalker"].includes(t)
  )

  const derived = derivedManaAbilities(c, types)
  const hand = encodedFor(c.name)

  let abilities: Ability[]
  let encoded: Encoded
  let entersTapped = false
  let attach: Attachment | undefined

  if (hand) {
    /* A hand-written mana ability replaces the derived one rather than sitting
       behind it. Sol Ring's produced_mana is ["C"], which derives as one mana;
       the entry that knows it makes two has to be the one that is used. */
    const handMakesMana = hand.abilities.some((a) => a.kind === "mana")
    abilities = [...(handMakesMana ? [] : derived), ...hand.abilities]
    encoded = abilities.some(hasUnimplemented) ? "partial" : "full"
    attach = hand.attach
  } else {
    const auto = autoEncode(c.text ?? "", c.name, permanent, keywords)
    abilities = [...derived, ...auto.abilities]
    entersTapped = auto.entersTapped
    if ((c.text ?? "").trim() === "") encoded = "vanilla"
    else if (auto.leftover.length === 0) encoded = "full"
    else if (auto.abilities.length > 0) encoded = "partial"
    else encoded = "body"

    // A land whose only text is making mana is covered by `produces`.
    if (encoded === "body" && types.includes("Land") && parseProduces(c.produces).length > 0) {
      const onlyMana = auto.leftover.every((l) => /^(\{T\}: )?Add /i.test(l))
      if (onlyMana) encoded = "full"
    }
  }

  return {
    name: c.name,
    cost: c.cost ?? "",
    cmc: c.cmc ?? 0,
    types,
    subtypes: c.subtypes ?? [],
    supertypes,
    colours: (c.colors ?? []).filter((x): x is Colour =>
      ["W", "U", "B", "R", "G"].includes(x)
    ),
    power: stat(c.power),
    toughness: stat(c.toughness),
    text: c.text ?? "",
    keywords,
    produces: parseProduces(c.produces),
    abilities,
    entersTapped,
    attach,
    // A printed `*` means the value comes from the board, which is not computed.
    encoded: hasStar(c) ? "partial" : encoded,
    rarity: c.rarity ?? "common",
    set: c.set ?? "",
  }
}

const CACHE = new Map<string, CardDef>()

/**
 * A card by name, from whichever set it belongs to.
 *
 * The engine does not care where a definition came from, which is the whole
 * reason a set of our own was cheap to add: the rules, the stack and combat are
 * the expensive part and they are already written.
 */
export function cardDef(name: string): CardDef | undefined {
  const ours = KERNEL_CARDS[name]
  if (ours) return ours
  const cached = CACHE.get(name)
  if (cached) return cached
  const rawCard = DATA.cards[name]
  if (!rawCard) return undefined
  const def = build(rawCard)
  CACHE.set(name, def)
  return def
}

export const ALL_CARD_NAMES = Object.keys(DATA.cards)

/** Every definition, built. Used by the coverage report and by tests. */
export function allDefs(): CardDef[] {
  return ALL_CARD_NAMES.map((n) => cardDef(n)!).filter(Boolean)
}

/**
 * A deck by id, from either set.
 *
 * Our own decks have no commander, so the first card of the list stands in for
 * one: the command zone simply stays empty, since nothing puts a card there.
 */
export function deckList(deckId: string): { commander: string; cards: string[] } | undefined {
  const ours = kernelDeckList(deckId)
  if (ours) return { commander: "", cards: ours }
  const deck = DECKS.find((d) => d.id === deckId)
  if (!deck) return undefined
  const cards: string[] = []
  for (const e of deck.entries) {
    for (let i = 0; i < e.count; i++) cards.push(e.name)
  }
  return { commander: deck.commander, cards }
}

export const isCreature = (d: CardDef): boolean => d.types.includes("Creature")
export const isLand = (d: CardDef): boolean => d.types.includes("Land")
export const isPermanent = (d: CardDef): boolean =>
  d.types.some((t) => ["Creature", "Artifact", "Enchantment", "Land", "Planeswalker"].includes(t))
/** Instants, and anything else that may be cast outside your main phase. */
export const isInstantSpeed = (d: CardDef): boolean =>
  d.types.includes("Instant") || d.keywords.includes("flash")
