import { it } from "vitest"
import { writeFileSync } from "node:fs"
import { DECKS, cardDef, deckList } from "./cards"
import type { CardDef } from "./types"

/**
 * What still does not work, per deck.
 *
 * Three grades, because they are different problems:
 *   dead    — cast it and nothing at all happens
 *   partial — some of the text runs, some does not
 *   inert   — a creature or land that is a body but whose text does nothing
 */
it("lists what does not work yet", () => {
  const lines: string[] = []
  const runsSomething = (d: CardDef): boolean =>
    d.abilities.some((a) => a.kind !== "mana")

  for (const deck of DECKS) {
    const list = deckList(deck.id)!
    const defs = [list.commander, ...list.cards]
      .map((n) => cardDef(n)!)
      .filter(Boolean)
    const seen = new Set<string>()
    const unique = defs.filter((d) => (seen.has(d.name) ? false : seen.add(d.name)))

    const spells = unique.filter(
      (d) => !d.types.includes("Land") && !d.types.includes("Creature")
    )
    const dead = spells.filter((d) => !runsSomething(d) && d.abilities.length === 0)
    // A mana rock whose only text is its mana ability works completely; only
    // list the ones with text beyond that which does nothing.
    const manaOnly = spells.filter(
      (d) => !runsSomething(d) && d.abilities.length > 0 && d.encoded !== "full"
    )
    const partial = unique.filter((d) => d.encoded === "partial")
    const inertCreatures = unique.filter(
      (d) => d.types.includes("Creature") && d.encoded === "body"
    )

    lines.push(`\n########## ${deck.id} ##########`)
    lines.push(`\n--- DEAD: cast it and nothing happens (${dead.length}) ---`)
    for (const d of dead) {
      lines.push(`  ${d.name} — ${d.cost} — ${d.text.replace(/\n/g, " / ").slice(0, 110)}`)
    }
    lines.push(`\n--- MANA ONLY: taps for mana, rest of the text dead (${manaOnly.length}) ---`)
    for (const d of manaOnly) lines.push(`  ${d.name} — ${d.cost}`)
    lines.push(`\n--- CREATURES that are only a body (${inertCreatures.length}) ---`)
    for (const d of inertCreatures) {
      lines.push(`  ${d.name} ${d.power}/${d.toughness} — ${d.text.replace(/\n/g, " / ").slice(0, 90)}`)
    }
    lines.push(`\n--- PARTIAL: some text runs (${partial.length}) ---`)
    for (const d of partial) lines.push(`  ${d.name}`)
  }

  writeFileSync("not-working.txt", lines.join("\n"))
})
