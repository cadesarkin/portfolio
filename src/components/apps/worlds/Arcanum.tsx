"use client"

import { useMemo, useState } from "react"
import {
  DECKS,
  cardByName,
  deckTitle,
  deckSize,
  manaCurve,
  colourSpread,
  typeSpread,
  averageCmc,
  sortedEntries,
  openPack,
  COLOUR_NAME,
  WUBRG,
  type Card,
  type Deck,
} from "@/lib/mtg"
import Duel from "./Duel"
import CardFace, { Cost } from "./CardFace"

const PIP_BG: Record<string, string> = {
  W: "#f6f2df",
  U: "#7fb4e0",
  B: "#4a4550",
  R: "#e07a63",
  G: "#78b57f",
  C: "#b9bfc4",
}

type Tab = "decks" | "packs" | "duel"

export default function Arcanum({ winId }: { winId: string }) {
  const [tab, setTab] = useState<Tab>("decks")
  const [deckId, setDeckId] = useState(DECKS[0]?.id ?? "")
  const deck = DECKS.find((d) => d.id === deckId) ?? DECKS[0]

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        color: "#e4e0ee",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "8px 12px",
          borderBottom: "1px solid rgba(160,140,220,0.24)",
          alignItems: "center",
          flexWrap: "wrap",
          background: "rgba(9, 6, 18, 0.72)",
        }}
      >
        {(["decks", "packs", "duel"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className="seg on-dark"
            data-active={tab === t ? "" : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
        <span style={{ width: 1, height: 18, background: "rgba(160,140,220,0.24)" }} />
        {tab === "decks" &&
          DECKS.map((d) => (
            <button
              key={d.id}
              type="button"
              className="seg on-dark"
              data-active={deckId === d.id ? "" : undefined}
              onClick={() => setDeckId(d.id)}
            >
              {deckTitle(d)}
            </button>
          ))}
      </div>

      {/* A scrim over the shelves. The scene is texture behind the cards, not
          something to read them through. */}
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "auto",
          background: "rgba(9, 6, 18, 0.84)",
        }}
      >
        {tab === "decks" ? <DeckView deck={deck} /> : tab === "packs" ? <PackView /> : <Duel winId={winId} />}
      </div>
    </div>
  )
}

/* ── Decks ───────────────────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", color: "#9c92b8", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function DeckView({ deck }: { deck: Deck }) {
  const curve = useMemo(() => manaCurve(deck), [deck])
  const colours = useMemo(() => colourSpread(deck), [deck])
  const types = useMemo(() => typeSpread(deck), [deck])
  const entries = useMemo(() => sortedEntries(deck), [deck])
  const commander = cardByName(deck.commander)
  const peak = Math.max(...curve.map((b) => b.count), 1)
  const colourTotal = WUBRG.reduce((n, c) => n + colours[c], 0) + colours.C

  return (
    <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        {commander && <CardFace card={commander} />}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", paddingTop: 4 }}>
          <Stat label="cards" value={String(deckSize(deck))} />
          <Stat label="avg cost" value={averageCmc(deck).toFixed(2)} />
          <Stat
            label="colours"
            value={
              WUBRG.filter((c) => colours[c] > 0)
                .map((c) => COLOUR_NAME[c])
                .join(" · ") || "colourless"
            }
          />
        </div>
      </div>

      {/* Mana curve, as bars. */}
      <section>
        <h3 style={sectionStyle}>mana curve</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {curve.map((b) => (
            <div key={b.cmc} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ width: 22, color: "#9c92b8", textAlign: "right" }}>
                {b.cmc === 7 ? "7+" : b.cmc}
              </span>
              <span
                style={{
                  height: 12,
                  width: `${(b.count / peak) * 74}%`,
                  minWidth: b.count ? 3 : 0,
                  background: "linear-gradient(90deg, #6f5bd0, #b07ad8)",
                }}
              />
              <span style={{ color: "#9c92b8" }}>{b.count || ""}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Colour identity across the whole list. */}
      <section>
        <h3 style={sectionStyle}>colour identity</h3>
        <div style={{ display: "flex", height: 16, overflow: "hidden", border: "1px solid rgba(160,140,220,0.3)" }}>
          {[...WUBRG, "C" as const]
            .filter((c) => colours[c] > 0)
            .map((c) => (
              <div
                key={c}
                title={`${COLOUR_NAME[c]}: ${colours[c]}`}
                style={{
                  width: `${(colours[c] / colourTotal) * 100}%`,
                  background: PIP_BG[c],
                }}
              />
            ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, color: "#9c92b8", flexWrap: "wrap" }}>
          {[...WUBRG, "C" as const]
            .filter((c) => colours[c] > 0)
            .map((c) => (
              <span key={c}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    background: PIP_BG[c],
                    marginRight: 5,
                  }}
                />
                {COLOUR_NAME[c]} {colours[c]}
              </span>
            ))}
        </div>
      </section>

      <section>
        <h3 style={sectionStyle}>composition</h3>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12 }}>
          {types.map((t) => (
            <span key={t.type}>
              <strong>{t.count}</strong>{" "}
              <span style={{ color: "#9c92b8" }}>{t.type.toLowerCase()}</span>
            </span>
          ))}
        </div>
      </section>

      <section>
        <h3 style={sectionStyle}>the ninety-nine</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "1px 18px",
          }}
        >
          {entries.map((e) => {
            const card = cardByName(e.name)
            if (!card) return null
            return (
              <div
                key={e.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "3px 0",
                  fontSize: 12,
                  borderBottom: "1px solid rgba(160,140,220,0.08)",
                }}
              >
                <span style={{ color: "#9c92b8", width: 16 }}>
                  {e.count > 1 ? `${e.count}×` : ""}
                </span>
                <span style={{ flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {card.name}
                </span>
                <Cost cost={card.cost} />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#9c92b8",
  margin: "0 0 8px",
  paddingBottom: 5,
  borderBottom: "1px solid rgba(160,140,220,0.2)",
}

/* ── Packs ───────────────────────────────────────────────────────────── */

function PackView() {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [revealed, setRevealed] = useState(0)

  const open = () => {
    // The rare goes last: a pack you flip through builds to the good one.
    const pack = openPack()
    setCards([...pack.cards].reverse())
    setRevealed(0)
  }

  return (
    <div style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <button type="button" className="seg on-dark" onClick={open}>
          {cards ? "open another" : "open a pack"}
        </button>
        {cards && revealed < cards.length && (
          <button
            type="button"
            className="seg on-dark"
            onClick={() => setRevealed(cards.length)}
          >
            reveal all
          </button>
        )}
        <span style={{ color: "#9c92b8", fontSize: 12 }}>
          {cards
            ? `${revealed} / ${cards.length} revealed`
            : "fourteen cards, drawn from the three decks"}
        </span>
      </div>

      {!cards && (
        <p style={{ color: "#9c92b8", fontSize: 12.5, maxWidth: "56ch", lineHeight: 1.6 }}>
          Not a real product — the pool is the 227 cards across Bears, Jetmir
          and Kaalia. The slots follow a booster though: one rare or mythic,
          three uncommons, ten commons.
        </p>
      )}

      {cards && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(212px, 1fr))",
            gap: 12,
          }}
        >
          {cards.map((c, i) =>
            i < revealed ? (
              <CardFace key={`${c.name}-${i}`} card={c} />
            ) : (
              <button
                key={`${c.name}-${i}`}
                type="button"
                onClick={() => setRevealed(i + 1)}
                disabled={i !== revealed}
                aria-label={i === revealed ? "Reveal the next card" : "Not yet"}
                style={{
                  minHeight: 130,
                  border: "1px solid rgba(160,140,220,0.35)",
                  background:
                    "repeating-linear-gradient(45deg, #1a1430 0 6px, #221a3e 6px 12px)",
                  color: i === revealed ? "#c9b8ff" : "#5a4f7a",
                  cursor: i === revealed ? "pointer" : "default",
                  font: "inherit",
                  fontSize: 12,
                  letterSpacing: "0.1em",
                }}
              >
                {i === revealed ? "flip" : ""}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
