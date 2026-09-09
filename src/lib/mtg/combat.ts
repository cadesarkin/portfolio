/**
 * Combat.
 *
 * Attacking, blocking and damage, with the evasion keywords that matter in
 * these decks: flying and reach, menace, vigilance, trample, deathtouch,
 * lifelink, first and double strike.
 *
 * Damage is dealt to permanents rather than killing them here. A creature dies
 * from state-based actions after the whole combat step has been dealt, which is
 * what lets two creatures kill each other simultaneously.
 */

import { hasKeyword, powerOf, toughnessOf } from "./continuous"
import { damagePlayer } from "./effects"
import { battlefield, log, opponentOf, subject } from "./state"
import { checkTriggers, stateBasedActions } from "./stack"
import type { GameCard, GameState, PlayerId } from "./types"

export function canAttack(state: GameState, card: GameCard): boolean {
  if (card.zone !== "battlefield") return false
  if (!card.def.types.includes("Creature")) return false
  if (card.controller !== state.active) return false
  if (card.tapped) return false
  if (card.sick && !hasKeyword(state, card, "haste")) return false
  if (hasKeyword(state, card, "defender")) return false
  return true
}

/** Every creature that could be declared as an attacker right now. */
export const possibleAttackers = (state: GameState): GameCard[] =>
  battlefield(state, state.active).filter((c) => canAttack(state, c))

/**
 * Declares attackers.
 *
 * Attacking taps the creature unless it has vigilance, and each attacker
 * triggers before any of them deal damage.
 */
export function declareAttackers(state: GameState, ids: number[]): void {
  const attackers: GameCard[] = []
  for (const id of ids) {
    const card = state.cards[id]
    if (!card || !canAttack(state, card)) continue
    card.attacking = true
    if (!hasKeyword(state, card, "vigilance")) card.tapped = true
    attackers.push(card)
  }
  if (attackers.length === 0) return
  log(
    state,
    `${subject(state.players[state.active].name, "attack")} with ${attackers.map((a) => a.def.name).join(", ")}`
  )
  for (const card of attackers) checkTriggers(state, { type: "attacks", card })
}

/** Whether `blocker` is allowed to block `attacker`. */
export function canBlock(state: GameState, blocker: GameCard, attacker: GameCard): boolean {
  if (blocker.zone !== "battlefield") return false
  if (!blocker.def.types.includes("Creature")) return false
  if (blocker.tapped) return false
  if (blocker.controller === attacker.controller) return false
  if (!attacker.attacking) return false
  if (
    hasKeyword(state, attacker, "flying") &&
    !hasKeyword(state, blocker, "flying") &&
    !hasKeyword(state, blocker, "reach")
  ) {
    return false
  }
  return true
}

/**
 * Declares blocks, as a map of blocker id to the attacker it blocks.
 *
 * Menace is checked across the whole declaration rather than one blocker at a
 * time: a creature with menace cannot be blocked except by two or more, which
 * is only knowable once every block is in.
 */
export function declareBlockers(state: GameState, blocks: Record<number, number>): void {
  const perAttacker = new Map<number, number[]>()
  for (const [blockerId, attackerId] of Object.entries(blocks)) {
    const blocker = state.cards[Number(blockerId)]
    const attacker = state.cards[attackerId]
    if (!blocker || !attacker) continue
    if (!canBlock(state, blocker, attacker)) continue
    const list = perAttacker.get(attacker.id) ?? []
    list.push(blocker.id)
    perAttacker.set(attacker.id, list)
  }

  for (const [attackerId, blockerIds] of perAttacker) {
    const attacker = state.cards[attackerId]
    if (hasKeyword(state, attacker, "menace") && blockerIds.length < 2) {
      log(state, `${attacker.def.name} has menace and cannot be blocked by one creature`)
      continue
    }
    for (const id of blockerIds) state.cards[id].blocking = attackerId
  }
}

const attackersOf = (state: GameState): GameCard[] =>
  battlefield(state).filter((c) => c.attacking)

const blockersFor = (state: GameState, attacker: GameCard): GameCard[] =>
  battlefield(state).filter((c) => c.blocking === attacker.id)

/**
 * Deals combat damage.
 *
 * Runs in two passes so first strike works: the first pass is only creatures
 * with first or double strike, and anything that died is gone before the
 * regular pass, which is the whole point of the keyword.
 */
export function combatDamage(state: GameState): void {
  const defender = opponentOf(state.active)

  const firstStrikers = attackersOf(state).concat(
    battlefield(state).filter((c) => c.blocking !== null)
  ).some((c) => hasKeyword(state, c, "first strike") || hasKeyword(state, c, "double strike"))

  if (firstStrikers) {
    dealDamageStep(state, defender, "first")
    stateBasedActions(state)
  }
  dealDamageStep(state, defender, "regular")
  stateBasedActions(state)
}

function strikesIn(state: GameState, card: GameCard, step: "first" | "regular"): boolean {
  const first = hasKeyword(state, card, "first strike")
  const double = hasKeyword(state, card, "double strike")
  if (step === "first") return first || double
  return !first || double
}

function dealDamageStep(state: GameState, defender: PlayerId, step: "first" | "regular"): void {
  for (const attacker of attackersOf(state)) {
    if (attacker.zone !== "battlefield") continue
    if (!strikesIn(state, attacker, step)) continue

    const power = powerOf(state, attacker)
    if (power <= 0) continue
    const blockers = blockersFor(state, attacker).filter((b) => b.zone === "battlefield")

    if (blockers.length === 0) {
      damagePlayer(state, defender, power)
      if (hasKeyword(state, attacker, "lifelink")) {
        state.players[attacker.controller].life += power
      }
      // Commander damage is tracked separately: 21 from one commander kills.
      if (attacker.def.supertypes.includes("Legendary") && attacker.owner === attacker.controller) {
        const fromCommandZone = attacker.castCount > 0
        if (fromCommandZone) state.players[defender].commanderDamage += power
      }
      checkTriggers(state, { type: "dealsCombatDamage", card: attacker })
      continue
    }

    // Damage is assigned in order, with lethal to each before moving on.
    let left = power
    const deathtouch = hasKeyword(state, attacker, "deathtouch")
    for (const blocker of blockers) {
      if (left <= 0) break
      const needed = deathtouch
        ? 1
        : Math.max(0, toughnessOf(state, blocker) - blocker.damage)
      const assign = Math.min(left, needed === 0 ? left : needed)
      blocker.damage += assign
      if (deathtouch) blocker.deathtouched = true
      left -= assign
    }
    // Trample sends whatever is spare through to the player.
    if (left > 0 && hasKeyword(state, attacker, "trample")) {
      damagePlayer(state, defender, left)
    }
    if (hasKeyword(state, attacker, "lifelink")) {
      state.players[attacker.controller].life += power
    }
    checkTriggers(state, { type: "dealsCombatDamage", card: attacker })
  }

  // Blockers hit back.
  for (const blocker of battlefield(state)) {
    if (blocker.blocking === null || blocker.zone !== "battlefield") continue
    if (!strikesIn(state, blocker, step)) continue
    const attacker = state.cards[blocker.blocking]
    if (!attacker || attacker.zone !== "battlefield") continue
    const power = powerOf(state, blocker)
    if (power <= 0) continue
    attacker.damage += power
    if (hasKeyword(state, blocker, "deathtouch")) attacker.deathtouched = true
    if (hasKeyword(state, blocker, "lifelink")) {
      state.players[blocker.controller].life += power
    }
  }
}

/** Clears the combat flags once the step is done. */
export function endCombat(state: GameState): void {
  for (const card of battlefield(state)) {
    card.attacking = false
    card.blocking = null
  }
}

/** A player who has taken 21 from one commander has lost. */
export function checkCommanderDamage(state: GameState, lethal: number): void {
  if (state.winner !== null) return
  for (const player of state.players) {
    if (player.commanderDamage >= lethal) {
      state.winner = opponentOf(player.id)
      log(state, `${player.name} has taken ${lethal} commander damage`)
    }
  }
}
