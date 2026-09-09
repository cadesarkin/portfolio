"use client"

import { costSymbols, type Card } from "@/lib/mtg"

/** Pip colours, close to the printed ones but legible on a dark panel. */
const PIP: Record<string, { bg: string; fg: string }> = {
  W: { bg: "#f6f2df", fg: "#2a2418" },
  U: { bg: "#7fb4e0", fg: "#0b2233" },
  B: { bg: "#4a4550", fg: "#e6e2ea" },
  R: { bg: "#e07a63", fg: "#33110c" },
  G: { bg: "#78b57f", fg: "#0f2a13" },
  C: { bg: "#b9bfc4", fg: "#22282c" },
}

export function Pip({ symbol }: { symbol: string }) {
  // Hybrid and phyrexian pips take the colour of their first half.
  const key = symbol.split("/")[0]
  const style = PIP[key] ?? PIP.C
  const numeric = /^\d+$/.test(symbol) || symbol === "X"
  return (
    <span
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 15,
        height: 15,
        borderRadius: "50%",
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        background: numeric ? PIP.C.bg : style.bg,
        color: numeric ? PIP.C.fg : style.fg,
        marginLeft: 2,
      }}
    >
      {symbol.replace("/P", "φ").slice(0, 3)}
    </span>
  )
}

export function Cost({ cost }: { cost: string }) {
  const symbols = costSymbols(cost)
  if (symbols.length === 0) return null
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      {symbols.map((s, i) => (
        <Pip key={i} symbol={s} />
      ))}
    </span>
  )
}

const RARITY_COLOUR: Record<string, string> = {
  common: "#b9bfc4",
  uncommon: "#a8b8c8",
  rare: "#d8b25e",
  mythic: "#e07a3c",
}

/** The frame colour follows the card's colour identity. */
function frameColour(card: Card): string {
  if (card.colors.length === 0) return "#8c9298"
  if (card.colors.length > 1) return "#d8b25e" // gold, as multicolour cards are
  return PIP[card.colors[0]]?.bg ?? "#8c9298"
}

/**
 * A card rendered as a frame rather than an image.
 *
 * Deliberately not the real art: card images would drag the whole page out of
 * the ASCII language the rest of the site is written in, and would hotlink
 * hundreds of files. The frame carries everything you actually read a card for.
 */
export default function CardFace({
  card,
  compact,
}: {
  card: Card
  compact?: boolean
}) {
  const accent = frameColour(card)
  return (
    <div
      style={{
        border: `1px solid ${accent}`,
        borderLeft: `3px solid ${accent}`,
        background: "rgba(12, 10, 22, 0.82)",
        color: "#e4e0ee",
        padding: compact ? "5px 8px" : "8px 10px",
        width: compact ? "auto" : 210,
        minHeight: compact ? 0 : 130,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ flex: "1 1 auto", fontWeight: 700, lineHeight: 1.25 }}>
          {card.name}
        </span>
        <Cost cost={card.cost} />
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#a99fc0",
          borderTop: `1px solid ${accent}44`,
          borderBottom: compact ? "none" : `1px solid ${accent}44`,
          padding: "3px 0",
        }}
      >
        {card.fullType}
      </div>

      {!compact && (
        <>
          <div
            style={{
              flex: "1 1 auto",
              fontSize: 11,
              lineHeight: 1.45,
              color: "#c9c2da",
              overflow: "hidden",
            }}
          >
            {card.text.split("\n").slice(0, 4).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: RARITY_COLOUR[card.rarity] ?? "#b9bfc4",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            <span>{card.set}</span>
            <span>{card.rarity}</span>
          </div>
        </>
      )}
    </div>
  )
}
