/**
 * Fetches card data for every card in src/decks and writes src/lib/mtg-data.json.
 *
 * Run once when the decklists change:  node scripts/fetch-cards.mjs
 *
 * Baked at build time rather than fetched in the browser: the data never
 * changes between deploys, and a portfolio should not depend on a third-party
 * API being up to render a page.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const DECK_DIR = "src/decks"
const OUT = "src/lib/mtg-data.json"
// Scryfall asks for a descriptive agent and ~100ms between requests.
const HEADERS = {
  "User-Agent": "cadesarkin.com-portfolio/1.0",
  Accept: "application/json",
  "Content-Type": "application/json",
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** `1 Sol Ring` -> { count: 1, name: "Sol Ring" }. */
function parseLine(line) {
  const m = /^(\d+)\s+(.+?)\s*$/.exec(line)
  if (!m) return null
  return { count: Number(m[1]), name: m[2] }
}

function parseDeck(file) {
  const raw = readFileSync(join(DECK_DIR, file), "utf8")
  const lines = raw.split(/\r?\n/)
  const entries = []
  let commander = null

  for (const line of lines) {
    const parsed = parseLine(line.trim())
    if (!parsed) continue
    // The first entry is the commander; the rest is the ninety-nine.
    if (!commander) commander = parsed.name
    else entries.push(parsed)
  }
  return { id: file.replace(/\.txt$/, ""), commander, entries }
}

const decks = readdirSync(DECK_DIR)
  .filter((f) => f.endsWith(".txt"))
  .map(parseDeck)

const names = new Set()
for (const d of decks) {
  names.add(d.commander)
  for (const e of d.entries) names.add(e.name)
}
console.log(`${decks.length} decks, ${names.size} unique cards`)

/** Scryfall's collection endpoint takes 75 identifiers per request. */
async function fetchChunk(chunk) {
  const res = await fetch("https://api.scryfall.com/cards/collection", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      // Double-faced cards are looked up by their front face: Scryfall does
      // not resolve the "Front // Back" form by name.
      identifiers: chunk.map((name) => ({ name: name.split(" // ")[0] })),
    }),
  })
  if (!res.ok) throw new Error(`scryfall ${res.status}: ${await res.text()}`)
  return res.json()
}

const all = [...names]
const cards = {}
const missing = []

for (let i = 0; i < all.length; i += 75) {
  const chunk = all.slice(i, i + 75)
  const data = await fetchChunk(chunk)

  for (const c of data.data ?? []) {
    // Double-faced cards keep their costs on the faces.
    const face = c.card_faces?.[0]
    cards[c.name] = {
      name: c.name,
      cmc: c.cmc ?? 0,
      cost: c.mana_cost ?? face?.mana_cost ?? "",
      type: (c.type_line ?? face?.type_line ?? "").split(" — ")[0],
      fullType: c.type_line ?? face?.type_line ?? "",
      colors: c.color_identity ?? [],
      rarity: c.rarity ?? "common",
      set: (c.set ?? "").toUpperCase(),
      text: (c.oracle_text ?? face?.oracle_text ?? "").slice(0, 400),
      // Fields the duel engine needs. Power and toughness stay as printed
      // strings: "*" and "1+*" are real values and parsing them to a number
      // here would quietly turn them into NaN.
      power: c.power ?? face?.power ?? null,
      toughness: c.toughness ?? face?.toughness ?? null,
      loyalty: c.loyalty ?? face?.loyalty ?? null,
      keywords: c.keywords ?? [],
      subtypes: ((c.type_line ?? face?.type_line ?? "").split(" — ")[1] ?? "")
        .split(" ")
        .filter(Boolean),
      produces: c.produced_mana ?? [],
    }
  }
  for (const nf of data.not_found ?? []) missing.push(nf.name)

  console.log(`  ${Math.min(i + 75, all.length)}/${all.length}`)
  await sleep(120)
}

// Decklist names may differ from Scryfall's canonical name (e.g. one half of a
// split card). Resolve those so no deck entry ends up without data.
function resolve(name) {
  if (cards[name]) return name
  const front = name.split(" // ")[0]
  if (cards[front]) return front
  const hit = Object.keys(cards).find((k) => k.split(" // ")[0] === front)
  return hit ?? null
}

const unresolved = []
for (const d of decks) {
  for (const n of [d.commander, ...d.entries.map((e) => e.name)]) {
    if (!resolve(n)) unresolved.push(n)
  }
}

const out = {
  generated: new Date().toISOString().slice(0, 10),
  decks: decks.map((d) => ({
    id: d.id,
    commander: resolve(d.commander) ?? d.commander,
    entries: d.entries.map((e) => ({
      count: e.count,
      name: resolve(e.name) ?? e.name,
    })),
  })),
  cards,
}

writeFileSync(OUT, JSON.stringify(out, null, 0))
console.log(`wrote ${OUT}: ${Object.keys(cards).length} cards`)
if (missing.length) console.log("not found:", missing)
if (unresolved.length) console.log("UNRESOLVED:", unresolved)
