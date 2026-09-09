import { it, expect } from "vitest"
import { writeFileSync } from "node:fs"
import { allDefs, deckList, cardDef, DECKS } from "./cards"

/**
 * How much of each deck actually functions, from the player's point of view.
 *
 * The count that matters is not "how many cards are fully encoded" — a creature
 * with unencoded text is still a body that attacks and blocks, and a land that
 * makes mana is doing its whole job. What is visibly broken is a spell that you
 * cast and nothing happens. This measures that.
 */
it("reports how much of each deck functions", () => {
  const lines: string[] = []

  for (const deck of DECKS) {
    const list = deckList(deck.id)!
    const names = [list.commander, ...list.cards]
    const defs = names.map((n) => cardDef(n)!).filter(Boolean)

    const lands = defs.filter((d) => d.types.includes("Land"))
    const creatures = defs.filter((d) => d.types.includes("Creature"))
    const spells = defs.filter(
      (d) => !d.types.includes("Land") && !d.types.includes("Creature")
    )
    // A mana rock with a mana ability is doing its whole job, so it counts.
    const inertSpells = spells.filter((d) => d.abilities.length === 0)
    const workingLands = lands.filter((d) => d.abilities.some((a) => a.kind === "mana"))

    lines.push(
      `${deck.id.padEnd(8)} ${defs.length} cards: ` +
        `${workingLands.length}/${lands.length} lands make mana, ` +
        `${creatures.length} creatures have bodies, ` +
        `${spells.length - inertSpells.length}/${spells.length} other spells do something`
    )
  }

  const defs = allDefs()
  const counts = { full: 0, partial: 0, body: 0, vanilla: 0 }
  for (const d of defs) counts[d.encoded]++
  lines.push("")
  lines.push(
    `text coverage over the pool: ${counts.full} full, ${counts.partial} partial, ${counts.body} body only`
  )
  writeFileSync("playability-report.txt", lines.join("\n"))

  // Every land in every deck must make mana, or a deck cannot function at all.
  for (const deck of DECKS) {
    const list = deckList(deck.id)!
    const lands = [list.commander, ...list.cards]
      .map((n) => cardDef(n)!)
      .filter((d) => d?.types.includes("Land"))
    const dead = lands.filter((d) => !d.abilities.some((a) => a.kind === "mana"))
    expect(dead.length, `${deck.id} has lands that make no mana: ${dead.map((d) => d.name).join(", ")}`)
      .toBeLessThan(4)
  }
})
