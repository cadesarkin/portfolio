/**
 * The turn: phases, and what happens automatically in each.
 *
 * `advance` moves the game to the next phase and performs that phase's turn-
 * based actions. Combat phases stop and wait — declaring attackers is the
 * player's decision, not something the phase machine does for them.
 */

import { emptyPools } from "./actions"
import { checkCommanderDamage, combatDamage, endCombat } from "./combat"
import { battlefield, drawCard, log, opponentOf, LETHAL_COMMANDER_DAMAGE } from "./state"
import { checkTriggers, resolveAll, stateBasedActions } from "./stack"
import { PHASES, type GameState, type Phase } from "./types"

const next = (phase: Phase): Phase => PHASES[(PHASES.indexOf(phase) + 1) % PHASES.length]

/** Phases that hand control back rather than running on. */
export const STOPS: Phase[] = ["main1", "declareAttackers", "declareBlockers", "main2"]

/**
 * Advances one phase and runs everything that phase does on its own.
 *
 * The untap and draw steps, combat damage and cleanup all happen here; the
 * caller does not have to know the order of a turn, only that it asked for the
 * next phase.
 */
export function advance(state: GameState): void {
  if (state.winner !== null) return

  // Anything still on the stack resolves before the phase changes.
  resolveAll(state)
  emptyPools(state)

  const phase = next(state.phase)
  state.phase = phase

  switch (phase) {
    case "untap": {
      state.turn += 1
      state.active = opponentOf(state.active)
      state.priority = state.active
      const player = state.players[state.active]
      player.landPlayed = false
      for (const card of battlefield(state, state.active)) {
        card.tapped = false
        card.sick = false
      }
      log(state, `— turn ${state.turn}: ${player.name} —`)
      break
    }

    case "upkeep":
      checkTriggers(state, { type: "upkeep", player: state.active })
      resolveAll(state)
      break

    case "draw":
      // The player on the play does not draw on the first turn.
      if (state.turn > 1) drawCard(state, state.active)
      break

    case "beginCombat":
      checkTriggers(state, { type: "beginCombat", player: state.active })
      resolveAll(state)
      break

    case "combatDamage":
      combatDamage(state)
      checkCommanderDamage(state, LETHAL_COMMANDER_DAMAGE)
      break

    case "endCombat":
      endCombat(state)
      break

    case "end":
      checkTriggers(state, { type: "endStep", player: state.active })
      resolveAll(state)
      break

    case "cleanup": {
      state.preventCombatDamage = false
      // Damage wears off and until-end-of-turn effects fall away.
      for (const card of battlefield(state)) {
        card.damage = 0
        card.deathtouched = false
        card.untilEot = { power: 0, toughness: 0, keywords: [] }
      }
      break
    }

    default:
      break
  }

  stateBasedActions(state)
}

/** Advances until the next phase where a player would actually decide. */
export function advanceToStop(state: GameState, limit = 24): void {
  let guard = 0
  do {
    advance(state)
  } while (state.winner === null && !STOPS.includes(state.phase) && guard++ < limit)
}

/**
 * Skips forward to the next time the game is in the given phase.
 *
 * Always advances at least once: "go to the next main phase" while already in
 * one means the following one, not standing still. Bounded rather than looping
 * until it matches, since a phase that never comes round would hang the game.
 */
export function advanceTo(state: GameState, phase: Phase, limit = 40): void {
  let guard = 0
  do {
    advance(state)
  } while (state.phase !== phase && state.winner === null && guard++ < limit)
}
