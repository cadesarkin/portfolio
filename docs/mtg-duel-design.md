# A playable duel with the real decks

Status: in progress on `feat/mtg-duel`.

## What this is

A two-player game of Magic played on Arcanum: you pick one of the three
Commander decks, the AI plays another. Real rules — turns, phases, the stack,
combat, triggers — over the actual 100-card lists.

## The problem this design solves

Magic cannot be implemented in general. The comprehensive rules run past 250
pages, the game is Turing-complete, and no card's behaviour can be derived from
its oracle text without a natural-language understanding of the whole rules
system. Any honest version of this has to decide what it does with the cards it
cannot run.

Measured over the three decks: 227 unique cards, of which 66 touch a mechanic
that needs its own engine subsystem (replacement effects, damage prevention,
split second, copy effects, cost modification). Two decks' commanders — Jetmir
and Kaalia — need nothing unusual. Beorn needs named counters and type-changing.

## The rule that makes full decks possible

**Every card exists. Text runs where it is encoded. The UI says what is not
running.**

A card is never removed from a deck for being hard. It always has its printed
body: a creature enters with its real power, toughness, types and keywords; a
land taps for its real colours. What varies is how much of its rules text is
live. A card whose text is not fully encoded is marked in play, so the game
never silently lies about what it did.

This is the difference between a deck that is really his and a deck that has
been quietly cut down to what was convenient.

## Where card behaviour comes from

Two sources, in order:

1. **Derived from the card data, for free.** Scryfall gives power, toughness,
   type line, subtypes, `keywords` and `produced_mana`. That is every creature's
   body and evasion, and every land's mana, across all 227 cards, with nothing
   written by hand. The skeleton of all three decks works on day one.

2. **Encoded by hand, as data.** Rules text becomes a small vocabulary of
   abilities and effects — an ETB trigger that makes a token, a static buff over
   a subtype, an attack trigger that adds counters. The measurement that makes
   this worth doing: 67% of the non-land cards touch one of just fifteen
   recurring patterns. The text is repetitive, not infinitely varied.

## Shape

```
src/lib/mtg/
  types.ts       game state, players, permanents, zones, phases
  state.ts       building a game from a decklist; zone moves
  mana.ts        costs, pools, payment
  turn.ts        phase machine, priority, the turn cycle
  stack.ts       casting, the stack, resolution
  combat.ts      attackers, blockers, damage, evasion
  effects.ts     the effect vocabulary and how each resolves
  continuous.ts  static buffs, granted keywords, what a permanent really is
  actions.ts     playing a land, tapping for mana, casting
  encoded/       card behaviour: hand-written entries, and a text parser
  ai.ts          the opponent
  duel.ts        the driver that runs a game and stops for the player
```

Pure logic throughout, as the rest of this project does it: the engine never
touches the DOM, so it can be tested directly, and the UI only renders state and
sends actions.

## Commander rules included

40 life, a command zone, commander tax of {2} per cast, and 21 commander damage.
Singleton is a property of the decklists, not something the engine enforces.

## What is deliberately out

- More than two players.
- Deck building. The three lists are fixed.
- Priority passing on every object. The AI is not trying to win a rules lawyer
  argument; it gets priority where it could meaningfully act.

## Where it stands

Measured by the tests, written out to `playability-report.txt` and
`coverage-report.txt` on every run:

```
bears    100 cards: 34/34 lands make mana, 29 creatures have bodies, 22/37 other spells do something
jetmir   100 cards: 34/35 lands make mana, 26 creatures have bodies, 24/39 other spells do something
kaalia   100 cards: 36/36 lands make mana, 25 creatures have bodies, 22/39 other spells do something

text coverage over the pool: 43 full, 60 partial, 124 body only
```

So: the mana bases work completely, every creature is a real body that attacks
and blocks with its printed keywords, and about six spells in ten do something
when they resolve. The remaining four in ten are the honest weak spot and the
number to keep pushing on. `coverage-report.txt` ranks the unparsed sentences by
how often they occur, which is how the next batch gets picked — by evidence
rather than by guesswork.

## Hard-won details

Things that were wrong first and are worth not re-breaking:

- **A mana ability with a cost of its own.** A Signet costs `{1}` and makes two,
  so it is worth one. Taking its mana without charging the cost handed out a
  free mana a turn from four different cards.
- **Deathtouch is a state-based action**, not something combat decides. Any
  damage from a deathtouch source is lethal, so it has to be remembered on the
  damaged creature until the game next checks.
- **First strike needs two damage passes**, with deaths applied between them, or
  the keyword does nothing at all.
- **Menace cannot be checked one blocker at a time.** Whether a creature is
  legally blocked is only knowable once every block is declared.
- **`advanceTo` must advance at least once.** "Go to the next main phase" while
  already in one means the following one, not standing still.
- **The player is called "you", which is second person.** Every log line built
  as `${name} ${verb}s` came out as "you takes 6".

## Fallback

If the encoded coverage stays too thin to be fun, the fallback is the curated
version: three 40-card decks drawn from the cards that encode cleanly. The
engine is identical either way — only the decklists change.
