/**
 * Resolving effects.
 *
 * The vocabulary is small on purpose. Measured over these three decks, 67% of
 * the non-land cards touch one of about fifteen recurring patterns, so a short
 * list of primitives covers a lot of real text. Anything outside it is encoded
 * as `unimplemented`, which resolves to a line in the log saying what did not
 * happen — the engine never silently drops a card's text on the floor.
 */

import { cardDef } from "./cards"
import { matches } from "./continuous"
import { battlefield, cardsIn, log, moveCard, opponentOf, subject } from "./state"
import type {
  Amount,
  Effect,
  GameCard,
  GameState,
  PlayerId,
  PlayerSpec,
  TargetRef,
  TargetSpec,
  TokenSpec,
} from "./types"

/** Where an effect is being resolved from. */
export interface EffectContext {
  state: GameState
  controller: PlayerId
  source: GameCard | undefined
  targets: TargetRef[]
  /** What X was paid, for effects that scale with it. */
  x?: number
}

function amountOf(ctx: EffectContext, amount: Amount): number {
  if (typeof amount === "number") return amount
  switch (amount.count) {
    case "creatures":
      return battlefield(ctx.state).filter(
        (c) => c.def.types.includes("Creature") && matches(c, amount.filter, ctx.source)
      ).length
    case "cardsInHand":
      return playersFor(ctx, amount.who).reduce<number>(
        (n, p) => n + ctx.state.players[p].hand.length,
        0
      )
    case "x":
      return ctx.x ?? 0
    default:
      return 0
  }
}

function playersFor(ctx: EffectContext, spec: PlayerSpec): PlayerId[] {
  switch (spec) {
    case "you":
      return [ctx.controller]
    case "opponent":
      return [opponentOf(ctx.controller)]
    case "each":
      return [0, 1]
  }
}

/**
 * The permanents an effect applies to.
 *
 * A chosen target uses what the player picked when the spell went on the stack.
 * An unchosen one is worked out here, which is how "all creatures you control"
 * needs no interaction.
 */
function resolveTargets(ctx: EffectContext, spec: TargetSpec): GameCard[] {
  const { state, source, controller } = ctx

  if (spec.what === "self") return source ? [source] : []

  /* A player is not a permanent. Without this the type filters below all fell
     through, and "deals 2 damage to your opponent" returned every permanent
     that opponent controlled — so an entry trigger aimed at the face swept
     their whole board as well. */
  if (spec.what === "player") return []

  if (spec.chosen) {
    return ctx.targets
      .filter((t): t is { kind: "card"; id: number } => t.kind === "card")
      .map((t) => state.cards[t.id])
      .filter((c): c is GameCard => Boolean(c) && c.zone === "battlefield")
  }

  const pool = battlefield(state).filter((c) => {
    if (spec.what === "creature" && !c.def.types.includes("Creature")) return false
    if (spec.what === "artifact" && !c.def.types.includes("Artifact")) return false
    if (spec.what === "enchantment" && !c.def.types.includes("Enchantment")) return false
    if (spec.what === "land" && !c.def.types.includes("Land")) return false
    if (spec.controller === "you" && c.controller !== controller) return false
    if (spec.controller === "opponent" && c.controller === controller) return false
    if (spec.filter && !matches(c, spec.filter, source)) return false
    return true
  })

  if (spec.count === "all" || spec.count === undefined) return pool
  return pool.slice(0, spec.count)
}

/** The players an effect targeting a player applies to. */
function targetPlayers(ctx: EffectContext, spec: TargetSpec): PlayerId[] {
  if (spec.what !== "player") return []
  if (spec.chosen) {
    const chosen = ctx.targets.filter(
      (t): t is { kind: "player"; id: PlayerId } => t.kind === "player"
    )
    if (chosen.length) return chosen.map((t) => t.id)
  }
  if (spec.controller === "you") return [ctx.controller]
  return [opponentOf(ctx.controller)]
}

function createToken(
  state: GameState,
  controller: PlayerId,
  spec: TokenSpec
): GameCard {
  const id = state.nextId++
  const card: GameCard = {
    id,
    def: {
      name: spec.name,
      cost: "",
      cmc: 0,
      types: spec.types,
      subtypes: spec.subtypes,
      supertypes: [],
      colours: spec.colours,
      power: spec.power,
      toughness: spec.toughness,
      text: "",
      keywords: spec.keywords,
      produces: [],
      abilities: [],
      entersTapped: false,
      encoded: "vanilla",
      rarity: "token",
      set: "",
    },
    owner: controller,
    controller,
    zone: "battlefield",
    tapped: false,
    sick: true,
    damage: 0,
    deathtouched: false,
    counters: {},
    untilEot: { power: 0, toughness: 0, keywords: [] },
    addedSubtypes: [],
    attacking: false,
    blocking: null,
    attachedTo: null,
    produced: [],
    token: true,
    castCount: 0,
  }
  state.cards[id] = card
  state.players[controller].battlefield.push(id)
  return card
}

/** Damage to a player, which is also how a game is won. */
export function damagePlayer(state: GameState, playerId: PlayerId, amount: number): void {
  if (amount <= 0) return
  const player = state.players[playerId]
  player.life -= amount
  log(state, `${subject(player.name, "take")} ${amount} — ${player.life} left`)
}

function dealDamageToCard(state: GameState, card: GameCard, amount: number): void {
  if (amount <= 0) return
  card.damage += amount
}

/** Runs one effect. Triggers it causes are queued by the caller. */
export function applyEffect(ctx: EffectContext, effect: Effect): void {
  const { state } = ctx

  switch (effect.do) {
    case "damage": {
      const n = amountOf(ctx, effect.amount)
      for (const p of targetPlayers(ctx, effect.target)) damagePlayer(state, p, n)
      for (const c of resolveTargets(ctx, effect.target)) {
        dealDamageToCard(state, c, n)
        log(state, `${c.def.name} takes ${n}`)
      }
      break
    }

    case "draw": {
      const n = amountOf(ctx, effect.amount)
      for (const p of playersFor(ctx, effect.who)) {
        for (let i = 0; i < n; i++) {
          const player = state.players[p]
          const id = player.library.shift()
          if (id === undefined) {
            log(state, `${subject(player.name, "have")} no cards left to draw`)
            break
          }
          state.cards[id].zone = "hand"
          player.hand.push(id)
        }
        log(state, `${subject(state.players[p].name, "draw")} ${n}`)
      }
      break
    }

    case "gainLife": {
      const n = amountOf(ctx, effect.amount)
      for (const p of playersFor(ctx, effect.who)) {
        state.players[p].life += n
        log(state, `${subject(state.players[p].name, "gain")} ${n} — ${state.players[p].life} left`)
      }
      break
    }

    case "loseLife": {
      const n = amountOf(ctx, effect.amount)
      for (const p of playersFor(ctx, effect.who)) damagePlayer(state, p, n)
      break
    }

    case "token": {
      const n = amountOf(ctx, effect.count)
      for (let i = 0; i < n; i++) createToken(state, ctx.controller, effect.token)
      if (n > 0) {
        log(state, `${subject(state.players[ctx.controller].name, "create")} ${n} ${effect.token.name}`)
      }
      break
    }

    case "counters": {
      const n = amountOf(ctx, effect.amount)
      for (const c of resolveTargets(ctx, effect.target)) {
        c.counters[effect.counter] = (c.counters[effect.counter] ?? 0) + n
        log(state, `${c.def.name} gets ${n} ${effect.counter} counter${n === 1 ? "" : "s"}`)
      }
      break
    }

    case "destroy": {
      for (const c of resolveTargets(ctx, effect.target)) {
        if (c.def.keywords.includes("indestructible")) {
          log(state, `${c.def.name} is indestructible`)
          continue
        }
        log(state, `${c.def.name} is destroyed`)
        moveCard(state, c.id, "graveyard")
      }
      break
    }

    case "exile": {
      for (const c of resolveTargets(ctx, effect.target)) {
        log(state, `${c.def.name} is exiled`)
        moveCard(state, c.id, "exile")
      }
      break
    }

    case "bounce": {
      for (const c of resolveTargets(ctx, effect.target)) {
        log(state, `${c.def.name} returns to hand`)
        moveCard(state, c.id, "hand")
      }
      break
    }

    case "tap": {
      for (const c of resolveTargets(ctx, effect.target)) c.tapped = true
      break
    }

    case "untap": {
      for (const c of resolveTargets(ctx, effect.target)) c.tapped = false
      break
    }

    case "buff": {
      for (const c of resolveTargets(ctx, effect.target)) {
        c.untilEot.power += effect.power
        c.untilEot.toughness += effect.toughness
      }
      break
    }

    case "grant": {
      for (const c of resolveTargets(ctx, effect.target)) {
        if (!c.untilEot.keywords.includes(effect.keyword)) {
          c.untilEot.keywords.push(effect.keyword)
        }
      }
      break
    }

    case "mill": {
      const n = amountOf(ctx, effect.amount)
      for (const p of playersFor(ctx, effect.who)) {
        for (let i = 0; i < n; i++) {
          const id = state.players[p].library.shift()
          if (id === undefined) break
          state.cards[id].zone = "graveyard"
          state.players[p].graveyard.push(id)
        }
      }
      break
    }

    case "sacrifice": {
      for (const c of resolveTargets(ctx, effect.target)) {
        log(state, `${c.def.name} is sacrificed`)
        moveCard(state, c.id, "graveyard")
      }
      break
    }

    case "returnFromGraveyard": {
      const player = state.players[ctx.controller]
      const id = player.graveyard[player.graveyard.length - 1]
      if (id !== undefined) {
        log(state, `${state.cards[id].def.name} returns from the graveyard`)
        moveCard(state, id, "hand")
      }
      break
    }

    case "reanimate": {
      // The best creature in either graveyard, which is what the card is for.
      const pools = playersFor(ctx, effect.who)
      let best: GameCard | undefined
      for (const p of pools) {
        for (const id of state.players[p].graveyard) {
          const card = state.cards[id]
          if (!card || !card.def.types.includes("Creature")) continue
          if (!best || (card.def.cmc ?? 0) > (best.def.cmc ?? 0)) best = card
        }
      }
      if (!best) {
        log(state, "no creature in a graveyard to return")
        break
      }
      // Controller is set before the move: moveCard files the card under
      // whoever controls it, so setting it afterwards puts it on the wrong side.
      best.controller = ctx.controller
      moveCard(state, best.id, "battlefield")
      best.sick = true
      // An Aura that brings a creature back attaches itself to it, so the two
      // are linked: when the creature dies, the Aura goes with it.
      if (ctx.source?.def.attach?.kind === "aura") ctx.source.attachedTo = best.id
      log(state, `${best.def.name} returns to the battlefield`)
      break
    }

    case "tutor": {
      const player = state.players[ctx.controller]
      const idx = player.library.findIndex((id) => {
        const c = state.cards[id]
        return c && matches(c, effect.filter, ctx.source)
      })
      if (idx === -1) {
        log(state, `nothing in the library to find`)
        break
      }
      const [id] = player.library.splice(idx, 1)
      const card = state.cards[id]
      if (effect.to === "battlefield") {
        card.zone = "battlefield"
        card.sick = true
        player.battlefield.push(id)
        log(state, `${card.def.name} enters from the library`)
      } else {
        card.zone = "hand"
        player.hand.push(id)
        log(state, `${card.def.name} is found`)
      }
      break
    }

    case "preventCombatDamage": {
      state.preventCombatDamage = true
      log(state, "combat damage is prevented this turn")
      break
    }

    case "unimplemented": {
      log(state, `${ctx.source?.def.name ?? "a card"}: ${effect.note}`, true)
      break
    }
  }
}

export { cardDef, cardsIn }
