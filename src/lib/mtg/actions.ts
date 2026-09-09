/**
 * The things a player can do: play a land, tap for mana, cast a spell.
 *
 * Every action is checked before it is taken and returns a reason when it is
 * refused, so the UI can grey a card out and say why, and the AI can ask
 * "could I?" without having to model the rules a second time.
 */

import { isInstantSpeed, isPermanent } from "./cards"
import { addMana, canPay, costTotal, parseCost, payFrom, type Cost } from "./mana"
import { battlefield, log, moveCard, subject } from "./state"
import { checkTriggers, pushStack, stateBasedActions } from "./stack"
import type {
  GameCard,
  GameState,
  ManaOption,
  ManaSymbol,
  Pool,
  PlayerId,
  TargetRef,
} from "./types"
import { MAIN_PHASES } from "./types"

export type Refusal = string | null

/** Total mana available: what is floating, plus untapped sources. */
export function availableMana(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId]
  const floating =
    player.pool.W + player.pool.U + player.pool.B + player.pool.R + player.pool.G + player.pool.C
  const sources = battlefield(state, playerId).filter((c) => manaAbilityOf(c) !== null && !c.tapped)
  return floating + sources.reduce((n, c) => n + Math.max(0, netManaOf(c)), 0)
}

/** The mana ability a permanent can use right now, if any. */
export function manaAbilityOf(card: GameCard): { produces: ManaOption[]; cost: string } | null {
  for (const ability of card.def.abilities) {
    if (ability.kind !== "mana") continue
    // A creature that taps for mana is still subject to summoning sickness.
    if (ability.cost.tap && card.def.types.includes("Creature") && card.sick) continue
    return { produces: ability.produces, cost: ability.cost.mana ?? "" }
  }
  return null
}

/**
 * What a source adds to the pool, after paying for itself.
 *
 * The count is how many mana it makes — one entry per mana — not how many
 * colours it could make. A Command Tower lists five colours and taps for one; a
 * Signet costs {1} and makes two, so it is worth one.
 */
export function netManaOf(card: GameCard): number {
  const ability = manaAbilityOf(card)
  if (!ability) return 0
  return ability.produces.length - costTotal(parseCost(ability.cost))
}

/**
 * The coloured mana a cost still needs, given what is already floating.
 *
 * Used to choose which colour to take from a source that offers a choice, so a
 * dual land is taken as the colour the spell actually needs.
 */
export function shortfall(pool: Pool, cost: Cost): ManaSymbol[] {
  const have: Record<string, number> = { ...pool }
  const need: ManaSymbol[] = []
  for (const pip of cost.pips) {
    if ((have[pip] ?? 0) > 0) have[pip] -= 1
    else need.push(pip)
  }
  return need
}

export function canTapForMana(state: GameState, cardId: number): Refusal {
  const card = state.cards[cardId]
  if (!card) return "no such card"
  if (card.zone !== "battlefield") return "not on the battlefield"
  if (card.tapped) return "already tapped"
  const ability = manaAbilityOf(card)
  if (!ability) return "makes no mana"
  if (ability.cost !== "") {
    const pool = state.players[card.controller].pool
    if (!canPay(pool, parseCost(ability.cost))) return "cannot pay its cost"
  }
  return null
}

/**
 * Taps a source for mana.
 *
 * `want` lists the colours that would be useful; each mana produced is taken as
 * the first wanted colour it can be, and otherwise as the first it offers.
 */
export function tapForMana(
  state: GameState,
  cardId: number,
  want: ManaSymbol[] = []
): boolean {
  if (canTapForMana(state, cardId) !== null) return false
  const card = state.cards[cardId]
  const ability = manaAbilityOf(card)!
  const player = state.players[card.controller]

  // Pay the ability's own cost first, if it has one.
  if (ability.cost !== "") {
    const paid = payFrom(player.pool, parseCost(ability.cost))
    if (paid === null) return false
    player.pool = paid
  }

  const wanted = [...want]
  const taken: ManaSymbol[] = []
  for (const option of ability.produces) {
    const i = wanted.findIndex((w) => option.includes(w))
    if (i >= 0) {
      taken.push(wanted[i])
      wanted.splice(i, 1)
    } else {
      taken.push(option[0])
    }
  }

  card.tapped = true
  player.pool = addMana(player.pool, taken)
  return true
}

/**
 * Taps whatever is needed to pay a cost.
 *
 * Sources that make exactly one colour are spent before ones that make any
 * colour, so a Birds of Paradise is not wasted paying a generic pip while a
 * coloured pip still needs it.
 */
export function autoTapFor(state: GameState, playerId: PlayerId, cost: string, extra = 0): boolean {
  const parsed = parseCost(cost)
  const player = state.players[playerId]
  if (canPay(player.pool, parsed, extra)) return true

  // Free sources first: a Signet cannot be used until there is mana to pay it.
  const sources = battlefield(state, playerId)
    .filter((c) => !c.tapped && manaAbilityOf(c) !== null)
    .sort((a, b) => {
      const costDiff = parseCost(manaAbilityOf(a)!.cost).generic - parseCost(manaAbilityOf(b)!.cost).generic
      if (costDiff !== 0) return costDiff
      return manaAbilityOf(a)!.produces.length - manaAbilityOf(b)!.produces.length
    })

  for (const source of sources) {
    // Take each source as whatever colour the cost still needs.
    tapForMana(state, source.id, shortfall(state.players[playerId].pool, parsed))
    if (canPay(state.players[playerId].pool, parsed, extra)) return true
  }
  return canPay(state.players[playerId].pool, parsed, extra)
}

export function canPlayLand(state: GameState, cardId: number): Refusal {
  const card = state.cards[cardId]
  if (!card) return "no such card"
  const player = state.players[card.controller]
  if (state.winner !== null) return "the game is over"
  if (card.zone !== "hand") return "not in hand"
  if (!card.def.types.includes("Land")) return "not a land"
  if (state.active !== card.controller) return "not your turn"
  if (!MAIN_PHASES.includes(state.phase)) return "only in a main phase"
  if (state.stack.length > 0) return "the stack is not empty"
  if (player.landPlayed) return "one land a turn"
  return null
}

export function playLand(state: GameState, cardId: number): boolean {
  if (canPlayLand(state, cardId) !== null) return false
  const card = state.cards[cardId]
  moveCard(state, cardId, "battlefield")
  card.sick = true
  card.tapped = card.def.entersTapped
  state.players[card.controller].landPlayed = true
  log(state, `${subject(state.players[card.controller].name, "play")} ${card.def.name}`)
  checkTriggers(state, { type: "enters", card })
  checkTriggers(state, { type: "landfall", player: card.controller })
  return true
}

/** The commander tax: {2} more for each time it has been cast before. */
export function commanderTax(card: GameCard): number {
  return card.zone === "command" ? card.castCount * 2 : 0
}

export function canCast(state: GameState, cardId: number): Refusal {
  const card = state.cards[cardId]
  if (!card) return "no such card"
  if (state.winner !== null) return "the game is over"
  if (card.zone !== "hand" && card.zone !== "command") return "not castable from there"
  if (card.def.types.includes("Land")) return "lands are played, not cast"

  const sorcerySpeed = !isInstantSpeed(card.def)
  if (sorcerySpeed) {
    if (state.active !== card.controller) return "only on your turn"
    if (!MAIN_PHASES.includes(state.phase)) return "only in a main phase"
    if (state.stack.length > 0) return "the stack is not empty"
  }

  const cost = parseCost(card.def.cost)
  const extra = commanderTax(card)
  const player = state.players[card.controller]
  const untapped = battlefield(state, card.controller)
    .filter((c) => !c.tapped && manaAbilityOf(c) !== null)
    .reduce((n, c) => n + Math.max(0, netManaOf(c)), 0)
  const floating =
    player.pool.W + player.pool.U + player.pool.B + player.pool.R + player.pool.G + player.pool.C
  if (floating + untapped < cost.generic + cost.pips.length + extra) return "not enough mana"

  return null
}

/**
 * Casts a spell: pays for it, and puts it on the stack.
 *
 * The card moves to the stack rather than straight to the battlefield, so a
 * spell exists as an object that triggers "whenever you cast" abilities and can
 * be seen coming before it resolves.
 */
export function castSpell(
  state: GameState,
  cardId: number,
  targets: TargetRef[] = []
): boolean {
  if (canCast(state, cardId) !== null) return false
  const card = state.cards[cardId]
  const extra = commanderTax(card)

  if (!autoTapFor(state, card.controller, card.def.cost, extra)) return false
  const player = state.players[card.controller]
  const paid = payFrom(player.pool, parseCost(card.def.cost), extra)
  if (paid === null) return false
  player.pool = paid

  const fromCommand = card.zone === "command"
  if (fromCommand) card.castCount += 1

  moveCard(state, cardId, "stack")
  card.zone = "stack"

  const effects = card.def.abilities
    .filter((a) => a.kind === "spell")
    .flatMap((a) => (a.kind === "spell" ? a.effects : []))

  pushStack(state, {
    kind: "spell",
    source: cardId,
    controller: card.controller,
    effects,
    targets,
    description: `${card.def.name} resolves`,
  })
  log(state, `${subject(player.name, "cast")} ${card.def.name}`)
  checkTriggers(state, { type: "castSpell", card, controller: card.controller })

  // A spell with text nobody encoded still resolves as its body; say so once
  // here rather than letting the player wonder why nothing happened.
  if (!isPermanent(card.def) && effects.length === 0 && card.def.text.trim() !== "") {
    log(state, `${card.def.name}: its text is not implemented`, true)
  }
  stateBasedActions(state)
  return true
}

/** Mana empties between steps, as it does in a real game. */
export function emptyPools(state: GameState): void {
  for (const p of state.players) {
    p.pool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
  }
}

/* ── Equipment ────────────────────────────────────────────────────────── */

/**
 * Whether an Equipment can be moved onto a creature.
 *
 * Equipping is a sorcery-speed activated ability, so it follows the same timing
 * as casting: your turn, a main phase, an empty stack.
 */
export function canEquip(state: GameState, equipmentId: number, creatureId: number): Refusal {
  const equipment = state.cards[equipmentId]
  const creature = state.cards[creatureId]
  if (!equipment || !creature) return "no such card"
  if (state.winner !== null) return "the game is over"
  if (equipment.def.attach?.kind !== "equipment") return "not an Equipment"
  if (equipment.zone !== "battlefield") return "not on the battlefield"
  if (creature.zone !== "battlefield") return "not on the battlefield"
  if (!creature.def.types.includes("Creature")) return "not a creature"
  if (creature.controller !== equipment.controller) return "only your own creatures"
  if (state.active !== equipment.controller) return "only on your turn"
  if (!MAIN_PHASES.includes(state.phase)) return "only in a main phase"
  if (state.stack.length > 0) return "the stack is not empty"
  if (equipment.attachedTo === creatureId) return "already attached to it"

  const cost = equipment.def.attach.equipCost ?? "{0}"
  const parsed = parseCost(cost)
  const player = state.players[equipment.controller]
  const floating =
    player.pool.W + player.pool.U + player.pool.B + player.pool.R + player.pool.G + player.pool.C
  const untapped = battlefield(state, equipment.controller)
    .filter((c) => !c.tapped && manaAbilityOf(c) !== null)
    .reduce((n, c) => n + Math.max(0, netManaOf(c)), 0)
  if (floating + untapped < costTotal(parsed)) return "not enough mana"
  return null
}

export function equip(state: GameState, equipmentId: number, creatureId: number): boolean {
  if (canEquip(state, equipmentId, creatureId) !== null) return false
  const equipment = state.cards[equipmentId]
  const cost = equipment.def.attach?.equipCost ?? "{0}"

  if (costTotal(parseCost(cost)) > 0) {
    if (!autoTapFor(state, equipment.controller, cost)) return false
    const player = state.players[equipment.controller]
    const paid = payFrom(player.pool, parseCost(cost))
    if (paid === null) return false
    player.pool = paid
  }

  equipment.attachedTo = creatureId
  log(
    state,
    `${equipment.def.name} is attached to ${state.cards[creatureId].def.name}`
  )
  return true
}

/** Attaches an Aura as it resolves. Auras do not move once attached. */
export function attachAura(state: GameState, auraId: number, creatureId: number): boolean {
  const aura = state.cards[auraId]
  const creature = state.cards[creatureId]
  if (!aura || !creature) return false
  if (creature.zone !== "battlefield") return false
  aura.attachedTo = creatureId
  log(state, `${aura.def.name} enchants ${creature.def.name}`)
  return true
}
