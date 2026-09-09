/**
 * The opponent.
 *
 * Not a good Magic player, and not trying to be: it plays a land, casts what it
 * can afford biggest-first, attacks when the maths is in its favour and blocks
 * when the trade is good. That is enough to make a game of it, and every
 * decision here is a pure function of the state so it can be tested rather than
 * watched.
 */

import { canCast, canPlayLand, castSpell, playLand } from "./actions"
import { canAttack, canBlock, declareAttackers, declareBlockers } from "./combat"
import { hasKeyword, powerOf, toughnessOf } from "./continuous"
import { battlefield, cardsIn, opponentOf } from "./state"
import { resolveAll } from "./stack"
import type { GameCard, GameState, PlayerId } from "./types"

/** Plays a land for the turn, if it has one. Prefers an untapped source. */
export function aiPlayLand(state: GameState, me: PlayerId): boolean {
  const hand = cardsIn(state, state.players[me].hand)
  const lands = hand.filter((c) => c.def.types.includes("Land") && canPlayLand(state, c.id) === null)
  if (lands.length === 0) return false
  // A land that makes coloured mana beats one that makes none.
  const best = lands.sort((a, b) => b.def.produces.length - a.def.produces.length)[0]
  return playLand(state, best.id)
}

/**
 * Casts what it can, most expensive first.
 *
 * Biggest-first is a crude curve heuristic, but it is the right one for
 * Commander decks: the expensive cards are the ones that win, and mana left
 * unspent is mana wasted.
 */
export function aiCastSpells(state: GameState, me: PlayerId, limit = 6): number {
  let cast = 0
  for (let i = 0; i < limit; i++) {
    const options = [
      ...cardsIn(state, state.players[me].hand),
      ...cardsIn(state, state.players[me].command),
    ]
      .filter((c) => canCast(state, c.id) === null)
      .sort((a, b) => b.def.cmc - a.def.cmc)

    const pick = options[0]
    if (!pick) break
    if (!castSpell(state, pick.id)) break
    resolveAll(state)
    cast++
  }
  return cast
}

/**
 * Which creatures to attack with.
 *
 * Attacks with anything that either cannot be blocked profitably or is big
 * enough that trading is fine. A creature is held back if every attack it could
 * make loses it for nothing, which is what stops the AI throwing its board away
 * one creature at a time.
 */
export function chooseAttackers(state: GameState, me: PlayerId): number[] {
  const mine = battlefield(state, me).filter((c) => canAttack(state, c))
  const theirs = battlefield(state, opponentOf(me)).filter(
    (c) => c.def.types.includes("Creature") && !c.tapped
  )

  return mine
    .filter((attacker) => {
      const power = powerOf(state, attacker)
      if (power <= 0) return false
      const toughness = toughnessOf(state, attacker)

      // Anything that can profitably block it.
      const threats = theirs.filter((b) => canBlock(state, b, { ...attacker, attacking: true }))
      if (threats.length === 0) return true

      const killsMe = threats.some(
        (b) => powerOf(state, b) >= toughness || hasKeyword(state, b, "deathtouch")
      )
      const iKillIt = threats.some((b) => power >= toughnessOf(state, b))
      // Trade up or attack freely; do not feed a bigger creature for nothing.
      return !killsMe || iKillIt
    })
    .map((c) => c.id)
}

/**
 * Which blocks to make.
 *
 * Blocks to kill when it can do so without dying, chumps when the incoming
 * damage would otherwise be lethal, and otherwise takes it.
 */
export function chooseBlocks(state: GameState, me: PlayerId): Record<number, number> {
  const attackers = battlefield(state, opponentOf(me)).filter((c) => c.attacking)
  const available = battlefield(state, me).filter(
    (c) => c.def.types.includes("Creature") && !c.tapped
  )
  const blocks: Record<number, number> = {}
  const used = new Set<number>()

  const incoming = attackers.reduce((n, a) => n + powerOf(state, a), 0)
  const desperate = incoming >= state.players[me].life

  // Biggest attackers first: they are the ones worth answering.
  for (const attacker of [...attackers].sort((a, b) => powerOf(state, b) - powerOf(state, a))) {
    const options = available
      .filter((b) => !used.has(b.id) && canBlock(state, b, attacker))
      .sort((a, b) => powerOf(state, b) - powerOf(state, a))
    if (options.length === 0) continue

    const attackerPower = powerOf(state, attacker)
    const attackerToughness = toughnessOf(state, attacker)

    // A block that kills the attacker and survives is free value.
    const clean = options.find(
      (b) =>
        (powerOf(state, b) >= attackerToughness || hasKeyword(state, b, "deathtouch")) &&
        toughnessOf(state, b) > attackerPower
    )
    if (clean) {
      blocks[clean.id] = attacker.id
      used.add(clean.id)
      continue
    }

    // Otherwise trade, if the attacker is worth more than the blocker.
    const trade = options.find(
      (b) =>
        powerOf(state, b) >= attackerToughness &&
        attacker.def.cmc >= b.def.cmc
    )
    if (trade) {
      blocks[trade.id] = attacker.id
      used.add(trade.id)
      continue
    }

    // Chump only when the alternative is losing.
    if (desperate) {
      const chump = options[options.length - 1]
      blocks[chump.id] = attacker.id
      used.add(chump.id)
    }
  }
  return blocks
}

export function aiDeclareAttackers(state: GameState, me: PlayerId): void {
  declareAttackers(state, chooseAttackers(state, me))
  resolveAll(state)
}

export function aiDeclareBlockers(state: GameState, me: PlayerId): void {
  declareBlockers(state, chooseBlocks(state, me))
}

/** Everything the AI does in a main phase. */
export function aiMainPhase(state: GameState, me: PlayerId): void {
  aiPlayLand(state, me)
  aiCastSpells(state, me)
}

export const creaturesOf = (state: GameState, p: PlayerId): GameCard[] =>
  battlefield(state, p).filter((c) => c.def.types.includes("Creature"))
