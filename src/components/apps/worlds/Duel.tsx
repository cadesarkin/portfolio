"use client"

import { useCallback, useRef, useState } from "react"
import { Cost } from "./CardFace"
import { DECKS, cardDef } from "@/lib/mtg/cards"
import { createGame } from "@/lib/mtg/state"
import { canCast, canEquip, canPlayLand, castSpell, equip, playLand } from "@/lib/mtg/actions"
import {
  attachmentsOf,
  canTarget,
  hasKeyword,
  keywordsOf,
  powerOf,
  toughnessOf,
} from "@/lib/mtg/continuous"
import { canAttack, canBlock } from "@/lib/mtg/combat"
import {
  AI,
  HUMAN,
  passPhase,
  playerAttacks,
  playerBlocks,
  runUntilPlayer,
  type Waiting,
} from "@/lib/mtg/duel"
import type { GameCard, GameState } from "@/lib/mtg/types"

/** Colour by how much of a card's text the engine runs. */
const ENCODED_MARK: Record<string, { label: string; colour: string } | null> = {
  full: null,
  vanilla: null,
  partial: { label: "partial", colour: "#d8b25e" },
  body: { label: "text inert", colour: "#c07a63" },
}

const deckName = (id: string): string => {
  const deck = DECKS.find((d) => d.id === id)
  if (!deck) return id
  return (cardDef(deck.commander)?.name ?? deck.commander).split(",")[0]
}

export default function Duel() {
  const [state, setState] = useState<GameState | null>(null)
  const [waiting, setWaiting] = useState<Waiting>({ for: "player-main" })
  const [attackers, setAttackers] = useState<number[]>([])
  const [blocks, setBlocks] = useState<Record<number, number>>({})
  const [picking, setPicking] = useState<number | null>(null)
  /** The attacker blockers are currently being assigned to. */
  const [blockTarget, setBlockTarget] = useState<number | null>(null)
  /** The Equipment waiting to be put on a creature. */
  const [equipping, setEquipping] = useState<number | null>(null)
  const [inspect, setInspect] = useState<GameCard | null>(null)
  const seed = useRef(Math.floor(Math.random() * 100000))

  const start = useCallback((mine: string) => {
    const theirs = DECKS.find((d) => d.id !== mine)?.id ?? mine
    const g = createGame(mine, theirs, ["you", "opponent"], { seed: seed.current })
    setWaiting(runUntilPlayer(g))
    setState(g)
    setAttackers([])
    setBlocks({})
  }, [])

  /* Every engine call mutates the state object, so a new wrapper has to be
     handed to React or nothing re-renders. */
  const commit = useCallback((g: GameState, next: Waiting) => {
    setState({ ...g })
    setWaiting(next)
  }, [])

  if (!state) return <DeckPicker onPick={start} />

  const me = state.players[HUMAN]
  const them = state.players[AI]
  const cards = (ids: number[]): GameCard[] =>
    ids.map((id) => state.cards[id]).filter(Boolean)

  const playFromHand = (card: GameCard) => {
    if (card.def.types.includes("Land")) {
      if (canPlayLand(state, card.id) !== null) return
      playLand(state, card.id)
      commit(state, waiting)
      return
    }
    if (canCast(state, card.id) !== null) return
    // A spell that chooses a target waits for one to be clicked.
    const needsTarget = card.def.abilities.some(
      (a) => a.kind === "spell" && a.effects.some((e) => "target" in e && e.target?.chosen)
    )
    if (needsTarget && picking !== card.id) {
      setPicking(card.id)
      return
    }
    setPicking(null)
    castSpell(state, card.id)
    commit(state, runUntilPlayer(state))
  }

  const castAt = (target: GameCard) => {
    if (picking === null) return
    // Hexproof stops the choice being made at all, rather than fizzling later.
    if (!canTarget(state, target, HUMAN)) return
    castSpell(state, picking, [{ kind: "card", id: target.id }])
    setPicking(null)
    commit(state, runUntilPlayer(state))
  }

  const toggleAttacker = (card: GameCard) => {
    if (!canAttack(state, card)) return
    setAttackers((a) => (a.includes(card.id) ? a.filter((x) => x !== card.id) : [...a, card.id]))
  }

  /**
   * Blocks are assigned by picking an attacker, then clicking the creatures
   * that should block it.
   *
   * Cycling a blocker through the attackers on each click could never express
   * two creatures blocking one attacker, which is exactly what menace demands.
   */
  const toggleBlocker = (blocker: GameCard) => {
    if (blockTarget === null) return
    const attacker = state.cards[blockTarget]
    if (!attacker || !canBlock(state, blocker, attacker)) return
    setBlocks((b) => {
      const out = { ...b }
      if (out[blocker.id] === blockTarget) delete out[blocker.id]
      else out[blocker.id] = blockTarget
      return out
    })
  }

  const doEquip = (creature: GameCard) => {
    if (equipping === null) return
    if (canEquip(state, equipping, creature.id) !== null) return
    equip(state, equipping, creature.id)
    setEquipping(null)
    commit(state, waiting)
  }

  const confirmAttack = () => {
    commit(state, playerAttacks(state, attackers))
    setAttackers([])
  }

  const confirmBlocks = () => {
    commit(state, playerBlocks(state, blocks))
    setBlocks({})
    setBlockTarget(null)
  }

  /** How many creatures are set to block a given attacker. */
  const blockersOn = (attackerId: number): number =>
    Object.values(blocks).filter((id) => id === attackerId).length

  /** An attacker with menace needs two blockers or the block is thrown away. */
  const illegalBlocks = Object.values(state.cards)
    .filter((c) => c.attacking && hasKeyword(state, c, "menace"))
    .filter((c) => blockersOn(c.id) === 1)

  const pass = () => commit(state, passPhase(state))

  const over = state.winner !== null

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, background: "#0b0714" }}>
      <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Opponent */}
        <PlayerBar
          name={`${deckName(them.deckId)} (opponent)`}
          life={them.life}
          hand={them.hand.length}
          library={them.library.length}
          align="top"
        />
        <Battlefield
          state={state}
          cards={cards(them.battlefield)}
          onClick={(c) => {
            if (picking !== null) return castAt(c)
            if (waiting.for === "player-blockers" && c.attacking) {
              return setBlockTarget((t) => (t === c.id ? null : c.id))
            }
            setInspect(c)
          }}
          highlight={(c) =>
            blockTarget === c.id
              ? "#ffd166"
              : c.attacking
                ? "#e07a63"
                : picking !== null && canTarget(state, c, HUMAN)
                  ? "#d8b25e"
                  : null
          }
          badge={(c) => {
            if (!c.attacking) return null
            const n = blockersOn(c.id)
            const menace = hasKeyword(state, c, "menace")
            if (n === 0) return menace ? "menace" : null
            return menace && n === 1 ? `${n} — needs 2` : `blocked by ${n}`
          }}
          onInspect={setInspect}
        />

        <div
          style={{
            borderTop: "1px solid rgba(160,140,220,0.2)",
            borderBottom: "1px solid rgba(160,140,220,0.2)",
            padding: "4px 10px",
            fontSize: 11,
            color: "#9c92b8",
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span>turn {state.turn}</span>
          <span style={{ color: "#e4e0ee" }}>{state.phase}</span>
          <span>{state.active === HUMAN ? "your turn" : "opponent's turn"}</span>
          <span style={{ marginLeft: "auto" }}>
            {over
              ? state.winner === HUMAN
                ? "you win"
                : "you lose"
              : waiting.for === "player-attackers"
                ? "choose attackers"
                : waiting.for === "player-blockers"
                  ? blockTarget === null
                    ? "click an attacker to block it"
                    : `blocking ${state.cards[blockTarget]?.def.name} — click your creatures`
                  : equipping !== null
                    ? "click a creature to equip it"
                    : picking !== null
                      ? "choose a target"
                      : "your move"}
          </span>
        </div>

        {/* You */}
        <Battlefield
          state={state}
          cards={cards(me.battlefield)}
          onClick={(c) => {
            if (equipping !== null) return doEquip(c)
            if (picking !== null) return castAt(c)
            if (waiting.for === "player-attackers") return toggleAttacker(c)
            if (waiting.for === "player-blockers") return toggleBlocker(c)
            if (c.def.attach?.kind === "equipment") return setEquipping(c.id)
            setInspect(c)
          }}
          highlight={(c) =>
            equipping === c.id
              ? "#d8b25e"
              : attackers.includes(c.id)
                ? "#8fe0a0"
                : blocks[c.id] !== undefined
                  ? "#7fb4e0"
                  : null
          }
          badge={(c) => {
            const blocking = blocks[c.id]
            if (blocking !== undefined) {
              return `blocks ${state.cards[blocking]?.def.name.split(",")[0].split(" ")[0] ?? ""}`
            }
            if (c.attachedTo !== null) return "equipped"
            const worn = attachmentsOf(state, c)
            return worn.length ? `+${worn.length} equip` : null
          }}
          onInspect={setInspect}
        />
        <PlayerBar
          name={`${deckName(me.deckId)} (you)`}
          life={me.life}
          hand={me.hand.length}
          library={me.library.length}
          align="bottom"
        />

        {/* Hand */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "8px 10px",
            overflowX: "auto",
            borderTop: "1px solid rgba(160,140,220,0.2)",
            minHeight: 96,
          }}
        >
          {cards(me.hand).map((card) => {
            const refusal = card.def.types.includes("Land")
              ? canPlayLand(state, card.id)
              : canCast(state, card.id)
            return (
              <HandCard
                key={card.id}
                card={card}
                disabled={refusal !== null}
                reason={refusal}
                selected={picking === card.id}
                onClick={() => playFromHand(card)}
                onInspect={() => setInspect(card)}
              />
            )
          })}
          {cards(me.command).map((card) => (
            <HandCard
              key={card.id}
              card={card}
              disabled={canCast(state, card.id) !== null}
              reason={canCast(state, card.id)}
              selected={picking === card.id}
              commander
              onClick={() => playFromHand(card)}
              onInspect={() => setInspect(card)}
            />
          ))}
        </div>

        {/* Controls */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "8px 10px",
            borderTop: "1px solid rgba(160,140,220,0.2)",
            alignItems: "center",
          }}
        >
          {over ? (
            <button type="button" className="seg on-dark" onClick={() => setState(null)}>
              play again
            </button>
          ) : waiting.for === "player-attackers" ? (
            <button type="button" className="seg on-dark" onClick={confirmAttack}>
              {attackers.length ? `attack with ${attackers.length}` : "no attacks"}
            </button>
          ) : waiting.for === "player-blockers" ? (
            <>
              <button
                type="button"
                className="seg on-dark"
                onClick={confirmBlocks}
                disabled={illegalBlocks.length > 0}
                title={
                  illegalBlocks.length > 0
                    ? `${illegalBlocks[0].def.name} has menace and needs two blockers`
                    : undefined
                }
              >
                {Object.keys(blocks).length
                  ? `confirm ${Object.keys(blocks).length} blocks`
                  : "no blocks"}
              </button>
              {illegalBlocks.length > 0 && (
                <span style={{ fontSize: 11, color: "#e07a63" }}>
                  {illegalBlocks[0].def.name} has menace — two blockers or none
                </span>
              )}
            </>
          ) : (
            <button type="button" className="seg on-dark" onClick={pass}>
              next phase
            </button>
          )}
          {(picking !== null || equipping !== null || blockTarget !== null) && (
            <button
              type="button"
              className="seg on-dark"
              onClick={() => {
                setPicking(null)
                setEquipping(null)
                setBlockTarget(null)
              }}
            >
              cancel
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#6f6688" }}>
            {waiting.for === "player-blockers"
              ? "pick an attacker, then the creatures that block it"
              : "click a card to play it · right-click to inspect"}
          </span>
        </div>
      </div>

      {/* Log and the inspected card */}
      <aside
        style={{
          width: 232,
          flex: "0 0 232px",
          borderLeft: "1px solid rgba(160,140,220,0.2)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {inspect && <Inspector card={inspect} state={state} onClose={() => setInspect(null)} />}
        <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "8px 10px", fontSize: 11 }}>
          {state.log.slice(-70).map((entry, i) => (
            <div
              key={i}
              style={{
                color: entry.unimplemented ? "#c07a63" : "#9c92b8",
                padding: "1px 0",
                lineHeight: 1.35,
              }}
            >
              {entry.text}
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}

/* ── Pieces ───────────────────────────────────────────────────────────── */

function DeckPicker({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        height: "100%",
        background: "#0b0714",
        color: "#e4e0ee",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 520, padding: 20 }}>
        <div style={{ fontSize: 20, letterSpacing: "0.06em", marginBottom: 6 }}>a duel</div>
        <p style={{ fontSize: 12, color: "#9c92b8", lineHeight: 1.6, marginBottom: 18 }}>
          Pick a deck. The opponent plays another. Real turns, real combat, and the
          real hundred-card lists — every card is here, with its printed body and
          keywords. Cards whose rules text the engine does not run are marked, and
          the log says so when one of them does nothing.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {DECKS.map((d) => (
            <button key={d.id} type="button" className="seg on-dark" onClick={() => onPick(d.id)}>
              {deckName(d.id)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function PlayerBar({
  name,
  life,
  hand,
  library,
  align,
}: {
  name: string
  life: number
  hand: number
  library: number
  align: "top" | "bottom"
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "center",
        padding: "5px 10px",
        fontSize: 11,
        color: "#9c92b8",
        borderBottom: align === "top" ? "1px solid rgba(160,140,220,0.14)" : undefined,
        borderTop: align === "bottom" ? "1px solid rgba(160,140,220,0.14)" : undefined,
      }}
    >
      <span style={{ color: "#e4e0ee" }}>{name}</span>
      <span style={{ color: life <= 10 ? "#e07a63" : "#8fe0a0", fontWeight: 700 }}>{life} life</span>
      <span>{hand} in hand</span>
      <span>{library} in library</span>
    </div>
  )
}

function Battlefield({
  state,
  cards,
  onClick,
  highlight,
  badge,
  onInspect,
}: {
  state: GameState
  cards: GameCard[]
  onClick: (c: GameCard) => void
  highlight: (c: GameCard) => string | null
  badge?: (c: GameCard) => string | null
  onInspect: (c: GameCard) => void
}) {
  const lands = cards.filter((c) => c.def.types.includes("Land"))
  const rest = cards.filter((c) => !c.def.types.includes("Land"))
  return (
    <div style={{ flex: "1 1 auto", minHeight: 96, padding: "6px 10px", overflowY: "auto" }}>
      <Row cards={rest} state={state} onClick={onClick} highlight={highlight} badge={badge} onInspect={onInspect} />
      <Row cards={lands} state={state} onClick={onClick} highlight={highlight} onInspect={onInspect} small />
    </div>
  )
}

function Row({
  cards,
  state,
  onClick,
  highlight,
  badge,
  onInspect,
  small,
}: {
  cards: GameCard[]
  state: GameState
  onClick: (c: GameCard) => void
  highlight: (c: GameCard) => string | null
  badge?: (c: GameCard) => string | null
  onInspect: (c: GameCard) => void
  small?: boolean
}) {
  if (cards.length === 0) return null
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
      {cards.map((c) => (
        <Permanent
          key={c.id}
          card={c}
          state={state}
          small={small}
          outline={highlight(c)}
          badge={badge?.(c) ?? null}
          onClick={() => onClick(c)}
          onInspect={() => onInspect(c)}
        />
      ))}
    </div>
  )
}

function Permanent({
  card,
  state,
  small,
  outline,
  badge,
  onClick,
  onInspect,
}: {
  card: GameCard
  state: GameState
  small?: boolean
  outline: string | null
  badge?: string | null
  onClick: () => void
  onInspect: () => void
}) {
  const creature = card.def.types.includes("Creature")
  const mark = ENCODED_MARK[card.def.encoded]
  const kws = creature ? keywordsOf(state, card) : []
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onInspect()
      }}
      title={card.def.name}
      style={{
        font: "inherit",
        textAlign: "left",
        width: small ? 74 : 96,
        padding: "4px 5px",
        background: card.tapped ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${outline ?? "rgba(160,140,220,0.28)"}`,
        borderRadius: 3,
        color: "#e4e0ee",
        cursor: "pointer",
        opacity: card.tapped ? 0.55 : 1,
        transform: card.tapped ? "rotate(4deg)" : undefined,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          lineHeight: 1.25,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {card.def.name}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
        {creature && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#8fe0a0" }}>
            {powerOf(state, card)}/{toughnessOf(state, card)}
          </span>
        )}
        {card.damage > 0 && (
          <span style={{ fontSize: 9, color: "#e07a63" }}>-{card.damage}</span>
        )}
        {mark && <span style={{ fontSize: 8, color: mark.colour }}>{mark.label}</span>}
      </div>
      {kws.length > 0 && (
        <div style={{ fontSize: 8, color: "#9c92b8", marginTop: 1, lineHeight: 1.2 }}>
          {kws.slice(0, 3).join(" ")}
        </div>
      )}
      {badge && (
        <div
          style={{
            fontSize: 8,
            marginTop: 1,
            lineHeight: 1.2,
            color: badge.includes("needs") ? "#e07a63" : "#7fb4e0",
          }}
        >
          {badge}
        </div>
      )}
    </button>
  )
}

function HandCard({
  card,
  disabled,
  reason,
  selected,
  commander,
  onClick,
  onInspect,
}: {
  card: GameCard
  disabled: boolean
  reason: string | null
  selected: boolean
  commander?: boolean
  onClick: () => void
  onInspect: () => void
}) {
  const mark = ENCODED_MARK[card.def.encoded]
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onInspect()
      }}
      title={disabled && reason ? `${card.def.name} — ${reason}` : card.def.name}
      style={{
        font: "inherit",
        textAlign: "left",
        flex: "0 0 auto",
        width: 108,
        padding: "5px 6px",
        background: selected ? "rgba(203,184,240,0.22)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${
          selected ? "#cbb8f0" : commander ? "#d8b25e" : "rgba(160,140,220,0.3)"
        }`,
        borderRadius: 3,
        color: disabled ? "#6f6688" : "#e4e0ee",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
        <span
          style={{
            fontSize: 9.5,
            lineHeight: 1.25,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {card.def.name}
        </span>
        <Cost cost={card.def.cost} />
      </div>
      <div style={{ fontSize: 8.5, color: "#7d749a", marginTop: 3 }}>
        {card.def.types.join(" ")}
        {card.def.power !== null && ` ${card.def.power}/${card.def.toughness}`}
      </div>
      {mark && <div style={{ fontSize: 8, color: mark.colour, marginTop: 1 }}>{mark.label}</div>}
    </button>
  )
}

function Inspector({
  card,
  state,
  onClose,
}: {
  card: GameCard
  state: GameState
  onClose: () => void
}) {
  const mark = ENCODED_MARK[card.def.encoded]
  return (
    <div
      style={{
        borderBottom: "1px solid rgba(160,140,220,0.2)",
        padding: "8px 10px",
        fontSize: 11,
        color: "#cfc8e0",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <strong style={{ fontSize: 12, color: "#e4e0ee" }}>{card.def.name}</strong>
        <button
          type="button"
          onClick={onClose}
          style={{ font: "inherit", background: "none", border: 0, color: "#7d749a", cursor: "pointer" }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 10, color: "#9c92b8", margin: "3px 0" }}>{card.def.text ? card.def.types.join(" ") : ""}</div>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45, fontSize: 10.5 }}>{card.def.text}</div>
      {card.def.types.includes("Creature") && (
        <div style={{ marginTop: 4, color: "#8fe0a0" }}>
          {powerOf(state, card)}/{toughnessOf(state, card)}
        </div>
      )}
      {mark && (
        <div style={{ marginTop: 4, fontSize: 10, color: mark.colour }}>
          {card.def.encoded === "body"
            ? "This card plays as its printed body; its rules text is not implemented."
            : "Some of this card's rules text is not implemented."}
        </div>
      )}
    </div>
  )
}
