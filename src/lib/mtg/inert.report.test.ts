import { it } from "vitest"
import { writeFileSync } from "node:fs"
import { DECKS, cardDef, deckList } from "./cards"

/** Lists the non-creature spells that currently resolve and do nothing. */
it("lists inert spells worth encoding", () => {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const deck of DECKS) {
    const list = deckList(deck.id)!
    const inert = [list.commander, ...list.cards]
      .map((n) => cardDef(n)!)
      .filter(Boolean)
      .filter((d) => !d.types.includes("Land") && !d.types.includes("Creature"))
      .filter(
        (d) =>
          !d.abilities.some(
            (a) => a.kind === "spell" || a.kind === "static" || a.kind === "triggered"
          )
      )
    lines.push(`\n=== ${deck.id} (${inert.length}) ===`)
    for (const d of inert) {
      if (seen.has(d.name)) continue
      seen.add(d.name)
      lines.push(`${d.name} | ${d.cost} | ${d.types.join(" ")} | ${d.text.replace(/\n/g, " ⏎ ").slice(0, 150)}`)
    }
  }
  writeFileSync("inert-report.txt", lines.join("\n"))
})
