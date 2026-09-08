"use client"

import { useEffect, useState } from "react"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
import {
  createGame,
  draw,
  move,
  canMove,
  cardsAt,
  autoTarget,
  autoplay,
  isRed,
  RANKS,
  SUITS,
  type Card,
  type Game,
  type Source,
  type Suit,
  type Target,
} from "./engine/solitaire"
import { GameFrame } from "./GameFrame"

const PIP: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" }
const CARD_W = 58
const CARD_H = 80
/** Vertical offset between stacked tableau cards. */
const FAN = 22
const FAN_DOWN = 12

function CardFace({
  card,
  selected,
  dim,
}: {
  card: Card
  selected?: boolean
  dim?: boolean
}) {
  if (!card.faceUp) {
    return (
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 4,
          border: "1px solid var(--icon-outline)",
          background:
            "repeating-linear-gradient(45deg, #2f5f9e 0 4px, #24497a 4px 8px)",
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: 4,
        border: `1px solid ${selected ? "var(--accent)" : "var(--icon-outline)"}`,
        boxShadow: selected ? "0 0 0 2px var(--accent-wash-strong)" : undefined,
        background: "#fbfdff",
        color: isRed(card.suit) ? "#c0392b" : "#16212e",
        opacity: dim ? 0.55 : 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "5px 6px",
        fontSize: 15,
        fontWeight: 700,
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      <span>
        {RANKS[card.rank - 1]}
        {PIP[card.suit]}
      </span>
      <span style={{ alignSelf: "flex-end", transform: "rotate(180deg)" }}>
        {RANKS[card.rank - 1]}
        {PIP[card.suit]}
      </span>
    </div>
  )
}

function Slot({
  children,
  onClick,
  label,
  highlight,
}: {
  children?: React.ReactNode
  onClick?: () => void
  label: string
  highlight?: boolean
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={-1}
      aria-label={label}
      style={{
        width: CARD_W,
        minHeight: CARD_H,
        borderRadius: 4,
        border: highlight
          ? "1px dashed var(--accent)"
          : "1px dashed var(--win-rule)",
        background: highlight ? "var(--accent-wash)" : "transparent",
        position: "relative",
        cursor: "pointer",
      }}
    >
      {children}
    </div>
  )
}

export default function Solitaire({
  winId,
  isMobile,
}: {
  winId: string
  isMobile: boolean
}) {
  const [game, setGame] = useState<Game>(() => createGame())
  const [sel, setSel] = useState<Source | null>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (game.won) return
    const id = setInterval(() => setElapsed((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [game.won])

  const restart = () => {
    setGame(createGame())
    setSel(null)
    setElapsed(0)
  }

  useWindowKeys(winId, (e) => {
    if (e.key === "Escape" && sel) {
      // Clear the selection rather than closing the window.
      e.preventDefault()
      setSel(null)
    } else if (e.key === "r") {
      e.preventDefault()
      restart()
    } else if (e.key === " ") {
      e.preventDefault()
      setGame(draw)
      setSel(null)
    } else if (e.key === "a") {
      e.preventDefault()
      setGame(autoplay)
      setSel(null)
    }
  })

  /** Click a source to pick it up, or a target to drop onto. */
  const onSource = (src: Source) => {
    if (sel && canMove(game, sel, targetOf(src))) {
      setGame(move(game, sel, targetOf(src)))
      setSel(null)
      return
    }
    setSel(cardsAt(game, src).length > 0 ? src : null)
  }

  const onTarget = (dst: Target) => {
    if (!sel) return
    if (canMove(game, sel, dst)) setGame(move(game, sel, dst))
    setSel(null)
  }

  const autoMove = (src: Source) => {
    const dst = autoTarget(game, src)
    if (dst) {
      setGame(move(game, src, dst))
      setSel(null)
    }
  }

  const selKey = sel ? JSON.stringify(sel) : null
  const isSel = (src: Source) => selKey === JSON.stringify(src)
  const accepts = (dst: Target) => Boolean(sel && canMove(game, sel, dst))

  return (
    <GameFrame
      status={
        <>
          <span>moves {game.moves}</span>
          <span style={{ color: game.won ? "#2c7a3f" : "var(--ink-faint)" }}>
            {game.won ? "you win" : sel ? "select a destination" : ""}
          </span>
          <span>
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </span>
        </>
      }
      hint={
        isMobile
          ? "tap a card, then tap where it goes · double-tap to send it home"
          : "click a card then its destination · double-click to auto-place · space draws · a autoplays · r restarts"
      }
    >
      <div style={{ overflow: "auto", padding: 4 }}>
        {/* Stock, waste, foundations */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <Slot
            label="stock"
            onClick={() => {
              setGame(draw)
              setSel(null)
            }}
          >
            {game.stock.length > 0 ? (
              <CardFace card={{ suit: "S", rank: 1, faceUp: false }} />
            ) : (
              <div
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  display: "grid",
                  placeItems: "center",
                  color: "var(--ink-faint)",
                  fontSize: 18,
                }}
              >
                ⟳
              </div>
            )}
          </Slot>

          <Slot label="waste">
            {game.waste.length > 0 && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  onSource({ from: "waste" })
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  autoMove({ from: "waste" })
                }}
              >
                <CardFace
                  card={game.waste[game.waste.length - 1]}
                  selected={isSel({ from: "waste" })}
                />
              </div>
            )}
          </Slot>

          <div style={{ flex: "1 1 auto" }} />

          {SUITS.map((suit) => {
            const pile = game.foundations[suit]
            const top = pile[pile.length - 1]
            return (
              <Slot
                key={suit}
                label={`${suit} foundation`}
                highlight={accepts({ to: "foundation", suit })}
                onClick={() =>
                  sel
                    ? onTarget({ to: "foundation", suit })
                    : top && onSource({ from: "foundation", suit })
                }
              >
                {top ? (
                  <CardFace
                    card={top}
                    selected={isSel({ from: "foundation", suit })}
                  />
                ) : (
                  <div
                    style={{
                      width: CARD_W,
                      height: CARD_H,
                      display: "grid",
                      placeItems: "center",
                      color: "var(--ink-faint)",
                      fontSize: 22,
                    }}
                  >
                    {PIP[suit]}
                  </div>
                )}
              </Slot>
            )
          })}
        </div>

        {/* Tableau */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          {game.tableau.map((pile, p) => {
            // Cards are absolutely positioned, so the column has no intrinsic
            // height. Without this the pile overlaps whatever follows it.
            const stackH = pile.reduce(
              (y, c) => y + (c.faceUp ? FAN : FAN_DOWN),
              0
            )
            return (
            <div
              key={p}
              style={{
                position: "relative",
                width: CARD_W,
                flex: "0 0 auto",
                minHeight: Math.max(CARD_H, stackH - FAN + CARD_H),
              }}
            >
              <Slot
                label={`pile ${p + 1}`}
                highlight={accepts({ to: "tableau", pile: p })}
                onClick={() => onTarget({ to: "tableau", pile: p })}
              />
              {pile.map((card, i) => {
                // Face-down cards sit tighter, so long piles stay in frame.
                const top = pile
                  .slice(0, i)
                  .reduce((y, c) => y + (c.faceUp ? FAN : FAN_DOWN), 0)
                const src: Source = { from: "tableau", pile: p, index: i }
                const run = cardsAt(game, src)
                return (
                  <div
                    key={`${card.suit}${card.rank}`}
                    style={{ position: "absolute", top, left: 0 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (sel) onTarget({ to: "tableau", pile: p })
                      else if (run.length > 0) onSource(src)
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      if (run.length === 1) autoMove(src)
                    }}
                  >
                    <CardFace
                      card={card}
                      selected={
                        sel?.from === "tableau" &&
                        sel.pile === p &&
                        i >= sel.index
                      }
                    />
                  </div>
                )
              })}
            </div>
            )
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button type="button" className="seg" onClick={restart}>
            new game
          </button>
          <button
            type="button"
            className="seg"
            onClick={() => {
              setGame(autoplay)
              setSel(null)
            }}
          >
            autoplay
          </button>
        </div>
      </div>
    </GameFrame>
  )
}

/** A source doubles as a target when you click a pile you could drop onto. */
function targetOf(src: Source): Target {
  if (src.from === "tableau") return { to: "tableau", pile: src.pile }
  if (src.from === "foundation") return { to: "foundation", suit: src.suit }
  // The waste is never a destination; this can never legally match.
  return { to: "tableau", pile: -1 }
}
