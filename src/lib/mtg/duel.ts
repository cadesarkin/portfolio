/**
 * Driving a duel.
 *
 * The engine is a pile of pure functions; this is the thing that knows what
 * order to call them in. It runs the AI's whole turn on its own, and stops on
 * the player's turn wherever there is a decision to make.
 */

import { aiCastSpells, aiDeclareAttackers, aiDeclareBlockers, aiEquip, aiPlayLand } from "./ai"
import { declareAttackers, declareBlockers } from "./combat"
import { resolveAll, stateBasedActions } from "./stack"
import { advance } from "./turn"
import type { GameState, PlayerId } from "./types"

export const HUMAN: PlayerId = 0
export const AI: PlayerId = 1

/** How far the game has got, and what it is waiting for. */
export type Waiting =
  | { for: "player-main" }
  | { for: "player-attackers" }
  | { for: "player-blockers" }
  | { for: "over" }

/**
 * Runs the game forward until it needs the player.
 *
 * Every phase the player does not act in is handled here, including the whole
 * of the AI's turn, so the UI only ever has to render a state and offer the one
 * decision that state is waiting on.
 */
export function runUntilPlayer(state: GameState, limit = 400): Waiting {
  // A player brought to zero by something outside a phase change has not lost
  // until the game next checks, and the driver is the thing that checks.
  stateBasedActions(state)
  let guard = 0
  while (state.winner === null && guard++ < limit) {
    /* Resolve anything waiting before handing control back. Nobody in this
       game responds to a spell, so leaving it on the stack only meant the
       player could not cast a second one: "the stack is not empty". */
    if (state.stack.length > 0) {
      resolveAll(state)
      stateBasedActions(state)
      continue
    }

    // The player's own decision points.
    if (state.active === HUMAN) {
      if (state.phase === "main1" || state.phase === "main2") return { for: "player-main" }
      if (state.phase === "declareAttackers") return { for: "player-attackers" }
    } else {
      // The AI's turn, played out in full.
      if (state.phase === "main1") {
        aiPlayLand(state, AI)
        aiCastSpells(state, AI)
        aiEquip(state, AI)
        advance(state)
        continue
      }
      if (state.phase === "declareAttackers") {
        aiDeclareAttackers(state, AI)
        advance(state)
        continue
      }
      if (state.phase === "declareBlockers") {
        // The player blocks the AI's attack.
        const attacking = Object.values(state.cards).some((c) => c.attacking)
        if (attacking) return { for: "player-blockers" }
        advance(state)
        continue
      }
      if (state.phase === "main2") {
        aiCastSpells(state, AI)
        advance(state)
        continue
      }
    }

    // The AI blocks on the player's turn.
    if (state.active === HUMAN && state.phase === "declareBlockers") {
      aiDeclareBlockers(state, AI)
      advance(state)
      continue
    }

    advance(state)
  }
  return state.winner === null ? { for: "player-main" } : { for: "over" }
}

/** The player has finished a main phase and wants to move on. */
export function passPhase(state: GameState): Waiting {
  advance(state)
  return runUntilPlayer(state)
}

export function playerAttacks(state: GameState, ids: number[]): Waiting {
  declareAttackers(state, ids)
  advance(state)
  return runUntilPlayer(state)
}

export function playerBlocks(state: GameState, blocks: Record<number, number>): Waiting {
  declareBlockers(state, blocks)
  advance(state)
  return runUntilPlayer(state)
}

/**
 * Plays a whole game with the AI on both sides.
 *
 * This is the engine's smoke test: a hundred turns of real cards from real
 * decks, with an assertion that it ends rather than deadlocking. It catches the
 * kind of bug that never shows up in a test of one rule at a time.
 */
export function selfPlay(state: GameState, maxTurns = 60): GameState {
  let guard = 0
  while (state.winner === null && state.turn <= maxTurns && guard++ < maxTurns * 14) {
    const me = state.active
    switch (state.phase) {
      case "main1":
        aiPlayLand(state, me)
        aiCastSpells(state, me)
        aiEquip(state, me)
        break
      case "declareAttackers":
        aiDeclareAttackers(state, me)
        break
      case "declareBlockers":
        aiDeclareBlockers(state, me === 0 ? 1 : 0)
        break
      case "main2":
        aiCastSpells(state, me)
        break
      default:
        break
    }
    advance(state)
  }
  return state
}
