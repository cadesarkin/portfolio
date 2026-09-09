/**
 * The stack: casting, triggering, and resolving one object at a time.
 *
 * Triggered abilities go on the stack above whatever caused them, which is what
 * makes an ETB trigger resolve before the spell that followed it. Resolution is
 * one item per call so the UI can show each step rather than a board that
 * changed all at once for reasons nobody saw.
 */

import { isPermanent } from "./cards"
import { canTarget, matches, toughnessOf } from "./continuous"
import { applyEffect, type EffectContext } from "./effects"
import { battlefield, log, moveCard, opponentOf } from "./state"
import type {
  Effect,
  GameCard,
  GameState,
  PlayerId,
  StackItem,
  TargetRef,
  TriggerEvent,
} from "./types"

/** Something that happened, which triggered abilities may care about. */
export type GameEvent =
  | { type: "enters"; card: GameCard }
  | { type: "dies"; card: GameCard }
  | { type: "attacks"; card: GameCard }
  | { type: "upkeep"; player: PlayerId }
  | { type: "endStep"; player: PlayerId }
  | { type: "beginCombat"; player: PlayerId }
  | { type: "castSpell"; card: GameCard; controller: PlayerId }
  | { type: "landfall"; player: PlayerId }
  | { type: "dealsCombatDamage"; card: GameCard }

function eventMatches(
  event: GameEvent,
  trigger: TriggerEvent,
  source: GameCard
): boolean {
  switch (trigger.when) {
    case "enters":
      if (event.type !== "enters") return false
      if (trigger.who === "self") return event.card.id === source.id
      return event.card.id !== source.id && matches(event.card, trigger.filter, source)
    case "dies":
      if (event.type !== "dies") return false
      if (trigger.who === "attached") return source.attachedTo === event.card.id
      return event.card.id === source.id
    case "attacks":
      if (event.type !== "attacks") return false
      if (trigger.who === "self") return event.card.id === source.id
      return matches(event.card, trigger.filter, source)
    case "upkeep":
      return event.type === "upkeep" && event.player === source.controller
    case "endStep":
      return event.type === "endStep" && event.player === source.controller
    case "beginCombat":
      return event.type === "beginCombat" && event.player === source.controller
    case "castSpell":
      return event.type === "castSpell" && matches(event.card, trigger.filter, source)
    case "landfall":
      return event.type === "landfall" && event.player === source.controller
    case "dealsCombatDamage":
      return event.type === "dealsCombatDamage" && event.card.id === source.id
  }
}

/**
 * Puts every ability that this event triggers onto the stack.
 *
 * Only permanents on the battlefield trigger, which is why a creature's death
 * trigger has to be collected before it leaves — the caller handles that
 * ordering, since it is the one that knows what is about to move.
 */
export function checkTriggers(state: GameState, event: GameEvent): void {
  for (const source of battlefield(state)) {
    for (const ability of source.def.abilities) {
      if (ability.kind !== "triggered") continue
      if (!eventMatches(event, ability.on, source)) continue
      pushStack(state, {
        kind: "triggered",
        source: source.id,
        controller: source.controller,
        effects: ability.effects,
        targets: autoTargets(state, source, ability.effects),
        x: 0,
        description: `${source.def.name} triggers`,
      })
    }
  }
}

/**
 * Targets an automatic ability picks for itself.
 *
 * A triggered ability with a chosen target would otherwise need a decision from
 * whoever controls it, including the AI. Picking the controller's own biggest
 * creature, or the opponent's, is a reasonable stand-in and keeps triggers from
 * stalling the game waiting for an answer.
 */
function autoTargets(state: GameState, source: GameCard, effects: Effect[]): TargetRef[] {
  const out: TargetRef[] = []
  for (const effect of effects) {
    if (!("target" in effect) || !effect.target?.chosen) continue
    const spec = effect.target
    if (spec.what === "player") {
      out.push({
        kind: "player",
        id: spec.controller === "you" ? source.controller : opponentOf(source.controller),
      })
      continue
    }
    const wantOwn = spec.controller !== "opponent"
    const pool = battlefield(state).filter((c) => {
      if (spec.what === "creature" && !c.def.types.includes("Creature")) return false
      // Hexproof stops an opponent's ability choosing it, the same as a spell.
      if (!canTarget(state, c, source.controller)) return false
      return wantOwn ? c.controller === source.controller : c.controller !== source.controller
    })
    const pick = pool.sort((a, b) => (b.def.power ?? 0) - (a.def.power ?? 0))[0]
    if (pick) out.push({ kind: "card", id: pick.id })
  }
  return out
}

export function pushStack(state: GameState, item: Omit<StackItem, "id">): void {
  state.stack.push({ ...item, id: state.nextId++ })
}

/**
 * Resolves the top of the stack.
 *
 * Returns false when there was nothing to resolve, so a caller can loop until
 * the stack is empty without needing to check first.
 */
export function resolveTop(state: GameState): boolean {
  const item = state.stack.pop()
  if (!item) return false

  const source = state.cards[item.source]
  const ctx: EffectContext = {
    state,
    controller: item.controller,
    source,
    targets: item.targets,
    x: item.x,
  }

  if (item.kind === "spell" && source) {
    // A permanent spell becomes a permanent; anything else does its thing and
    // goes to the graveyard.
    if (isPermanent(source.def)) {
      moveCard(state, source.id, "battlefield")
      source.sick = true
      source.tapped = source.def.entersTapped
      log(state, `${source.def.name} enters`)
      if (source.def.attach?.kind === "aura") {
        const target = item.targets.find((t) => t.kind === "card")
        if (target && target.kind === "card") {
          source.attachedTo = target.id
          log(state, `${source.def.name} enchants ${state.cards[target.id]?.def.name ?? "it"}`)
        }
      }
      for (const effect of item.effects) applyEffect(ctx, effect)
      checkTriggers(state, { type: "enters", card: source })
      if (source.def.types.includes("Land")) {
        checkTriggers(state, { type: "landfall", player: item.controller })
      }
      return true
    }
    log(state, `${source.def.name} resolves`)
    for (const effect of item.effects) applyEffect(ctx, effect)
    moveCard(state, source.id, "graveyard")
    return true
  }

  if (item.effects.length) log(state, item.description)
  for (const effect of item.effects) applyEffect(ctx, effect)
  return true
}

export function resolveAll(state: GameState, limit = 200): void {
  let guard = 0
  while (state.stack.length > 0 && guard++ < limit) {
    resolveTop(state)
    stateBasedActions(state)
  }
}

/**
 * State-based actions: the checks the game makes constantly, without anyone
 * doing anything. A creature with lethal damage dies here, not in combat.
 */
export function stateBasedActions(state: GameState): void {
  for (const card of battlefield(state)) {
    if (!card.def.types.includes("Creature")) continue
    const toughness = toughnessOf(state, card)
    const indestructible = card.def.keywords.includes("indestructible")
    if (toughness <= 0) {
      log(state, `${card.def.name} dies`)
      checkTriggers(state, { type: "dies", card })
      moveCard(state, card.id, "graveyard")
      continue
    }
    // Any damage at all from a deathtouch source is lethal.
    const lethal = card.damage >= toughness || (card.deathtouched && card.damage > 0)
    if (lethal && !indestructible) {
      log(state, `${card.def.name} dies`)
      checkTriggers(state, { type: "dies", card })
      moveCard(state, card.id, "graveyard")
    }
  }

  /* An Equipment attached to something that is no longer a creature on the
     battlefield falls off; an Aura with nothing to enchant is put into the
     graveyard. Without this a dead creature keeps handing out its buffs. */
  for (const card of battlefield(state)) {
    if (card.attachedTo === null) continue
    const host = state.cards[card.attachedTo]
    const valid = host && host.zone === "battlefield" && host.def.types.includes("Creature")
    if (valid) continue
    card.attachedTo = null
    if (card.def.attach?.kind === "aura") {
      log(state, `${card.def.name} has nothing to enchant`)
      moveCard(state, card.id, "graveyard")
    }
  }

  if (state.winner === null) {
    for (const player of state.players) {
      if (player.life <= 0) {
        state.winner = opponentOf(player.id)
        log(state, `${player.name} is out of life — ${state.players[state.winner].name} wins`)
      }
    }
  }
}
