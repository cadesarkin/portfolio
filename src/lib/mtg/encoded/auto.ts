/**
 * Reading abilities out of oracle text.
 *
 * Hand-writing two hundred entries would be a lot of typing for text that is
 * overwhelmingly the same few sentences: "draw a card", "destroy target
 * creature", "create a 2/2 white Cat creature token". This turns the regular
 * ones into abilities automatically.
 *
 * The rule that keeps it honest: a pattern only matches a **whole line**. A
 * line the parser does not fully understand is left over, and a card with
 * anything left over is marked `partial`, never `full`. It is better to run
 * none of a sentence than half of it — half a card is a card that lies.
 */

import type { Ability, Amount, Effect, Keyword, ManaOption, ManaSymbol, TokenSpec } from "../types"
import { KEYWORDS } from "../types"

export interface AutoEncoded {
  abilities: Ability[]
  /** Lines that were understood. */
  covered: string[]
  /** Lines that were not. */
  leftover: string[]
  /** The permanent arrives tapped. */
  entersTapped: boolean
}

const NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ten: 10,
}

const num = (word: string): number | null => {
  const w = word.trim().toLowerCase()
  if (w in NUMBERS) return NUMBERS[w]
  const n = Number(w)
  return Number.isFinite(n) ? n : null
}

const COLOUR_WORDS: Record<string, "W" | "U" | "B" | "R" | "G"> = {
  white: "W",
  blue: "U",
  black: "B",
  red: "R",
  green: "G",
}

/** Reminder text in brackets is flavour for the reader, not rules to run. */
const stripReminders = (line: string): string => line.replace(/\([^)]*\)/g, "").trim()

function parseKeywordList(text: string): Keyword[] {
  const out: Keyword[] = []
  for (const part of text.split(/,| and /)) {
    const k = part.trim().toLowerCase()
    if ((KEYWORDS as string[]).includes(k)) out.push(k as Keyword)
  }
  return out
}

/**
 * `a 2/2 white Cat creature token with haste` -> a token spec.
 *
 * Returns null rather than guessing when the shape is not exactly this, which
 * is what stops "create a token that's a copy of..." coming out as a 0/0.
 */
function parseToken(text: string): { count: Amount; token: TokenSpec } | null {
  const m =
    /^(a|an|one|two|three|four|five|X|\d+)\s+(\d+)\/(\d+)\s+([a-z ]*?)\s*([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*)\s+creature tokens?(?:\s+with\s+(.+?))?$/.exec(
      text.trim()
    )
  if (!m) return null
  const count: Amount | null = m[1].toUpperCase() === "X" ? { count: "x" } : num(m[1])
  const power = Number(m[2])
  const toughness = Number(m[3])
  if (count === null || !Number.isFinite(power) || !Number.isFinite(toughness)) return null

  const colours = (m[4] ?? "")
    .split(/\s+and\s+|\s+/)
    .map((w) => COLOUR_WORDS[w.trim().toLowerCase()])
    .filter(Boolean)
  const subtypes = (m[5] ?? "").split(/\s+/).filter(Boolean)

  return {
    count,
    token: {
      name: `${power}/${toughness} ${subtypes.join(" ") || "Creature"}`,
      power,
      toughness,
      types: ["Creature"],
      subtypes,
      colours,
      keywords: m[6] ? parseKeywordList(m[6]) : [],
    },
  }
}

/**
 * The mana in `Add {G}{G}`, or `Add {R} or {W}`.
 *
 * The two forms mean different things and the difference matters: `{G}{G}` is
 * two mana, `{R} or {W}` is one mana with a choice. Each entry of the result is
 * one mana and lists the symbols it may be taken as.
 */
function parseAdd(text: string): ManaOption[] | null {
  if (/^add one mana of any color$/i.test(text)) return [["W", "U", "B", "R", "G"]]

  // "Add {R} or {W}" — a single mana, either colour.
  const choice = /^add (\{[WUBRGC]\})(?:,? or (\{[WUBRGC]\}))+$/i.exec(text)
  if (choice || / or /i.test(text)) {
    const symbols = [...text.matchAll(/\{([WUBRGC])\}/gi)].map(
      (x) => x[1].toUpperCase() as ManaSymbol
    )
    return symbols.length ? [symbols] : null
  }

  // "Add {G}{G}" — one mana per symbol.
  const m = /^add ((?:\{[WUBRGC]\})+)$/i.exec(text)
  if (!m) return null
  return [...m[1].matchAll(/\{([WUBRGC])\}/gi)].map((x) => [x[1].toUpperCase() as ManaSymbol])
}

/**
 * One sentence of an effect, or null.
 *
 * Every pattern is anchored at both ends so a sentence with extra conditions on
 * it does not match a simpler pattern and quietly lose the condition.
 */
function parseEffect(sentence: string, self: string): Effect | null {
  const s = sentence.trim().replace(/\.$/, "")
  const named = new RegExp(`^(?:${escape(self)}|this creature|this spell|it)\\s+`, "i")

  // Draw.
  let m = /^(?:you )?draw (a|an|one|two|three|four|five|\d+) cards?$/i.exec(s)
  if (m) {
    const n = num(m[1])
    if (n !== null) return { do: "draw", amount: n, who: "you" }
  }

  // Life.
  m = /^you gain (a|an|one|two|three|four|five|\d+) life$/i.exec(s)
  if (m) {
    const n = num(m[1])
    if (n !== null) return { do: "gainLife", amount: n, who: "you" }
  }
  m = /^(?:each opponent|target opponent) loses (a|an|one|two|three|four|five|\d+) life$/i.exec(s)
  if (m) {
    const n = num(m[1])
    if (n !== null) return { do: "loseLife", amount: n, who: "opponent" }
  }

  // Damage. The card refers to itself by name, which varies per card.
  m = new RegExp(
    `^(?:${escape(self)}|this creature|this spell|it) deals (\\d+) damage to (any target|target creature|target player|each opponent)$`,
    "i"
  ).exec(s)
  if (m) {
    const n = Number(m[1])
    const where = m[2].toLowerCase()
    if (where === "target creature") {
      return { do: "damage", amount: n, target: { what: "creature", controller: "any", chosen: true } }
    }
    return { do: "damage", amount: n, target: { what: "player", controller: "opponent" } }
  }

  // Destroy and exile. "up to one target" is the same thing to the engine,
  // which resolves against whatever was actually chosen.
  m = /^destroy (?:up to one )?target (creature|artifact|enchantment|permanent|land)(?: you don't control)?$/i.exec(s)
  if (m) {
    return {
      do: "destroy",
      target: { what: m[1].toLowerCase() as "creature", controller: "any", chosen: true },
    }
  }
  m = /^destroy (?:up to one )?target (artifact|enchantment) or (artifact|enchantment)$/i.exec(s)
  if (m) {
    return {
      do: "destroy",
      target: { what: "permanent", controller: "any", chosen: true },
    }
  }
  m = /^destroy target (creature|artifact|enchantment|permanent|land)$/i.exec(s)
  if (m) {
    return {
      do: "destroy",
      target: { what: m[1].toLowerCase() as "creature", controller: "any", chosen: true },
    }
  }
  m = /^exile target (creature|artifact|enchantment|permanent|land)$/i.exec(s)
  if (m) {
    return {
      do: "exile",
      target: { what: m[1].toLowerCase() as "creature", controller: "any", chosen: true },
    }
  }

  // Counters.
  m = /^put (a|an|one|two|three|four|five|\d+) \+1\/\+1 counters? on target creature(?: you control)?$/i.exec(s)
  if (m) {
    const n = num(m[1])
    if (n !== null) {
      return {
        do: "counters",
        counter: "+1/+1",
        amount: n,
        target: { what: "creature", controller: "you", chosen: true },
      }
    }
  }

  // Pump. A +X/+X is left to a hand-written entry: the buff is a fixed number
  // here, and parsing X as zero would be a spell that does nothing.
  m = /^target creature gets \+(\d+)\/\+(\d+) until end of turn$/i.exec(s)
  if (m) {
    return {
      do: "buff",
      power: Number(m[1]),
      toughness: Number(m[2]),
      target: { what: "creature", controller: "any", chosen: true },
      until: "eot",
    }
  }
  m = /^creatures you control get \+(\d+)\/\+(\d+) until end of turn$/i.exec(s)
  if (m) {
    return {
      do: "buff",
      power: Number(m[1]),
      toughness: Number(m[2]),
      target: { what: "creature", controller: "you", count: "all" },
      until: "eot",
    }
  }

  // Tokens.
  m = /^create (.+ creature tokens?(?: with .+)?)$/i.exec(s)
  if (m) {
    const parsed = parseToken(m[1])
    if (parsed) return { do: "token", count: parsed.count, token: parsed.token }
  }

  void named
  return null
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * A whole line, which may be a static ability, a trigger, or a plain effect.
 *
 * Returns null when the line is not fully understood, which is what keeps a
 * half-parsed card from claiming to be complete.
 */
function parseLine(line: string, self: string, isPermanent: boolean): Ability | null {
  const s = stripReminders(line).replace(/\.$/, "")
  if (s === "") return null

  // Static: a lord effect over a subtype or over your creatures.
  let m = /^other ([A-Z][a-z]+)s? you control get \+(\d+)\/\+(\d+)$/i.exec(s)
  if (m) {
    return {
      kind: "static",
      effect: {
        kind: "buff",
        filter: { subtypes: [capitalise(m[1])], controller: "you", excludeSelf: true },
        power: Number(m[2]),
        toughness: Number(m[3]),
      },
    }
  }
  m = /^creatures you control get \+(\d+)\/\+(\d+)$/i.exec(s)
  if (m) {
    return {
      kind: "static",
      effect: {
        kind: "buff",
        filter: { types: ["Creature"], controller: "you" },
        power: Number(m[1]),
        toughness: Number(m[2]),
      },
    }
  }
  m = /^creatures you control have ([a-z ,]+)$/i.exec(s)
  if (m) {
    const kws = parseKeywordList(m[1])
    if (kws.length === 1) {
      return {
        kind: "static",
        effect: {
          kind: "grant",
          filter: { types: ["Creature"], controller: "you" },
          keyword: kws[0],
        },
      }
    }
  }

  // A mana ability.
  m = /^\{T\}: (add .+)$/i.exec(s)
  if (m) {
    const produces = parseAdd(m[1])
    if (produces) return { kind: "mana", cost: { tap: true }, produces }
  }

  // Triggers.
  m = /^when(?:ever)? this creature enters, (.+)$/i.exec(s)
  if (m) {
    const effects = parseSentences(m[1], self)
    if (effects) return { kind: "triggered", on: { when: "enters", who: "self" }, effects }
  }
  m = /^when(?:ever)? this (?:creature|permanent|enchantment|artifact) enters, (.+)$/i.exec(s)
  if (m) {
    const effects = parseSentences(m[1], self)
    if (effects) return { kind: "triggered", on: { when: "enters", who: "self" }, effects }
  }
  m = /^when(?:ever)? this creature attacks, (.+)$/i.exec(s)
  if (m) {
    const effects = parseSentences(m[1], self)
    if (effects) return { kind: "triggered", on: { when: "attacks", who: "self" }, effects }
  }
  m = /^when(?:ever)? this creature deals combat damage to a player, (.+)$/i.exec(s)
  if (m) {
    const effects = parseSentences(m[1], self)
    if (effects) {
      return { kind: "triggered", on: { when: "dealsCombatDamage", who: "self" }, effects }
    }
  }
  // "At the beginning of combat on your turn" — seventeen lines across the
  // three decks, more than any other trigger.
  m = /^at the beginning of combat on your turn, (.+)$/i.exec(s)
  if (m) {
    const effects = parseSentences(m[1], self)
    if (effects) return { kind: "triggered", on: { when: "beginCombat", controller: "you" }, effects }
  }
  m = /^when(?:ever)? (?:a|another) creature you control enters, (.+)$/i.exec(s)
  if (m) {
    const effects = parseSentences(m[1], self)
    if (effects) {
      return {
        kind: "triggered",
        on: { when: "enters", who: "other", filter: { types: ["Creature"], controller: "you" } },
        effects,
      }
    }
  }
  m = /^(?:landfall\s*—\s*)?when(?:ever)? a land you control enters, (.+)$/i.exec(s)
  if (m) {
    const effects = parseSentences(m[1], self)
    if (effects) return { kind: "triggered", on: { when: "landfall" }, effects }
  }
  m = /^when(?:ever)? this creature dies, (.+)$/i.exec(s)
  if (m) {
    const effects = parseSentences(m[1], self)
    if (effects) return { kind: "triggered", on: { when: "dies", who: "self" }, effects }
  }
  m = /^at the beginning of your (upkeep|end step), (.+)$/i.exec(s)
  if (m) {
    const effects = parseSentences(m[2], self)
    if (effects) {
      const when = m[1].toLowerCase() === "upkeep" ? "upkeep" : "endStep"
      return { kind: "triggered", on: { when, controller: "you" }, effects }
    }
  }

  // A plain spell effect, only for a card that is a spell rather than a
  // permanent — otherwise "draw a card" on a creature would fire on its own.
  if (!isPermanent) {
    const effects = parseSentences(s, self)
    if (effects) return { kind: "spell", effects }
  }

  return null
}

/** Splits on sentence breaks and parses each, or fails as a whole. */
function parseSentences(text: string, self: string): Effect[] | null {
  const parts = text
    .split(/(?:\. |, then )/)
    .map((p) => p.trim())
    .filter(Boolean)
  const out: Effect[] = []
  for (const part of parts) {
    const effect = parseEffect(part, self)
    if (!effect) return null
    out.push(effect)
  }
  return out.length ? out : null
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

/**
 * Reads what it can from a card's text.
 *
 * Keyword-only lines are reported as covered without producing an ability: the
 * keywords are already on the card from the printed data, so parsing them again
 * would double them up.
 */
export function autoEncode(
  text: string,
  name: string,
  isPermanent: boolean,
  printedKeywords: Keyword[]
): AutoEncoded {
  const abilities: Ability[] = []
  const covered: string[] = []
  const leftover: string[] = []
  let entersTapped = false

  for (const rawLine of (text ?? "").split("\n")) {
    const line = stripReminders(rawLine)
    if (line === "") continue

    // A line of nothing but keywords is already handled by the printed list.
    const asKeywords = line
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean)
    if (asKeywords.every((k) => printedKeywords.includes(k as Keyword))) {
      covered.push(line)
      continue
    }

    /* Entering tapped is the most common line in these decks — 29 of them.
       The unconditional form is fully handled. The conditional one ("unless
       you control a Forest") still enters tapped, because that is the common
       case and the alternative is a land that lies about being ready, but the
       line stays in leftover so the card reads as partial rather than full. */
    const tapped = /^this (?:land|permanent|creature|artifact) enters tapped(.*)$/i.exec(
      line.replace(/\.$/, "")
    )
    if (tapped) {
      entersTapped = true
      if (tapped[1].trim() === "") covered.push(line)
      else leftover.push(line)
      continue
    }

    const ability = parseLine(line, name, isPermanent)
    if (ability) {
      abilities.push(ability)
      covered.push(line)
    } else {
      leftover.push(line)
    }
  }

  return { abilities, covered, leftover, entersTapped }
}
