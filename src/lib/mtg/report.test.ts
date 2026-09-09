import { it, expect } from "vitest"
import { writeFileSync } from "node:fs"
import raw from "../mtg-data.json"
import { autoEncode } from "./encoded/auto"
import { encodedFor } from "./encoded"
import { allDefs, cardDef, deckList, DECKS } from "./cards"
import { KERNEL_CARDS, KERNEL_DECKS } from "./sets/kernel"
import type { CardDef } from "./types"

/**
 * One report on where the card pools stand, written to `card-report.txt`.
 *
 * Mostly not assertions — it exists so a decision about what to encode next can
 * be made from evidence rather than from a hunch. The two things it does assert
 * are the ones that would make a deck unplayable rather than merely incomplete.
 */
it("reports the state of both card pools", () => {
  const lines: string[] = []
  const runsSomething = (d: CardDef): boolean => d.abilities.some((a) => a.kind !== "mana")

  /* ── KERNEL: the set built for this engine ──────────────────────────── */

  const kernel = Object.values(KERNEL_CARDS)
  const notFull = kernel.filter((c) => c.encoded !== "full")
  lines.push("=== KERNEL ===")
  lines.push(`${kernel.length} cards across ${KERNEL_DECKS.length} decks`)
  lines.push(
    notFull.length === 0
      ? "every card fully implemented"
      : `NOT FULLY IMPLEMENTED: ${notFull.map((c) => c.name).join(", ")}`
  )

  /* ── The real Commander decks ───────────────────────────────────────── */

  lines.push("\n=== COMMANDER DECKS ===")
  for (const deck of DECKS) {
    const list = deckList(deck.id)!
    const seen = new Set<string>()
    const unique = [list.commander, ...list.cards]
      .map((n) => cardDef(n)!)
      .filter(Boolean)
      .filter((d) => (seen.has(d.name) ? false : seen.add(d.name)))

    const lands = unique.filter((d) => d.types.includes("Land"))
    const creatures = unique.filter((d) => d.types.includes("Creature"))
    const spells = unique.filter(
      (d) => !d.types.includes("Land") && !d.types.includes("Creature")
    )
    const working = spells.filter((d) => d.abilities.length > 0)

    lines.push(
      `\n${deck.id}: ${lands.filter((d) => d.abilities.some((a) => a.kind === "mana")).length}/${lands.length} lands make mana, ` +
        `${creatures.length} creature bodies, ${working.length}/${spells.length} other spells do something ` +
        `(distinct cards, not copies)`
    )
    const dead = spells.filter((d) => !runsSomething(d) && d.abilities.length === 0)
    for (const d of dead) {
      lines.push(`  DEAD  ${d.name} — ${d.cost} — ${d.text.replace(/\n/g, " / ").slice(0, 96)}`)
    }
  }

  const counts = { full: 0, partial: 0, body: 0, vanilla: 0 }
  for (const d of allDefs()) counts[d.encoded]++
  lines.push(
    `\ntext coverage over the Commander pool: ${counts.full} full, ` +
      `${counts.partial} partial, ${counts.body} body only`
  )

  /* ── What the parser still cannot read, by frequency ────────────────── */

  const cards = Object.values(
    (raw as unknown as { cards: Record<string, { name: string; text: string }> }).cards
  )
  const shapes = new Map<string, { n: number; sample: string }>()
  for (const c of cards) {
    const def = cardDef(c.name)
    // A hand-written entry replaces the parser for that card, so its text is
    // not "unparsed" — counting it would ask for work already done.
    if (!def || encodedFor(c.name)) continue
    const permanent = def.types.some((t) =>
      ["Creature", "Artifact", "Enchantment", "Land", "Planeswalker"].includes(t)
    )
    for (const line of autoEncode(c.text ?? "", c.name, permanent, def.keywords).leftover) {
      const shape = line.split(c.name).join("~").replace(/\d+/g, "N").split(/[ ,]/).slice(0, 4).join(" ")
      const entry = shapes.get(shape) ?? { n: 0, sample: `${c.name}: ${line.slice(0, 80)}` }
      entry.n++
      shapes.set(shape, entry)
    }
  }
  lines.push("\n=== most common sentences the parser cannot read ===")
  for (const [shape, e] of [...shapes.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 30)) {
    lines.push(`${String(e.n).padStart(3)}  ${shape.padEnd(30)} | ${e.sample}`)
  }

  writeFileSync("card-report.txt", lines.join("\n"))

  /* ── The two things that would break a deck rather than dent it ─────── */

  expect(notFull.map((c) => c.name).join(", "), "KERNEL cards must all be complete").toBe("")

  for (const deck of DECKS) {
    const list = deckList(deck.id)!
    const dead = [list.commander, ...list.cards]
      .map((n) => cardDef(n)!)
      .filter((d) => d?.types.includes("Land"))
      .filter((d) => !d.abilities.some((a) => a.kind === "mana"))
    expect(dead.length, `${deck.id} has lands that make no mana`).toBeLessThan(4)
  }
})
