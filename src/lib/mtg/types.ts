/**
 * The shape of a game of Magic.
 *
 * Everything here is plain data. The engine is a set of pure functions over a
 * GameState, so a game can be set up, driven and asserted on in a test without
 * a canvas, a component or a clock.
 */

export type PlayerId = 0 | 1

export type Colour = "W" | "U" | "B" | "R" | "G"
export type ManaSymbol = Colour | "C"

/** A mana pool, plus generic which any colour can pay. */
export type Pool = Record<ManaSymbol, number>

export const COLOURS: Colour[] = ["W", "U", "B", "R", "G"]

export type Zone =
  | "library"
  | "hand"
  | "battlefield"
  | "graveyard"
  | "exile"
  | "stack"
  | "command"

export type Phase =
  | "untap"
  | "upkeep"
  | "draw"
  | "main1"
  | "beginCombat"
  | "declareAttackers"
  | "declareBlockers"
  | "combatDamage"
  | "endCombat"
  | "main2"
  | "end"
  | "cleanup"

/** The phases in the order a turn runs through them. */
export const PHASES: Phase[] = [
  "untap",
  "upkeep",
  "draw",
  "main1",
  "beginCombat",
  "declareAttackers",
  "declareBlockers",
  "combatDamage",
  "endCombat",
  "main2",
  "end",
  "cleanup",
]

/** Phases where a sorcery-speed spell may be cast, given an empty stack. */
export const MAIN_PHASES: Phase[] = ["main1", "main2"]

export type Keyword =
  | "flying"
  | "trample"
  | "vigilance"
  | "haste"
  | "deathtouch"
  | "lifelink"
  | "first strike"
  | "double strike"
  | "menace"
  | "reach"
  | "defender"
  | "hexproof"
  | "indestructible"
  | "flash"

export const KEYWORDS: Keyword[] = [
  "flying",
  "trample",
  "vigilance",
  "haste",
  "deathtouch",
  "lifelink",
  "first strike",
  "double strike",
  "menace",
  "reach",
  "defender",
  "hexproof",
  "indestructible",
  "flash",
]

/* ── Card definitions ─────────────────────────────────────────────────── */

/**
 * A card as printed: the immutable definition, shared by every copy.
 *
 * `abilities` is what the engine can actually run. `encoded` says whether that
 * covers all of the card's rules text — a card is never withheld for being
 * hard, but the UI has to be able to tell the player which text is live.
 */
export interface CardDef {
  name: string
  cost: string
  cmc: number
  types: string[]
  subtypes: string[]
  supertypes: string[]
  colours: Colour[]
  power: number | null
  toughness: number | null
  text: string
  keywords: Keyword[]
  /** Mana this card can tap for, when it is a land or a mana rock. */
  produces: ManaSymbol[]
  abilities: Ability[]
  /** Arrives on the battlefield tapped. */
  entersTapped: boolean
  encoded: Encoded
  rarity: string
  set: string
}

/** How much of a card's rules text the engine runs. */
export type Encoded =
  /** Nothing left over: what you see is what happens. */
  | "full"
  /** Some text runs, some does not. */
  | "partial"
  /** The body and keywords only; its written abilities do nothing. */
  | "body"
  /** It has no rules text to encode. */
  | "vanilla"

/* ── Abilities ────────────────────────────────────────────────────────── */

export type Ability =
  | { kind: "spell"; effects: Effect[] }
  | { kind: "static"; effect: StaticEffect }
  | { kind: "triggered"; on: TriggerEvent; effects: Effect[]; optional?: boolean }
  | { kind: "activated"; cost: ActivationCost; effects: Effect[] }
  | { kind: "mana"; cost: ActivationCost; produces: ManaSymbol[] }

export interface ActivationCost {
  mana?: string
  tap?: boolean
  sacrificeSelf?: boolean
  life?: number
}

/** When a triggered ability fires. */
export type TriggerEvent =
  | { when: "enters"; who: "self" }
  | { when: "enters"; who: "other"; filter: Filter }
  | { when: "dies"; who: "self" }
  | { when: "attacks"; who: "self" }
  | { when: "attacks"; who: "other"; filter: Filter }
  | { when: "upkeep"; controller: "you" }
  | { when: "endStep"; controller: "you" }
  | { when: "beginCombat"; controller: "you" }
  | { when: "castSpell"; filter: Filter }
  | { when: "landfall" }
  | { when: "dealsCombatDamage"; who: "self" }

/* ── Effects ──────────────────────────────────────────────────────────── */

/** A number that may depend on the board rather than being fixed. */
export type Amount =
  | number
  | { count: "creatures"; filter: Filter }
  | { count: "cardsInHand"; who: PlayerSpec }
  | { count: "x" }

export type PlayerSpec = "you" | "opponent" | "each"

export type Effect =
  | { do: "damage"; amount: Amount; target: TargetSpec }
  | { do: "draw"; amount: Amount; who: PlayerSpec }
  | { do: "gainLife"; amount: Amount; who: PlayerSpec }
  | { do: "loseLife"; amount: Amount; who: PlayerSpec }
  | { do: "token"; count: Amount; token: TokenSpec }
  | { do: "counters"; counter: string; amount: Amount; target: TargetSpec }
  | { do: "destroy"; target: TargetSpec }
  | { do: "exile"; target: TargetSpec }
  | { do: "bounce"; target: TargetSpec }
  | { do: "tap"; target: TargetSpec }
  | { do: "untap"; target: TargetSpec }
  | { do: "buff"; power: number; toughness: number; target: TargetSpec; until: "eot" }
  | { do: "grant"; keyword: Keyword; target: TargetSpec; until: "eot" }
  | { do: "mill"; amount: Amount; who: PlayerSpec }
  | { do: "sacrifice"; target: TargetSpec }
  | { do: "returnFromGraveyard"; target: TargetSpec }
  /** A creature card in a graveyard comes back onto the battlefield. */
  | { do: "reanimate"; who: PlayerSpec }
  /** Search the library for a card matching the filter and take it to hand. */
  | { do: "tutor"; filter: Filter; to: "hand" | "battlefield" }
  /** Text the engine does not run. Present so the card can say so. */
  | { do: "unimplemented"; note: string }

export interface TokenSpec {
  name: string
  power: number
  toughness: number
  types: string[]
  subtypes: string[]
  colours: Colour[]
  keywords: Keyword[]
}

/** Which objects an effect applies to. */
export interface TargetSpec {
  what: "creature" | "permanent" | "player" | "self" | "artifact" | "enchantment" | "land"
  /** Who may control it. */
  controller?: "you" | "opponent" | "any"
  /** How many to choose. "all" applies to every match with no choosing. */
  count?: number | "all"
  filter?: Filter
  /** A target the player chooses, versus one the effect picks itself. */
  chosen?: boolean
}

/** A predicate over permanents, used by static effects and triggers. */
export interface Filter {
  types?: string[]
  subtypes?: string[]
  colours?: Colour[]
  controller?: "you" | "opponent" | "any"
  /** Excludes the permanent the ability is on. */
  excludeSelf?: boolean
}

export type StaticEffect =
  | { kind: "buff"; filter: Filter; power: number; toughness: number }
  | { kind: "grant"; filter: Filter; keyword: Keyword }

/* ── Objects in play ──────────────────────────────────────────────────── */

/** A card in a game, wherever it currently is. */
export interface GameCard {
  /** Unique for the game, so effects can refer to one specific copy. */
  id: number
  def: CardDef
  owner: PlayerId
  controller: PlayerId
  zone: Zone
  /** Set while on the battlefield. */
  tapped: boolean
  /** Cannot attack or tap the turn it arrives, without haste. */
  sick: boolean
  damage: number
  /** Damaged by a deathtouch source this turn: any amount of it is lethal. */
  deathtouched: boolean
  counters: Record<string, number>
  /** Buffs and granted keywords that fall off at end of turn. */
  untilEot: { power: number; toughness: number; keywords: Keyword[] }
  /** Extra types gained in play, as Beorn hands out Bear. */
  addedSubtypes: string[]
  attacking: boolean
  blocking: number | null
  /** True for a token, which ceases to exist when it leaves the battlefield. */
  token: boolean
  /** Commander cast count, for the tax. */
  castCount: number
}

export interface Player {
  id: PlayerId
  name: string
  life: number
  library: number[]
  hand: number[]
  battlefield: number[]
  graveyard: number[]
  exile: number[]
  command: number[]
  pool: Pool
  landPlayed: boolean
  /** Commander damage taken from each opponent's commander. */
  commanderDamage: number
  deckId: string
}

/** An object on the stack: a spell being cast or an ability that triggered. */
export interface StackItem {
  id: number
  kind: "spell" | "triggered" | "activated"
  source: number
  controller: PlayerId
  effects: Effect[]
  /** Chosen targets, by card id or player id. */
  targets: TargetRef[]
  description: string
}

export type TargetRef =
  | { kind: "card"; id: number }
  | { kind: "player"; id: PlayerId }

export interface GameState {
  cards: Record<number, GameCard>
  players: [Player, Player]
  active: PlayerId
  priority: PlayerId
  phase: Phase
  turn: number
  stack: StackItem[]
  /** Set once someone has won. */
  winner: PlayerId | null
  /** A running account of what happened, newest last. */
  log: LogEntry[]
  nextId: number
  /** Seeded so a game can be replayed exactly. */
  seed: number
}

export interface LogEntry {
  turn: number
  text: string
  /** Marks text a card was supposed to do but the engine does not run. */
  unimplemented?: boolean
}
