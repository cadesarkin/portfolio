/**
 * Building a game and moving cards between zones.
 *
 * Every mutation returns through here so that zone membership and the card's
 * own `zone` field can never disagree — a card in two zones at once is the
 * classic way a card game engine starts telling quiet lies.
 */

import { cardDef, deckList } from "./cards"
import { emptyPool } from "./mana"
import type {
  CardDef,
  GameCard,
  GameState,
  Player,
  PlayerId,
  Zone,
} from "./types"

export const STARTING_LIFE = 40
export const OPENING_HAND = 7
/** Commander damage that kills, per the format. */
export const LETHAL_COMMANDER_DAMAGE = 21

/** A small deterministic generator, so a game can be replayed exactly. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function newCard(id: number, def: CardDef, owner: PlayerId, zone: Zone): GameCard {
  return {
    id,
    def,
    owner,
    controller: owner,
    zone,
    tapped: false,
    sick: true,
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
}

function emptyPlayer(id: PlayerId, name: string, deckId: string): Player {
  return {
    id,
    name,
    life: STARTING_LIFE,
    library: [],
    hand: [],
    battlefield: [],
    graveyard: [],
    exile: [],
    command: [],
    pool: emptyPool(),
    landPlayed: false,
    commanderDamage: 0,
    deckId,
  }
}

export interface NewGameOptions {
  seed?: number
  /** Skip the opening draw, for tests that want an empty hand. */
  skipOpeningHand?: boolean
}

/**
 * Sets up a duel between two decks.
 *
 * The commander starts in the command zone and the other ninety-nine are
 * shuffled, as the format says. A card whose data is missing is dropped rather
 * than becoming an undefined in a library nobody can debug later.
 */
export function createGame(
  deckA: string,
  deckB: string,
  names: [string, string] = ["you", "opponent"],
  options: NewGameOptions = {}
): GameState {
  const seed = options.seed ?? 12345
  const random = rng(seed)

  const state: GameState = {
    cards: {},
    players: [emptyPlayer(0, names[0], deckA), emptyPlayer(1, names[1], deckB)],
    active: 0,
    priority: 0,
    phase: "main1",
    turn: 1,
    stack: [],
    winner: null,
    log: [],
    nextId: 1,
    seed,
  }

  const load = (deckId: string, owner: PlayerId) => {
    const list = deckList(deckId)
    if (!list) return
    const player = state.players[owner]

    const commanderDef = cardDef(list.commander)
    if (commanderDef) {
      const card = newCard(state.nextId++, commanderDef, owner, "command")
      state.cards[card.id] = card
      player.command.push(card.id)
    }

    const ids: number[] = []
    for (const name of list.cards) {
      const def = cardDef(name)
      if (!def) continue
      const card = newCard(state.nextId++, def, owner, "library")
      state.cards[card.id] = card
      ids.push(card.id)
    }
    player.library = shuffle(ids, random)
  }

  load(deckA, 0)
  load(deckB, 1)

  if (!options.skipOpeningHand) {
    for (const p of state.players) {
      for (let i = 0; i < OPENING_HAND; i++) drawCard(state, p.id)
    }
  }

  state.log = []
  log(state, `${state.players[0].name} versus ${state.players[1].name}`)
  return state
}

/** The list a zone is kept in, for a given player. */
function zoneList(player: Player, zone: Zone): number[] | null {
  switch (zone) {
    case "library":
      return player.library
    case "hand":
      return player.hand
    case "battlefield":
      return player.battlefield
    case "graveyard":
      return player.graveyard
    case "exile":
      return player.exile
    case "command":
      return player.command
    default:
      return null
  }
}

/**
 * Moves a card to a zone, keeping the card and the zone lists in step.
 *
 * A token that leaves the battlefield ceases to exist rather than piling up in
 * a graveyard where it could be returned.
 */
export function moveCard(state: GameState, cardId: number, to: Zone): void {
  const card = state.cards[cardId]
  if (!card) return

  const ownerSide = state.players[card.owner]
  const controllerSide = state.players[card.controller]
  for (const p of [ownerSide, controllerSide]) {
    for (const zone of ["library", "hand", "battlefield", "graveyard", "exile", "command"] as Zone[]) {
      const list = zoneList(p, zone)
      if (!list) continue
      const i = list.indexOf(cardId)
      if (i >= 0) list.splice(i, 1)
    }
  }

  if (card.token && to !== "battlefield") {
    card.zone = "exile"
    delete state.cards[cardId]
    return
  }

  // Leaving the battlefield wipes everything that was true only in play.
  if (to !== "battlefield") {
    card.tapped = false
    card.damage = 0
    card.deathtouched = false
    card.counters = {}
    card.untilEot = { power: 0, toughness: 0, keywords: [] }
    card.addedSubtypes = []
    card.attacking = false
    card.blocking = null
    card.controller = card.owner
  }

  card.zone = to
  const list = zoneList(state.players[card.controller], to)
  if (list) list.push(cardId)
}

export function drawCard(state: GameState, playerId: PlayerId): number | null {
  const player = state.players[playerId]
  const id = player.library.shift()
  if (id === undefined) {
    // Drawing from an empty library loses the game, when it is next checked.
    log(state, `${player.name} cannot draw`)
    return null
  }
  const card = state.cards[id]
  card.zone = "hand"
  player.hand.push(id)
  return id
}

export function log(state: GameState, text: string, unimplemented = false): void {
  state.log.push({ turn: state.turn, text, unimplemented })
  // The log is for the player, not an audit trail; old turns are not useful.
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400)
}

export const opponentOf = (id: PlayerId): PlayerId => (id === 0 ? 1 : 0)

/**
 * A player and a verb, agreeing.
 *
 * The human player is called "you", which is second person, so every log line
 * built as `${name} ${verb}s` came out as "you takes 6" and "you plays Forest".
 */
export const subject = (name: string, verb: string): string =>
  name === "you" ? `you ${verb}` : `${name} ${verb}s`

export const cardsIn = (state: GameState, ids: number[]): GameCard[] =>
  ids.map((id) => state.cards[id]).filter(Boolean)

export const battlefield = (state: GameState, playerId?: PlayerId): GameCard[] => {
  if (playerId === undefined) {
    return [...cardsIn(state, state.players[0].battlefield), ...cardsIn(state, state.players[1].battlefield)]
  }
  return cardsIn(state, state.players[playerId].battlefield)
}

/** Deep enough copy that engine functions can be written as mutations. */
export function cloneState(state: GameState): GameState {
  return {
    ...state,
    cards: Object.fromEntries(
      Object.entries(state.cards).map(([id, c]) => [
        id,
        { ...c, counters: { ...c.counters }, untilEot: { ...c.untilEot, keywords: [...c.untilEot.keywords] }, addedSubtypes: [...c.addedSubtypes] },
      ])
    ),
    players: [
      {
        ...state.players[0],
        library: [...state.players[0].library],
        hand: [...state.players[0].hand],
        battlefield: [...state.players[0].battlefield],
        graveyard: [...state.players[0].graveyard],
        exile: [...state.players[0].exile],
        command: [...state.players[0].command],
        pool: { ...state.players[0].pool },
      },
      {
        ...state.players[1],
        library: [...state.players[1].library],
        hand: [...state.players[1].hand],
        battlefield: [...state.players[1].battlefield],
        graveyard: [...state.players[1].graveyard],
        exile: [...state.players[1].exile],
        command: [...state.players[1].command],
        pool: { ...state.players[1].pool },
      },
    ],
    stack: state.stack.map((s) => ({ ...s, targets: [...s.targets], effects: [...s.effects] })),
    log: [...state.log],
  }
}
