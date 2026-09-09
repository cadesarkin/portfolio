/**
 * The opponent.
 *
 * Not a good Magic player, and not trying to be: it plays a land, casts what it
 * can afford biggest-first, attacks when the maths is in its favour and blocks
 * when the trade is good. That is enough to make a game of it, and every
 * decision here is a pure function of the state so it can be tested rather than
 * watched.
 */

import { canCast, canEquip, canPlayLand, castSpell, equip, maxX, playLand } from "./actions"
import { isPermanent } from "./cards"
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
      .filter((c) => worthCasting(state, c))
      .sort((a, b) => b.def.cmc - a.def.cmc)

    const pick = options[0]
    if (!pick) break
    // An X spell is worth whatever is left over; holding the mana back does
    // nothing, since the pool empties at the end of the step.
    if (!castSpell(state, pick.id, [], maxX(state, pick.id))) break
    resolveAll(state)
    cast++
  }
  return cast
}

/**
 * Whether a card is worth spending mana on.
 *
 * The AI used to cast anything it could afford, which meant it emptied its hand
 * of instants that resolve and do nothing — it looked like a player making
 * random moves. A permanent is always worth playing, because a body on the
 * board is a body. A spell is only worth casting if some of it actually runs.
 */
function worthCasting(state: GameState, card: GameCard): boolean {
  if (isPermanent(card.def)) return true

  const effects = card.def.abilities
    .filter((a) => a.kind === "spell")
    .flatMap((a) => (a.kind === "spell" ? a.effects : []))
  const real = effects.filter((e) => e.do !== "unimplemented")
  if (real.length === 0) return false

  // A removal spell with nothing to point at is mana thrown away.
  const needsTarget = real.some((e) => "target" in e && e.target?.chosen)
  if (!needsTarget) return true
  return battlefield(state).some(
    (c) => c.def.types.includes("Creature") && c.controller !== card.controller
  )
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
 * Blocks to kill when it can do so without dying, trades when the attacker is
 * worth more, chumps when the incoming damage would otherwise be lethal, and
 * otherwise takes it.
 *
 * Menace is handled by committing two blockers or none: assigning a single one
 * is not a legal block, so an AI that only ever picked one blocker could never
 * block a creature with menace at all.
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

    const needed = hasKeyword(state, attacker, "menace") ? 2 : 1
    if (options.length < needed) continue

    const attackerPower = powerOf(state, attacker)
    const attackerToughness = toughnessOf(state, attacker)

    /** Commits a set of blockers to this attacker. */
    const commit = (blockers: GameCard[]) => {
      for (const b of blockers) {
        blocks[b.id] = attacker.id
        used.add(b.id)
      }
    }

    if (needed === 2) {
      // Two together: worth it if they kill it, or if it has to be stopped.
      const pair = options.slice(0, 2)
      const combined = pair.reduce((n, b) => n + powerOf(state, b), 0)
      const kills = combined >= attackerToughness || pair.some((b) => hasKeyword(state, b, "deathtouch"))
      if (kills || desperate) commit(pair)
      continue
    }

    // A block that kills the attacker and survives is free value.
    const clean = options.find(
      (b) =>
        (powerOf(state, b) >= attackerToughness || hasKeyword(state, b, "deathtouch")) &&
        toughnessOf(state, b) > attackerPower
    )
    if (clean) {
      commit([clean])
      continue
    }

    // Otherwise trade, if the attacker is worth more than the blocker.
    const trade = options.find(
      (b) => powerOf(state, b) >= attackerToughness && attacker.def.cmc >= b.def.cmc
    )
    if (trade) {
      commit([trade])
      continue
    }

    // Chump only when the alternative is losing.
    if (desperate) commit([options[options.length - 1]])
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

/**
 * Moves Equipment onto the best creature available.
 *
 * Biggest creature first: an Equipment on the largest body is the most damage
 * added, and haste or hexproof matter most on the thing worth protecting.
 */
export function aiEquip(state: GameState, me: PlayerId): number {
  const equipment = battlefield(state, me).filter((c) => c.def.attach?.kind === "equipment")
  const creatures = battlefield(state, me)
    .filter((c) => c.def.types.includes("Creature"))
    .sort((a, b) => powerOf(state, b) - powerOf(state, a))
  if (creatures.length === 0) return 0

  let moved = 0
  for (const item of equipment) {
    const best = creatures[0]
    if (item.attachedTo === best.id) continue
    if (canEquip(state, item.id, best.id) !== null) continue
    if (equip(state, item.id, best.id)) moved++
  }
  return moved
}

