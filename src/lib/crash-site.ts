/**
 * The crash site, as defrag's levels rebuild it.
 *
 * Pure — no DOM. Every level finished sends one more person walking up to the
 * wreck, and the wreck changes as they work: dug out, patched, rebuilt around
 * a new booster, stood on a pad. After the last level it is a ship, and the
 * ship can leave.
 *
 * Positions are in characters and lines from the point where the crater floor
 * meets the ground under the wreck: `x` runs right, `bottom` runs up.
 */

import { FULL_FIRE, type FireMix } from "./embers"

/** Splits a raw template into lines, dropping the first and last (empty) ones. */
const art = (s: string): string[] => s.split("\n").slice(1, -1)

export const width = (a: string[]): number => Math.max(...a.map((l) => l.length))

/* ── Pieces ───────────────────────────────────────────────────────────── */

/** The escape capsule as it came down: half-buried, hatch blown open. */
export const WRECK = art(String.raw`
    _____
  .'     '.
 /  .---.  \
|   | o |   |
|   '---'   |
 \  =====  /
 |_________|
//|  | |  |\\
`)

/** Dug out, stood upright on blocks, and caged in scaffolding. */
const PROPPED = art(String.raw`
|    _____    |
|  .'     '.  |
|=/  .---.  \=|
||   | o |   ||
||   '---'   ||
|=\  =====  /=|
|  |_______|  |
|__[#]___[#]__|
`)

/** Plated over, the porthole lit again. */
const PATCHED = art(String.raw`
    _______
  .'#######'.
 /##.-----.##\
|##/  (@)  \##|
|##\_______/##|
 \###=====###/
 |===========|
_|[#]_____[#]|_
`)

/** The capsule, now the nose of a booster still open to the frame. */
const ASSEMBLY = art(String.raw`
      _______
    .'#######'.
   /##.-----.##\
  |##/  (@)  \##|
  |##\_______/##|
   \###=====###/
   |===========|
   | |       | |
   | |  :::  | |
   | |_______| |
  /|===========|\
 /_|[#]_____[#]|_\
`)

/** The ship. Its nose is the capsule that crashed. */
export const ROCKET = art(String.raw`
        /\
       /  \
      /____\
    .'######'.
   /##.----.##\
  |##/  @@  \##|
  |##\______/##|
   \###====###/
   |==========|
   |  |    |  |
   |  DEFRAG  |
   |  |    |  |
   |  |    |  |
  /|  |    |  |\
 / |__________| \
/__|   /  \   |__\
`)

/** What comes out of the bottom of it, two frames of it. */
export const EXHAUST = [
  art(String.raw`
      (**)
     ( ** )
    (  **  )
     '    '
`),
  art(String.raw`
      )**(
     ) ** (
    )  **  (
      '  '
`),
]

const PAD = art(String.raw`
 ______|____________|______
|##########################|
`)

/** The launch tower, arms out to the ship while it is being fuelled. */
const GANTRY = art(String.raw`
    _|_
   |###|
===|#-#|
   |###|
   |#-#|
===|###|
   |#-#|
   |###|
   |#-#|
   |###|
   |#-#|
   |###|
  _|###|_
`)

/** The tower with its arms swung back, clear for launch. */
const GANTRY_CLEAR = GANTRY.map((l) => l.replace("===", "   "))

const TOWER = art(String.raw`
 ___
|-|-|
|=|=|
|-|-|
|=|=|
|-|-|
|=|=|
|-|-|
|=|=|
|_|_|
`)

const CRANE = art(String.raw`
 ________
 |/     |
 |      |
 |     [=]
 |
 |
 |
_|_
`)

const SIGN = art(String.raw`
 ___
|/!\|
|___|
  |
`)

const TOOLBOX = art(String.raw`
 _n_
[___]
`)

const CRATES = art(String.raw`
  [#]
[#] [#]
`)

/* ── Stages ───────────────────────────────────────────────────────────── */

export interface Layer {
  id: string
  art: string[]
  /** Column of the art's left edge. */
  x: number
  /** Line of the art's last row, counted up from the ground. */
  bottom: number
  color: string
}

export type Action = "look" | "hammer" | "weld" | "carry" | "cheer" | "wave"

export interface Station {
  /** Column of the figure's centre. */
  x: number
  /** Lines above the ground the figure stands on. */
  bottom: number
  action: Action
  /** Which way the figure faces: toward the ship, mostly. */
  facing: 1 | -1
  /** For carrying: the two ends of the walk. */
  span?: [number, number]
}

export const NO_FIRE: FireMix = { flame: 0, smoke: 0, spark: 0, spread: 1 }
/** Ignition: smoke rolling out across the pad. */
export const LAUNCH_FIRE: FireMix = { flame: 0.9, smoke: 5, spark: 0.7, spread: 3.2, pale: true }

export type StageId =
  | "wreck"
  | "found"
  | "propped"
  | "patched"
  | "assembly"
  | "pad"
  | "ready"
  | "gone"

export interface Stage {
  id: StageId
  /** What the hover label and screen readers call it. */
  label: string
  layers: Layer[]
  /** Where the crew work, in the order they arrived. */
  stations: Station[]
  fire: FireMix
}

const HULL = "#ffd98a"
const STEEL = "#c9d4de"
const TOWER_RED = "#ef6a4a"

/** A piece centred on a column. */
function centred(id: string, a: string[], cx: number, bottom: number, color: string): Layer {
  return { id, art: a, x: Math.round(cx - width(a) / 2), bottom, color }
}

function at(id: string, a: string[], x: number, bottom: number, color: string): Layer {
  return { id, art: a, x, bottom, color }
}

const look = (x: number, facing: 1 | -1, bottom = 0): Station => ({
  x,
  bottom,
  action: "look",
  facing,
})
const work = (action: Action, x: number, facing: 1 | -1, bottom = 0): Station => ({
  x,
  bottom,
  action,
  facing,
})
const carry = (a: number, b: number): Station => ({
  x: a,
  bottom: 0,
  action: "carry",
  facing: 1,
  span: [a, b],
})

/** The most people the site has room for. After that, they just work harder. */
export const MAX_CREW = 6

/** Everyone standing well back, for the launch and after it. */
const CHEERING: Station[] = [-18, 23, -23, 27, -28, -33].map((x) => ({
  x,
  bottom: 0,
  action: "cheer" as const,
  facing: x < 0 ? (1 as const) : (-1 as const),
}))

/**
 * The site after `reached` levels.
 *
 * `launched` means the ship has gone: the pad stands empty and the crew wave
 * at the sky.
 */
export function stageFor(reached: number, launched: boolean, levels: number): Stage {
  const pad = centred("pad", PAD, 0, 0, STEEL)
  // Each stage starts a share of the way through the game, however long the
  // game is: with fifteen levels, the pad goes up at twelve.
  const from = (share: number) => Math.max(1, Math.round(levels * share))

  if (launched) {
    return {
      id: "gone",
      label: "the launch pad, empty — open the starmap",
      layers: [pad, at("gantry", GANTRY_CLEAR, 12, 0, TOWER_RED)],
      stations: CHEERING.map((s) => ({ ...s, action: "wave" })),
      fire: NO_FIRE,
    }
  }

  if (reached >= levels) {
    return {
      id: "ready",
      label: "the ship, ready for launch",
      layers: [pad, centred("rocket", ROCKET, 0, 2, HULL), at("gantry", GANTRY_CLEAR, 12, 0, TOWER_RED)],
      stations: CHEERING,
      fire: { flame: 0, smoke: 0.3, spark: 0, spread: 1.4, pale: true },
    }
  }

  if (reached >= from(0.8)) {
    return {
      id: "pad",
      label: "the ship on its pad, being fuelled",
      layers: [pad, centred("rocket", ROCKET, 0, 2, HULL), at("gantry", GANTRY, 12, 0, TOWER_RED)],
      stations: [
        work("weld", -11, 1, 2),
        carry(-32, -20),
        work("hammer", 11, -1, 2),
        look(-17, 1),
        work("weld", 17, -1, 13),
        look(24, -1),
      ],
      // Steam off the tanks while it is fuelled, on the last stretch.
      fire: reached >= levels - 1 ? { flame: 0, smoke: 0.22, spark: 0, spread: 1.2, pale: true } : NO_FIRE,
    }
  }

  if (reached >= from(0.6)) {
    return {
      id: "assembly",
      label: "the wreck, rebuilt around a new booster",
      layers: [
        centred("hull", ASSEMBLY, 0, 0, HULL),
        at("tower", TOWER, 14, 0, STEEL),
        at("crane", CRANE, -25, 0, STEEL),
        at("crates", CRATES, 21, 0, "#d9a066"),
      ],
      stations: [
        work("weld", -11, 1),
        work("weld", 11, -1),
        carry(-38, -28),
        work("hammer", 0, 1, 12),
        work("weld", 16, -1, 10),
        look(-15, 1),
      ],
      fire: NO_FIRE,
    }
  }

  if (reached >= from(0.4)) {
    return {
      id: "patched",
      label: "the wreck, patched up",
      layers: [
        centred("hull", PATCHED, 0, 0, HULL),
        at("crane", CRANE, -22, 0, STEEL),
        at("crates", CRATES, 13, 0, "#d9a066"),
      ],
      stations: [
        work("weld", -10, 1),
        work("hammer", 10, -1),
        carry(-36, -26),
        look(-17, 1),
        work("weld", 0, 1, 8),
        look(23, -1),
      ],
      fire: reached === from(0.4) ? { flame: 0, smoke: 0.2, spark: 0, spread: 1 } : NO_FIRE,
    }
  }

  if (reached >= from(0.2)) {
    // The last of the fire, dying across the stage.
    const into = (reached - from(0.2)) / Math.max(1, from(0.4) - from(0.2))
    return {
      id: "propped",
      label: "the wreck, dug out",
      layers: [
        centred("hull", PROPPED, 0, 0, HULL),
        at("sign", SIGN, -22, 0, "#ffcf3a"),
        at("crates", CRATES, 12, 0, "#d9a066"),
        at("toolbox", TOOLBOX, -16, 0, "#e05a4a"),
      ],
      stations: [
        work("hammer", -10, 1),
        work("hammer", 10, -1),
        carry(-36, -27),
        look(22, -1),
        look(-25, 1),
      ],
      fire: [
        { flame: 0.22, smoke: 0.6, spark: 0.15, spread: 1 },
        { flame: 0.08, smoke: 0.45, spark: 0.05, spread: 1 },
        { flame: 0, smoke: 0.3, spark: 0, spread: 1 },
      ][Math.min(2, Math.floor(into * 3))],
    }
  }

  const wreck = centred("hull", WRECK, 0, 0, HULL)
  if (reached >= 1) {
    return {
      id: "found",
      label: "the wreck, being looked at",
      layers: [
        wreck,
        at("sign", SIGN, -15, 0, "#ffcf3a"),
        ...(reached >= 2 ? [at("toolbox", TOOLBOX, 12, 0, "#e05a4a")] : []),
      ],
      stations: [look(-9, 1), look(9, -1)],
      fire:
        reached === 1
          ? { flame: 0.7, smoke: 0.9, spark: 0.6, spread: 1 }
          : { flame: 0.45, smoke: 0.8, spark: 0.4, spread: 1 },
    }
  }

  return {
    id: "wreck",
    label: "wreckage in the crater — open the starmap",
    layers: [wreck],
    stations: [],
    fire: FULL_FIRE,
  }
}

/** One person per level finished, as many as the site has room for. */
export const crewFor = (reached: number, launched: boolean): number =>
  launched ? MAX_CREW : Math.min(reached, MAX_CREW)

/* ── The crew ─────────────────────────────────────────────────────────── */

/**
 * A figure, facing right, in frames. Four lines: the top one is for whatever
 * they are holding over their head or wondering about.
 */
const FRAMES: Record<Action | "walk", string[][]> = {
  walk: [
    ["   ", " o ", "/|\\", "/ \\"],
    ["   ", " o ", "/|\\", " | "],
  ],
  look: [
    ["   ", " o ", "/|\\", "/ \\"],
    ["   ", " o ", "/|\\", "/ \\"],
    ["  ?", " o ", "/|>", "/ \\"],
  ],
  hammer: [
    ["  T ", " o/ ", "/|  ", "/ \\ "],
    ["   *", " o_T", "/|  ", "/ \\ "],
  ],
  weld: [
    [" .  ", " o  ", "/|=*", "/ \\ "],
    ["  ' ", " o  ", "/|=+", "/ \\ "],
  ],
  carry: [
    ["[=]", " o ", "/|\\", "/ \\"],
    ["[=]", " o ", "/|\\", " | "],
  ],
  cheer: [
    ["   ", "\\o/", " | ", "/ \\"],
    ["\\o/", " | ", "/ \\", "   "],
  ],
  wave: [
    ["   ", "\\o ", " |\\", "/ \\"],
    ["   ", " o/", "/| ", "/ \\"],
  ],
}

/** Seconds per frame, per action. */
export const BEAT: Record<Action | "walk", number> = {
  walk: 0.22,
  look: 1.1,
  hammer: 0.28,
  weld: 0.12,
  carry: 0.22,
  cheer: 0.35,
  wave: 0.4,
}

const MIRROR: Record<string, string> = {
  "/": "\\",
  "\\": "/",
  "(": ")",
  ")": "(",
  "[": "]",
  "]": "[",
  "<": ">",
  ">": "<",
  "{": "}",
  "}": "{",
}

/** The same art, facing the other way. Lines are padded first so it stays aligned. */
export function mirror(a: string[]): string[] {
  const w = width(a)
  return a.map((l) =>
    [...l.padEnd(w)]
      .reverse()
      .map((c) => MIRROR[c] ?? c)
      .join("")
  )
}

/** The frame for an action at a time, facing a way. */
export function figure(action: Action | "walk", t: number, facing: 1 | -1): string[] {
  const frames = FRAMES[action]
  const f = frames[Math.floor(t / BEAT[action]) % frames.length]
  return facing === 1 ? f : mirror(f)
}

/** Characters per second a figure walks at. */
export const WALK_SPEED = 9

/**
 * Where a carrying figure is along its walk at a time: there and back, with a
 * pause at each end to put the load down and pick up the next.
 */
export function carryAt(span: [number, number], t: number): { x: number; facing: 1 | -1; moving: boolean } {
  const [a, b] = span
  const leg = Math.abs(b - a) / WALK_SPEED
  const pause = 1.2
  const cycle = 2 * (leg + pause)
  const u = ((t % cycle) + cycle) % cycle
  const dir: 1 | -1 = b > a ? 1 : -1
  if (u < leg) return { x: a + (b - a) * (u / leg), facing: dir, moving: true }
  if (u < leg + pause) return { x: b, facing: dir, moving: false }
  if (u < 2 * leg + pause) {
    return { x: b + (a - b) * ((u - leg - pause) / leg), facing: (-dir) as 1 | -1, moving: true }
  }
  return { x: a, facing: (-dir) as 1 | -1, moving: false }
}

/* ── The launch ───────────────────────────────────────────────────────── */

/** Seconds from the start of a launch: count, light, lift. */
export const LAUNCH = { count: 3, ignite: 3, lift: 3.6, gone: 10.5 }

/** How far the ship has risen at a time into the launch, in pixels, given the screen's height. */
export function liftAt(t: number, screenH: number): number {
  if (t < LAUNCH.lift) return 0
  const s = t - LAUNCH.lift
  const span = LAUNCH.gone - LAUNCH.lift
  // Slow off the pad, then away: enough by the end to clear the screen twice.
  return (2 * screenH * (s * s)) / (span * span)
}

/** What the countdown shows at a time into the launch, if anything. */
export function countdownAt(t: number): string | null {
  if (t < LAUNCH.count) return String(LAUNCH.count - Math.floor(t))
  if (t < LAUNCH.lift + 0.8) return "liftoff"
  return null
}
