"use client"

import { useCallback, useRef, useState } from "react"
import { Cost } from "./CardFace"
import { DECKS, cardDef } from "@/lib/mtg/cards"
import { createGame } from "@/lib/mtg/state"
import {
  canCast,
  canEquip,
  canPlayLand,
  canTapForMana,
  castSpell,
  equip,
  manaAbilityOf,
  maxX,
  playLand,
  tapForMana,
} from "@/lib/mtg/actions"
import { hasX, parseCost } from "@/lib/mtg/mana"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
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
import { KERNEL_DECKS, KERNEL_DECK_IDS } from "@/lib/mtg/sets/kernel"
import { keywordName, lifeName, typeLine, type Flavour } from "@/lib/mtg/flavour"
import type { GameCard, GameState, Pool } from "@/lib/mtg/types"

const flavourOf = (deckId: string): Flavour =>
  KERNEL_DECK_IDS.includes(deckId) ? "kernel" : "mtg"

/** Colour by how much of a card's text the engine runs. */
const ENCODED_MARK: Record<string, { label: string; colour: string } | null> = {
  full: null,
  vanilla: null,
  partial: { label: "partial", colour: "#d8b25e" },
  body: { label: "text inert", colour: "#c07a63" },
}

const deckName = (id: string): string => {
  const ours = KERNEL_DECKS.find((d) => d.id === id)
  if (ours) return ours.name
  const deck = DECKS.find((d) => d.id === id)
  if (!deck) return id
  return (cardDef(deck.commander)?.name ?? deck.commander).split(",")[0]
}

export default function Duel({ winId }: { winId: string }) {
  const [state, setState] = useState<GameState | null>(null)
  const [waiting, setWaiting] = useState<Waiting>({ for: "player-main" })
  const [attackers, setAttackers] = useState<number[]>([])
  const [blocks, setBlocks] = useState<Record<number, number>>({})
  const [picking, setPicking] = useState<number | null>(null)
  /** The attacker blockers are currently being assigned to. */
  const [blockTarget, setBlockTarget] = useState<number | null>(null)
  /** The Equipment waiting to be put on a creature. */
  const [equipping, setEquipping] = useState<number | null>(null)
  /** The permanent under the cursor, which the keyboard acts on. */
  const [hovered, setHovered] = useState<number | null>(null)
  /** Which zone is open in the side panel. */
  const [openZone, setOpenZone] = useState<"graveyard" | "exile" | "log">("log")
  /** An X spell waiting for a value, and the value being chosen. */
  const [choosingX, setChoosingX] = useState<{ card: number; value: number } | null>(null)
  const [inspect, setInspect] = useState<GameCard | null>(null)
  const seed = useRef(Math.floor(Math.random() * 100000))

  const start = useCallback((mine: string) => {
    const ours = KERNEL_DECK_IDS.includes(mine)
    const pool = ours ? KERNEL_DECK_IDS : DECKS.map((d) => d.id)
    const theirs = pool.find((id) => id !== mine) ?? mine
    const g = createGame(mine, theirs, ["you", "opponent"], {
      seed: seed.current,
      // A forty-card duel is a shorter game than a hundred-card Commander one.
      life: ours ? 20 : 40,
    })
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

  /**
   * Tapping is manual, on whatever is under the cursor.
   *
   * `t` taps a source for mana and untaps it again if it was already tapped;
   * `u` untaps everything, which is what a Seedborn Muse effect amounts to
   * while the engine cannot grant one properly.
   */
  useWindowKeys(winId, (e) => {
    if (!state || state.winner !== null) return
    const board = state.players[HUMAN].battlefield
      .map((id) => state.cards[id])
      .filter(Boolean)
    const key = e.key.toLowerCase()

    if (key === "t" && hovered !== null) {
      e.preventDefault()
      const card = state.cards[hovered]
      if (!card || card.controller !== HUMAN) return
      if (card.tapped) card.tapped = false
      else if (canTapForMana(state, card.id) === null) tapForMana(state, card.id)
      else card.tapped = true
      commit(state, waiting)
      return
    }

    if (key === "u") {
      e.preventDefault()
      for (const card of board) card.tapped = false
      commit(state, waiting)
      return
    }

    if (key === "escape") {
      setPicking(null)
      setEquipping(null)
      setBlockTarget(null)
    }
  })

  if (!state) return <DeckPicker onPick={start} />

  const me = state.players[HUMAN]
  const them = state.players[AI]
  const flavour = flavourOf(me.deckId)
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

    // An X spell asks how much before anything else happens.
    if (hasX(parseCost(card.def.cost)) && choosingX?.card !== card.id) {
      setChoosingX({ card: card.id, value: maxX(state, card.id) })
      return
    }

    // A spell that chooses a target waits for one to be clicked.
    const needsTarget = card.def.abilities.some(
      (a) => a.kind === "spell" && a.effects.some((e) => "target" in e && e.target?.chosen)
    )
    if (needsTarget && picking !== card.id) {
      setPicking(card.id)
      return
    }
    setPicking(null)
    const x = choosingX?.card === card.id ? choosingX.value : 0
    setChoosingX(null)
    castSpell(state, card.id, [], x)
    commit(state, runUntilPlayer(state))
  }

  const castAt = (target: GameCard) => {
    if (picking === null) return
    // Hexproof stops the choice being made at all, rather than fizzling later.
    if (!canTarget(state, target, HUMAN)) return
    const x = choosingX?.card === picking ? choosingX.value : 0
    castSpell(state, picking, [{ kind: "card", id: target.id }], x)
    setPicking(null)
    setChoosingX(null)
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

  /** Whether anything the player controls could block at all. */
  const canBlockAnything = Object.values(state.cards).some(
    (attacker) =>
      attacker.attacking && cards(me.battlefield).some((c) => canBlock(state, c, attacker))
  )

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
          lifeLabel={lifeName(flavour)}
          zones={{
            graveyard: them.graveyard.length,
            exile: them.exile.length,
            command: them.command.length,
          }}
        />
        <Battlefield
          state={state}
          cards={cards(them.battlefield)}
          flavour={flavour}
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
            // An attacker used to be marked only by its border colour, which
            // left nothing to tell you what was worth clicking.
            if (n === 0) return menace ? "attacking · needs 2" : "attacking"
            return menace && n === 1 ? `${n} blocker — needs 2` : `blocked by ${n}`
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
                  ? !canBlockAnything
                    ? "nothing you control can block"
                    : blockTarget === null
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
          flavour={flavour}
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
          onHover={setHovered}
          badge={(c) => {
            const blocking = blocks[c.id]
            if (blocking !== undefined) {
              return `blocks ${state.cards[blocking]?.def.name.split(",")[0].split(" ")[0] ?? ""}`
            }
            if (waiting.for === "player-blockers" && blockTarget !== null) {
              const attacker = state.cards[blockTarget]
              if (attacker && c.def.types.includes("Creature")) {
                return canBlock(state, c, attacker) ? "can block" : "cannot block"
              }
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
          lifeLabel={lifeName(flavour)}
          pool={me.pool}
          zones={{
            graveyard: me.graveyard.length,
            exile: me.exile.length,
            command: me.command.length,
          }}
          onZone={(z) => setOpenZone((cur) => (cur === z ? "log" : z))}
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
                flavour={flavour}
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
              flavour={flavour}
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
                  ? `confirm ${Object.keys(blocks).length} block${
                      Object.keys(blocks).length === 1 ? "" : "s"
                    }`
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
          {choosingX !== null && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span style={{ color: "#e4e0ee" }}>
                X for {state.cards[choosingX.card]?.def.name}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(0, maxX(state, choosingX.card))}
                value={choosingX.value}
                onChange={(e) =>
                  setChoosingX({ card: choosingX.card, value: Number(e.target.value) })
                }
                style={{ width: 110 }}
              />
              <span style={{ color: "#ffd166", fontWeight: 700, width: 18 }}>
                {choosingX.value}
              </span>
              <button
                type="button"
                className="seg on-dark"
                onClick={() => {
                  const card = state.cards[choosingX.card]
                  if (card) playFromHand(card)
                }}
              >
                cast
              </button>
            </span>
          )}
          {(picking !== null || equipping !== null || blockTarget !== null || choosingX !== null) && (
            <button
              type="button"
              className="seg on-dark"
              onClick={() => {
                setPicking(null)
                setEquipping(null)
                setBlockTarget(null)
                setChoosingX(null)
              }}
            >
              cancel
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#6f6688" }}>
            {waiting.for === "player-blockers"
              ? "pick an attacker, then the creatures that block it"
              : "click to play · t taps for mana · u untaps all · right-click inspects"}
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

        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "5px 8px",
            borderBottom: "1px solid rgba(160,140,220,0.2)",
          }}
        >
          {(["log", "graveyard", "exile"] as const).map((z) => (
            <button
              key={z}
              type="button"
              className="seg on-dark"
              data-active={openZone === z ? "" : undefined}
              style={{ fontSize: 10, padding: "2px 7px" }}
              onClick={() => setOpenZone(z)}
            >
              {z}
            </button>
          ))}
        </div>

        <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "8px 10px", fontSize: 11 }}>
          {openZone === "log" ? (
            state.log.slice(-70).map((entry, i) => (
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
            ))
          ) : (
            <ZoneList
              you={cards(openZone === "graveyard" ? me.graveyard : me.exile)}
              them={cards(openZone === "graveyard" ? them.graveyard : them.exile)}
              onInspect={setInspect}
            />
          )}
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
        overflowY: "auto",
      }}
    >
      <div style={{ maxWidth: 620, padding: 24 }}>
        <div style={{ fontSize: 20, letterSpacing: "0.06em", marginBottom: 16, textAlign: "center" }}>
          a duel
        </div>

        <section style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 12, letterSpacing: "0.14em", color: "#cbb8f0", margin: "0 0 4px" }}>
            KERNEL
          </h3>
          <p style={{ fontSize: 11.5, color: "#9c92b8", lineHeight: 1.6, margin: "0 0 10px" }}>
            A set built for this engine, so every card does exactly what it says.
            Two processes fight for a machine: creatures are processes, lands are
            volumes, life is uptime. Forty cards, twenty uptime.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {KERNEL_DECKS.map((d) => (
              <button
                key={d.id}
                type="button"
                className="seg on-dark"
                onClick={() => onPick(d.id)}
                title={d.blurb}
                style={{ flexDirection: "column" }}
              >
                {d.name}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: "#6f6688", marginTop: 6 }}>
            {KERNEL_DECKS.map((d) => `${d.name}: ${d.blurb}`).join(" · ")}
          </div>
        </section>

        <section>
          <h3 style={{ fontSize: 12, letterSpacing: "0.14em", color: "#d8b25e", margin: "0 0 4px" }}>
            YOUR COMMANDER DECKS
          </h3>
          <p style={{ fontSize: 11.5, color: "#9c92b8", lineHeight: 1.6, margin: "0 0 10px" }}>
            The real hundred-card lists. Every card is here with its printed body
            and keywords, but roughly a third of the rules text is more than this
            engine runs — those cards are marked, and the log says so when one of
            them does nothing.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DECKS.map((d) => (
              <button key={d.id} type="button" className="seg on-dark" onClick={() => onPick(d.id)}>
                {deckName(d.id)}
              </button>
            ))}
          </div>
        </section>
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
  lifeLabel,
  pool,
  zones,
  onZone,
}: {
  name: string
  life: number
  hand: number
  library: number
  align: "top" | "bottom"
  lifeLabel: string
  pool?: Pool
  zones?: { graveyard: number; exile: number; command: number }
  onZone?: (z: "graveyard" | "exile") => void
}) {
  const floating = pool
    ? (Object.entries(pool) as [string, number][]).filter(([, n]) => n > 0)
    : []
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "5px 10px",
        fontSize: 11,
        color: "#9c92b8",
        flexWrap: "wrap",
        borderBottom: align === "top" ? "1px solid rgba(160,140,220,0.14)" : undefined,
        borderTop: align === "bottom" ? "1px solid rgba(160,140,220,0.14)" : undefined,
      }}
    >
      <span style={{ color: "#e4e0ee" }}>{name}</span>
      <span style={{ color: life <= 10 ? "#e07a63" : "#8fe0a0", fontWeight: 700 }}>
        {life} {lifeLabel}
      </span>
      <span>{hand} hand</span>
      <span>{library} library</span>
      {zones && (
        <>
          <ZoneChip label="graveyard" n={zones.graveyard} onClick={() => onZone?.("graveyard")} />
          <ZoneChip label="exile" n={zones.exile} onClick={() => onZone?.("exile")} />
          <ZoneChip label="command" n={zones.command} />
        </>
      )}
      {pool && (
        <span style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ color: "#6f6688" }}>mana</span>
          {floating.length === 0 ? (
            <span style={{ color: "#6f6688" }}>—</span>
          ) : (
            floating.map(([sym, n]) => (
              <span key={sym} style={{ color: "#ffd166", fontWeight: 700 }}>
                {n}
                {sym}
              </span>
            ))
          )}
        </span>
      )}
    </div>
  )
}

function ZoneChip({ label, n, onClick }: { label: string; n: number; onClick?: () => void }) {
  const content = `${label} ${n}`
  if (!onClick) return <span style={{ color: n ? "#9c92b8" : "#5d5578" }}>{content}</span>
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        font: "inherit",
        fontSize: 11,
        background: "none",
        border: 0,
        padding: 0,
        cursor: "pointer",
        textDecoration: n ? "underline dotted" : "none",
        color: n ? "#b7abd6" : "#5d5578",
      }}
    >
      {content}
    </button>
  )
}

function Battlefield({
  state,
  cards,
  onClick,
  highlight,
  badge,
  flavour,
  onHover,
  onInspect,
}: {
  state: GameState
  cards: GameCard[]
  onClick: (c: GameCard) => void
  highlight: (c: GameCard) => string | null
  badge?: (c: GameCard) => string | null
  flavour: Flavour
  onHover?: (id: number | null) => void
  onInspect: (c: GameCard) => void
}) {
  const lands = cards.filter((c) => c.def.types.includes("Land"))
  const rest = cards.filter((c) => !c.def.types.includes("Land"))
  return (
    <div style={{ flex: "1 1 auto", minHeight: 96, padding: "6px 10px", overflowY: "auto" }}>
      <Row cards={rest} state={state} onClick={onClick} highlight={highlight} badge={badge} flavour={flavour} onHover={onHover} onInspect={onInspect} />
      <Row cards={lands} state={state} onClick={onClick} highlight={highlight} flavour={flavour} onHover={onHover} onInspect={onInspect} small />
    </div>
  )
}

function Row({
  cards,
  state,
  onClick,
  highlight,
  badge,
  flavour,
  onHover,
  onInspect,
  small,
}: {
  cards: GameCard[]
  state: GameState
  onClick: (c: GameCard) => void
  highlight: (c: GameCard) => string | null
  badge?: (c: GameCard) => string | null
  flavour: Flavour
  onHover?: (id: number | null) => void
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
          flavour={flavour}
          onClick={() => onClick(c)}
          onHover={onHover}
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
  flavour,
  onHover,
  onClick,
  onInspect,
}: {
  card: GameCard
  state: GameState
  small?: boolean
  outline: string | null
  badge?: string | null
  flavour: Flavour
  onHover?: (id: number | null) => void
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
      onMouseEnter={() => onHover?.(card.id)}
      onMouseLeave={() => onHover?.(null)}
      onContextMenu={(e) => {
        e.preventDefault()
        onInspect()
      }}
      title={`${card.def.name}${manaAbilityOf(card) ? " — t to tap for mana" : ""}`}
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
          {kws.slice(0, 3).map((k) => keywordName(k, flavour)).join(" ")}
        </div>
      )}
      {badge && (
        <div
          style={{
            fontSize: 8,
            marginTop: 1,
            lineHeight: 1.2,
            color:
              badge.includes("needs") || badge.startsWith("cannot")
                ? "#e07a63"
                : badge === "attacking" || badge === "can block"
                  ? "#ffd166"
                  : "#7fb4e0",
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
  flavour,
  commander,
  onClick,
  onInspect,
}: {
  card: GameCard
  disabled: boolean
  reason: string | null
  selected: boolean
  flavour: Flavour
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
        {typeLine(card.def.types, flavour)}
        {card.def.power !== null && ` ${card.def.power}/${card.def.toughness}`}
      </div>
      {mark && <div style={{ fontSize: 8, color: mark.colour, marginTop: 1 }}>{mark.label}</div>}
    </button>
  )
}

/** The contents of a graveyard or exile, both sides. */
function ZoneList({
  you,
  them,
  onInspect,
}: {
  you: GameCard[]
  them: GameCard[]
  onInspect: (c: GameCard) => void
}) {
  const section = (label: string, list: GameCard[]) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#6f6688", marginBottom: 3 }}>
        {label.toUpperCase()} ({list.length})
      </div>
      {list.length === 0 ? (
        <div style={{ color: "#5d5578" }}>empty</div>
      ) : (
        list.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onInspect(c)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              font: "inherit",
              fontSize: 10.5,
              background: "none",
              border: 0,
              padding: "1px 0",
              color: "#9c92b8",
              cursor: "pointer",
            }}
          >
            {c.def.name}
          </button>
        ))
      )}
    </div>
  )
  return (
    <>
      {section("yours", you)}
      {section("opponent", them)}
    </>
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
