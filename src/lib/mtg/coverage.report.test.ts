import { it } from "vitest"
import { writeFileSync } from "node:fs"
import raw from "../mtg-data.json"
import { autoEncode } from "./encoded/auto"
import { cardDef, allDefs } from "./cards"
import { encodedFor } from "./encoded"

/**
 * Not an assertion — a report of what the parser cannot read yet, ranked by how
 * often each shape of sentence turns up. This is how the next batch of patterns
 * gets chosen: by frequency, not by guesswork.
 *
 * Written to a file rather than logged, because vitest swallows stdout from a
 * test that passes and this report is the whole point of the test.
 */
it("reports the most common unparsed lines", () => {
  const cards = Object.values(
    (raw as unknown as { cards: Record<string, { name: string; text: string }> }).cards
  )
  const shapes = new Map<string, { n: number; sample: string }>()

  for (const c of cards) {
    const def = cardDef(c.name)
    if (!def) continue
    // A hand-written entry replaces the parser for that card, so its text is
    // not "unparsed" — counting it here would ask for work already done.
    if (encodedFor(c.name)) continue
    const permanent = def.types.some((t) =>
      ["Creature", "Artifact", "Enchantment", "Land", "Planeswalker"].includes(t)
    )
    const auto = autoEncode(c.text ?? "", c.name, permanent, def.keywords)
    for (const line of auto.leftover) {
      const shape = line
        .split(c.name)
        .join("~")
        .replace(/\d+/g, "N")
        .split(/[ ,]/)
        .slice(0, 4)
        .join(" ")
      const entry = shapes.get(shape) ?? { n: 0, sample: `${c.name}: ${line.slice(0, 84)}` }
      entry.n++
      shapes.set(shape, entry)
    }
  }

  const lines: string[] = ["--- most common unparsed shapes ---"]
  for (const [shape, e] of [...shapes.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40)) {
    lines.push(`${String(e.n).padStart(3)}  ${shape.padEnd(32)} | ${e.sample}`)
  }

  const defs = allDefs()
  const counts = { full: 0, partial: 0, body: 0, vanilla: 0 }
  for (const d of defs) counts[d.encoded]++
  lines.push("")
  lines.push(
    `coverage: ${counts.full} full, ${counts.partial} partial, ` +
      `${counts.vanilla} no text, ${counts.body} body only, of ${defs.length}`
  )

  writeFileSync("coverage-report.txt", lines.join("\n"))
})
