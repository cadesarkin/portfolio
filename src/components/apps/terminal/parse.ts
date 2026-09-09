/** Tokenising and typo-matching for the terminal. Pure, no DOM. */

/**
 * Splits a command line into arguments, honouring quotes.
 *
 * Quotes group but do not delimit, so `"my file".txt` is one token — the same
 * way a real shell treats it. An unterminated quote runs to end of line rather
 * than erroring, since there is no continuation prompt to fall back to.
 */
export function tokenize(input: string): string[] {
  const out: string[] = []
  let cur = ""
  let quote: '"' | "'" | null = null
  let started = false

  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      started = true
      continue
    }
    if (ch === " " || ch === "\t") {
      if (started || cur !== "") {
        out.push(cur)
        cur = ""
        started = false
      }
      continue
    }
    cur += ch
  }

  if (started || cur !== "") out.push(cur)
  return out
}

/**
 * Damerau-Levenshtein distance (optimal string alignment).
 *
 * Counts a transposition as one edit rather than two. That matters here:
 * swapping two adjacent keys is the most common way to mistype a short
 * command, and plain Levenshtein scores `sl` for `ls` as distance 2 — far
 * enough away that no suggestion would ever be offered.
 */
function distance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  // Three rows: i-2, i-1 and the current one, so transpositions can look back.
  let prev2: number[] = []
  let prev = Array.from({ length: n + 1 }, (_, j) => j)

  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(
        prev[j] + 1, // deletion
        cur[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j], prev2[j - 2] + 1) // transposition
      }
    }
    prev2 = prev
    prev = cur
  }
  return prev[n]
}

/**
 * The closest candidate to `input`, or null if none is plausibly a typo.
 *
 * The threshold scales with length so short commands do not match everything:
 * `ls` should suggest itself for `lz`, but `xyzzy` should suggest nothing.
 */
export function nearest(input: string, candidates: string[]): string | null {
  let best: string | null = null
  let bestD = Infinity

  for (const c of candidates) {
    const d = distance(input, c)
    if (d < bestD) {
      bestD = d
      best = c
    }
  }

  const limit = input.length <= 4 ? 1 : 2
  return bestD <= limit ? best : null
}
