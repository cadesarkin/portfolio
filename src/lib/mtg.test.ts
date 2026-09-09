import { describe, it, expect } from "vitest"
import {
  DECKS,
  CARDS,
  cardByName,
  deckTitle,
  deckSize,
  manaCurve,
  colourSpread,
  typeSpread,
  averageCmc,
  sortedEntries,
  costSymbols,
  openPack,
  isLand,
  PACK_SIZE,
  LANDS_PER_PACK,
  UNCOMMONS_PER_PACK,
} from "./mtg"

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe("deck data", () => {
  it("loads all three decks", () => {
    expect(DECKS).toHaveLength(3)
    expect(DECKS.map((d) => d.id).sort()).toEqual(["bears", "jetmir", "kaalia"])
  })

  it("gives every deck a commander", () => {
    for (const d of DECKS) expect(d.commander).toBeTruthy()
  })

  /** Every card in every list must have resolved, or the UI shows blanks. */
  it("has card data for every entry in every deck", () => {
    for (const d of DECKS) {
      expect(cardByName(d.commander), `${d.id} commander`).toBeDefined()
      for (const e of d.entries) {
        expect(cardByName(e.name), `${d.id}: ${e.name}`).toBeDefined()
      }
    }
  })

  /** A Commander deck is exactly 100 cards: the commander plus ninety-nine. */
  it("totals 100 cards per deck", () => {
    for (const d of DECKS) expect(deckSize(d), d.id).toBe(100)
  })

  it("names every deck after its own commander", () => {
    for (const d of DECKS) {
      const title = deckTitle(d)
      expect(title).not.toBe(d.id)
      expect(d.commander, d.id).toContain(title)
    }
  })

  /** The bears list is commanded by Beorn; Ayula is just a card in it. */
  it("names the bears deck after Beorn, not Ayula", () => {
    const bears = DECKS.find((d) => d.id === "bears")!
    expect(deckTitle(bears)).toBe("Beorn the Fierce")
  })

  it("gives every card a type and a rarity", () => {
    for (const c of Object.values(CARDS)) {
      expect(c.type, c.name).toBeTruthy()
      expect(c.rarity, c.name).toBeTruthy()
    }
  })
})

describe("manaCurve", () => {
  it("returns eight buckets, zero through seven-plus", () => {
    const curve = manaCurve(DECKS[0])
    expect(curve).toHaveLength(8)
    expect(curve.map((b) => b.cmc)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  /** Lands would otherwise dump a meaningless spike on the zero column. */
  it("excludes lands", () => {
    const bears = DECKS.find((d) => d.id === "bears")!
    const lands = bears.entries
      .filter((e) => {
        const c = cardByName(e.name)
        return c && isLand(c)
      })
      .reduce((n, e) => n + e.count, 0)
    expect(lands, "bears should contain lands").toBeGreaterThan(20)

    const zero = manaCurve(bears)[0].count
    expect(zero).toBeLessThan(lands)
  })

  it("buckets everything above six into the seven column", () => {
    for (const d of DECKS) {
      const curve = manaCurve(d)
      const total = curve.reduce((n, b) => n + b.count, 0)
      const nonLand = d.entries
        .filter((e) => {
          const c = cardByName(e.name)
          return c && !isLand(c)
        })
        .reduce((n, e) => n + e.count, 0)
      expect(total, d.id).toBe(nonLand)
    }
  })
})

describe("colourSpread", () => {
  it("finds only green in the mono-green deck", () => {
    const spread = colourSpread(DECKS.find((d) => d.id === "bears")!)
    expect(spread.G).toBeGreaterThan(0)
    expect(spread.W).toBe(0)
    expect(spread.U).toBe(0)
    expect(spread.B).toBe(0)
    expect(spread.R).toBe(0)
  })

  it("finds Naya colours in Jetmir and Mardu in Kaalia", () => {
    const jetmir = colourSpread(DECKS.find((d) => d.id === "jetmir")!)
    expect(jetmir.R).toBeGreaterThan(0)
    expect(jetmir.G).toBeGreaterThan(0)
    expect(jetmir.W).toBeGreaterThan(0)
    expect(jetmir.U).toBe(0)

    const kaalia = colourSpread(DECKS.find((d) => d.id === "kaalia")!)
    expect(kaalia.W).toBeGreaterThan(0)
    expect(kaalia.B).toBeGreaterThan(0)
    expect(kaalia.R).toBeGreaterThan(0)
    expect(kaalia.G).toBe(0)
    expect(kaalia.U).toBe(0)
  })

  it("counts colourless cards separately", () => {
    // Sol Ring is in every one of these decks.
    expect(colourSpread(DECKS[0]).C).toBeGreaterThan(0)
  })
})

describe("typeSpread", () => {
  it("orders types by frequency", () => {
    const spread = typeSpread(DECKS[0])
    for (let i = 1; i < spread.length; i++) {
      expect(spread[i - 1].count).toBeGreaterThanOrEqual(spread[i].count)
    }
  })

  it("accounts for all ninety-nine cards", () => {
    for (const d of DECKS) {
      const total = typeSpread(d).reduce((n, t) => n + t.count, 0)
      expect(total, d.id).toBe(99)
    }
  })

  it("finds creatures and lands in every deck", () => {
    for (const d of DECKS) {
      const types = typeSpread(d).map((t) => t.type)
      expect(types, d.id).toContain("Creature")
      expect(types, d.id).toContain("Land")
    }
  })
})

describe("averageCmc", () => {
  it("is a sane value for every deck", () => {
    for (const d of DECKS) {
      const avg = averageCmc(d)
      expect(avg, d.id).toBeGreaterThan(1)
      expect(avg, d.id).toBeLessThan(6)
    }
  })
})

describe("sortedEntries", () => {
  it("keeps every card", () => {
    for (const d of DECKS) expect(sortedEntries(d)).toHaveLength(d.entries.length)
  })

  it("puts creatures before lands", () => {
    const sorted = sortedEntries(DECKS[0])
    const firstLand = sorted.findIndex((e) => {
      const c = cardByName(e.name)
      return c && isLand(c)
    })
    const lastCreature = sorted.map((e) => cardByName(e.name)?.type ?? "")
      .reduce((last, t, i) => (t.includes("Creature") ? i : last), -1)
    expect(lastCreature).toBeLessThan(firstLand)
  })

  it("does not mutate the deck", () => {
    const d = DECKS[0]
    const first = d.entries[0].name
    sortedEntries(d)
    expect(d.entries[0].name).toBe(first)
  })
})

describe("costSymbols", () => {
  it("splits a cost into pips", () => {
    expect(costSymbols("{2}{W}{W}")).toEqual(["2", "W", "W"])
  })

  it("handles hybrid and phyrexian symbols", () => {
    expect(costSymbols("{W/U}{B/P}")).toEqual(["W/U", "B/P"])
  })

  it("returns nothing for a land with no cost", () => {
    expect(costSymbols("")).toEqual([])
  })
})

describe("openPack", () => {
  it("opens fourteen cards", () => {
    expect(openPack(seeded(1)).cards).toHaveLength(PACK_SIZE)
  })

  /* Counted over the spells: the land slot draws from every rarity, so a rare
     land is a fourth rare card in the pack without being a fourth rare slot. */
  it("contains one to three rares or mythics", () => {
    for (let s = 1; s <= 40; s++) {
      const top = openPack(seeded(s)).cards.filter(
        (c) => !isLand(c) && (c.rarity === "rare" || c.rarity === "mythic")
      )
      expect(top.length, `seed ${s}`).toBeGreaterThanOrEqual(1)
      expect(top.length, `seed ${s}`).toBeLessThanOrEqual(3)
    }
  })

  it("sometimes opens more than one rare", () => {
    let extra = 0
    for (let s = 1; s <= 120; s++) {
      const top = openPack(seeded(s)).cards.filter(
        (c) => !isLand(c) && (c.rarity === "rare" || c.rarity === "mythic")
      )
      if (top.length > 1) extra++
    }
    expect(extra, "a second rare should turn up sometimes").toBeGreaterThan(0)
  })

  /* A pack that comes out half basics is not a pack. The land has its own
     slot, and no other slot may draw one. */
  it("contains exactly one land", () => {
    for (let s = 1; s <= 40; s++) {
      const lands = openPack(seeded(s)).cards.filter((c) => isLand(c))
      expect(lands.length, `seed ${s}`).toBe(LANDS_PER_PACK)
    }
  })

  it("fills the rest with commons and uncommons", () => {
    for (let s = 1; s <= 20; s++) {
      const cards = openPack(seeded(s)).cards
      const spells = cards.filter((c) => !isLand(c))
      const top = spells.filter((c) => c.rarity === "rare" || c.rarity === "mythic")
      const uncommon = spells.filter((c) => c.rarity === "uncommon")
      const common = spells.filter((c) => c.rarity === "common")
      expect(uncommon.length, `seed ${s}`).toBe(UNCOMMONS_PER_PACK)
      expect(top.length + uncommon.length + common.length, `seed ${s}`).toBe(
        PACK_SIZE - LANDS_PER_PACK
      )
    }
  })

  /** A pack with the same card twice reads as a bug, not a pull. */
  it("never repeats a card within one pack", () => {
    for (let s = 1; s <= 40; s++) {
      const names = openPack(seeded(s)).cards.map((c) => c.name)
      expect(new Set(names).size, `seed ${s}`).toBe(names.length)
    }
  })

  it("produces different packs from different seeds", () => {
    const a = openPack(seeded(1)).cards.map((c) => c.name).join()
    const b = openPack(seeded(99)).cards.map((c) => c.name).join()
    expect(a).not.toBe(b)
  })

  it("only ever contains cards that exist in the data", () => {
    for (const c of openPack(seeded(7)).cards) {
      expect(cardByName(c.name), c.name).toBeDefined()
    }
  })
})
