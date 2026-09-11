/**
 * defrag — the levels.
 *
 * Each level is a set of rooms, each in its own window. `at` is the screen
 * cell where a room's top-left tile sits when the level starts. `solution` is
 * a script of one way through — drags, crops, clicks, walks and commands —
 * never shown to the player. It exists so the tests can play every level and
 * prove it can be finished; see simulate.ts.
 *
 * Three chapters, each teaching its mechanics one level at a time and then
 * making them work together. See docs/defrag-design.md for the rules.
 */

import { parseFragment, type Fragment, type Trigger, type View, type World } from "./engine"

export interface Spot {
  col: number
  row: number
}

/** A window that works against the player. */
export type Hostile =
  /** Jumps back on top of everything, every `every` ms. */
  | { kind: "popup"; every: number }
  /** Shows for `up` ms, then minimizes itself for `down` ms. Holds while occupied. */
  | { kind: "blink"; up: number; down: number }
  /** Hops to the next spot every `every` ms, taking whoever is inside with it. */
  | { kind: "wander"; spots: Spot[]; every: number }

export interface RoomDef {
  id: string
  title: string
  rows: string[]
  /** Screen cell of the room's top-left tile, whether or not the window shows it. */
  at: Spot
  /** The part of the room the window shows at first, when not all of it. */
  view?: View
  /** The window can be resized, which crops the room. */
  crop?: boolean
  /** Cannot be dragged, resized or closed — unless a switch unlocks it. */
  locked?: boolean
  /** Cannot be dragged, but can be resized if croppable. */
  pinned?: boolean
  /** Always drawn over every other window. */
  onTop?: boolean
  /** A process the terminal can see, and kill once a note has named its pid. */
  pid?: number
  hostile?: Hostile
}

/** A text file a `?` tile opens. */
export interface Note {
  title: string
  lines: string[]
  /** Pids this note names, which makes them killable from the terminal. */
  reveals?: number[]
}

export type Move =
  | { place: string; col: number; row: number }
  | { crop: string; view: View }
  | { raise: string }
  | { walk: { room: string; x: number; y: number } }
  | { kill: number }
  | { hostile: string; state?: "up" | "down" | number }

export interface Level {
  id: string
  name: string
  /** Index into CHAPTERS. */
  chapter: number
  /** One line, shown while the level is played. */
  hint: string
  rooms: RoomDef[]
  /** What each switch does, keyed by the switch tile as "room:x,y". */
  triggers?: Record<string, Trigger[]>
  /** What each note says, keyed by the note tile as "room:x,y". */
  notes?: Record<string, Note>
  solution: Move[]
}

export const CHAPTERS = ["boot", "fragmentation", "hostile"]

/** The smallest a croppable window can be cut to, in tiles. */
export const MIN_CROP = { cols: 6, rows: 2 }

/** The smallest screen every level fits on, controller window included. */
export const MIN_VIEW = { w: 1200, h: 640 }

/** Width of the controller window, which sits to the right of every level. */
export const CONTROLLER_W = 340

/** The furthest right a room may reach, in cells: the controller starts there. */
export const playCols = (view: { w: number }): number =>
  Math.floor((view.w - CONTROLLER_W - 16) / 10)

/** Pids named by the notes read so far. */
export function revealed(level: Level, world: World): number[] {
  const out: number[] = []
  for (const at of world.read) for (const pid of level.notes?.[at]?.reveals ?? []) out.push(pid)
  return out
}

const parsed = new WeakMap<Level, Record<string, Fragment>>()

/** A level's rooms, parsed and keyed by id. */
export function roomsOf(level: Level): Record<string, Fragment> {
  let frags = parsed.get(level)
  if (!frags) {
    frags = Object.fromEntries(level.rooms.map((r) => [r.id, parseFragment(r.id, r.rows)]))
    parsed.set(level, frags)
  }
  return frags
}

/** The part of a room its window shows when the level starts. */
export const fullView = (r: RoomDef): View =>
  r.view ?? { ox: 0, oy: 0, cols: r.rows[0].length, rows: r.rows.length }

/** Where a room's window opens: a wandering room starts at its first spot. */
export const startingAt = (r: RoomDef): Spot =>
  r.hostile?.kind === "wander" ? r.hostile.spots[0] : r.at

/** Where the player starts: the one room with an `@` in it. */
export function startOf(level: Level): { frag: string; x: number; y: number } {
  for (const [id, f] of Object.entries(roomsOf(level))) if (f.start) return { frag: id, ...f.start }
  throw new Error(`level ${level.id} has no start`)
}

/* ── Script shorthand ─────────────────────────────────────────────────── */

const place = (id: string, col: number, row: number): Move => ({ place: id, col, row })
const raise = (id: string): Move => ({ raise: id })
const go = (room: string, x: number, y: number): Move => ({ walk: { room, x, y } })

/* ── The levels ───────────────────────────────────────────────────────── */

export const LEVELS: Level[] = [
  /* ── chapter 1: boot ─────────────────────────────────────────────── */

  {
    id: "handshake",
    name: "handshake",
    chapter: 0,
    hint: "drag the rooms until their open edges meet, then walk across.",
    rooms: [
      {
        id: "a",
        title: "sector 0x00",
        locked: true,
        at: { col: 6, row: 4 },
        rows: [
          "################",
          "#..............#",
          "#.@.............",
          "#..............#",
          "################",
        ],
      },
      {
        id: "b",
        title: "sector 0x1f",
        at: { col: 60, row: 16 },
        rows: [
          "############",
          "..........##",
          "#########.##",
          "#########.##",
          "#########.##",
          "#########.##",
          "#########.##",
          "..........##",
          "############",
        ],
      },
      {
        id: "c",
        title: "sector 0x3a",
        at: { col: 44, row: 4 },
        rows: [
          "############",
          "#..........#",
          "#.>.........",
          "#..........#",
          "############",
        ],
      },
    ],
    solution: [place("b", 22, 5), place("c", 10, 10)],
  },

  {
    id: "tuck",
    name: "tuck",
    chapter: 0,
    hint: "a window's title bar sits over whatever is above it. to go down, the upper room has to be in front.",
    rooms: [
      {
        id: "a",
        title: "sector 0x41",
        locked: true,
        at: { col: 4, row: 3 },
        rows: [
          "##################",
          "#................#",
          "#.@...............",
          "#................#",
          "#................#",
          "##################",
        ],
      },
      {
        id: "b",
        title: "sector 0x5c",
        at: { col: 52, row: 17 },
        rows: [
          "##############",
          "#............#",
          ".............#",
          "#............#",
          "#............#",
          "#............#",
          "#............#",
          "#########.####",
        ],
      },
      {
        id: "c",
        title: "sector 0x7e",
        at: { col: 62, row: 4 },
        rows: [
          "#####.##########",
          "#..............#",
          "#..........>...#",
          "#..............#",
          "#..............#",
          "################",
        ],
      },
    ],
    solution: [place("c", 26, 11), place("b", 22, 3)],
  },

  {
    id: "watchdog",
    name: "watchdog",
    chapter: 0,
    hint: "some windows will not move, and nothing goes over them. only the part you walk on has to show.",
    rooms: [
      {
        id: "a",
        title: "sector 0x90",
        locked: true,
        at: { col: 4, row: 5 },
        rows: [
          "##################",
          "#................#",
          "#.@..............#",
          "#.................",
          "#................#",
          "#................#",
          "##################",
        ],
      },
      {
        id: "w",
        title: "watchdog.sys",
        locked: true,
        onTop: true,
        at: { col: 24, row: 2 },
        rows: [
          "**************",
          "*            *",
          "*   ______   *",
          "*  /      \\  *",
          "*  | (()) |  *",
          "*  \\______/  *",
          "*            *",
          "*  watching  *",
          "*            *",
          "**************",
        ],
      },
      {
        id: "b",
        title: "sector 0xa7",
        at: { col: 50, row: 18 },
        rows: [
          ".#########",
          ".#########",
          ".#########",
          ".#########",
          ".#########",
          "..........",
          "##########",
        ],
      },
      {
        id: "c",
        title: "sector 0xc3",
        at: { col: 62, row: 3 },
        rows: [
          "################",
          "#######.......>#",
          ".......#.......#",
          "######.#.......#",
          "######.#.......#",
          "######.........#",
          "################",
        ],
      },
    ],
    solution: [place("b", 22, 8), place("c", 32, 11)],
  },

  {
    id: "ferry",
    name: "ferry",
    chapter: 0,
    hint: "a room carries whoever is standing in it.",
    rooms: [
      {
        id: "a",
        title: "sector 0xd0",
        locked: true,
        at: { col: 3, row: 3 },
        rows: [
          "################",
          "#..............#",
          "#.@.............",
          "#..............#",
          "#..............#",
          "################",
        ],
      },
      {
        id: "e",
        title: "sector 0xe9",
        locked: true,
        at: { col: 20, row: 20 },
        rows: [
          "################",
          "#..............#",
          "#..>...........#",
          "#...............",
          "#..............#",
          "################",
        ],
      },
      {
        id: "f",
        title: "sector 0xf2",
        at: { col: 60, row: 10 },
        rows: [
          "########",
          "#......#",
          ".......#",
          "#......#",
          "########",
        ],
      },
    ],
    solution: [place("f", 19, 3), go("f", 1, 2), place("f", 36, 21)],
  },

  {
    id: "relay",
    name: "relay",
    chapter: 0,
    hint: "nothing reaches into a window that is always in front from above it.",
    rooms: [
      {
        id: "a",
        title: "sector 0x100",
        locked: true,
        at: { col: 3, row: 2 },
        rows: [
          "################",
          "#..............#",
          "#.@............#",
          "#..............#",
          "#..............#",
          "######.#########",
        ],
      },
      {
        id: "w",
        title: "watchdog.sys",
        locked: true,
        onTop: true,
        at: { col: 30, row: 6 },
        rows: [
          "**************",
          "*............*",
          "*.**********.*",
          "*.*        *.*",
          "*.*  ____  *.*",
          "*.* |(())| *.*",
          "*.* |____| *..",
          "*.*        *.*",
          "*.*  still *.*",
          "*.* watch- *.*",
          "*.*  ing   *.*",
          "*.**********.*",
          "*............*",
          "*****.********",
        ],
      },
      {
        id: "e",
        title: "sector 0x1c4",
        locked: true,
        at: { col: 60, row: 4 },
        rows: [
          "################",
          "#..............#",
          "#..............#",
          "#.........>....#",
          "#..............#",
          "...............#",
          "#..............#",
          "################",
        ],
      },
      {
        id: "f",
        title: "sector 0x12b",
        at: { col: 5, row: 21 },
        rows: [
          "####.#####",
          "#........#",
          "#........#",
          "#........#",
          "##########",
        ],
      },
      {
        id: "b",
        title: "sector 0x16e",
        at: { col: 50, row: 22 },
        rows: [
          "################",
          "#...............",
          "#..............#",
          "#..............#",
          "...............#",
          "################",
        ],
      },
    ],
    solution: [
      place("f", 5, 8),
      raise("a"),
      go("f", 4, 1),
      place("f", 31, 20),
      go("w", 13, 6),
      place("b", 44, 8),
    ],
  },

  /* ── chapter 2: fragmentation ────────────────────────────────────── */

  {
    id: "crop",
    name: "crop",
    chapter: 1,
    hint: "a window's edge is its room's edge. drag an edge of a room's window to cut into it.",
    rooms: [
      {
        id: "a",
        title: "sector 0x200",
        pinned: true,
        crop: true,
        at: { col: 3, row: 3 },
        rows: [
          "##################",
          "#......#.........#",
          "#..@...#.........#",
          "#......#.........#",
          "#......#.........#",
          "#......#.........#",
          "##################",
        ],
      },
      {
        id: "e",
        title: "sector 0x2b1",
        at: { col: 50, row: 15 },
        rows: [
          "####.#########",
          "#............#",
          "#.........>..#",
          "#............#",
          "#............#",
          "##############",
        ],
      },
    ],
    solution: [
      { crop: "a", view: { ox: 0, oy: 0, cols: 18, rows: 6 } },
      place("e", 2, 9),
      raise("a"),
    ],
  },

  {
    id: "cut",
    name: "cut to size",
    chapter: 1,
    hint: "a room can be cut down to fit the gap it has to fill. cut from any edge.",
    rooms: [
      {
        id: "a",
        title: "sector 0x300",
        locked: true,
        at: { col: 2, row: 6 },
        rows: [
          "##############",
          "#............#",
          "#............#",
          "#.@...........",
          "#............#",
          "#............#",
          "##############",
        ],
      },
      {
        id: "e",
        title: "sector 0x3f0",
        locked: true,
        at: { col: 30, row: 7 },
        rows: [
          "################",
          "#..............#",
          "#.........>....#",
          "#..............#",
          "#..............#",
          "#..............#",
          "...............#",
          "#..............#",
          "################",
        ],
      },
      {
        id: "m",
        title: "pipe.dat",
        crop: true,
        at: { col: 40, row: 18 },
        rows: [
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "--------------------------------",
          ".....................~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~.~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~.~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~.~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~............",
          "--------------------------------",
        ],
      },
    ],
    solution: [
      { crop: "m", view: { ox: 10, oy: 0, cols: 14, rows: 8 } },
      place("m", 6, 7),
    ],
  },

  {
    id: "keys",
    name: "keys",
    chapter: 1,
    hint: "a key opens one door, once.",
    rooms: [
      {
        id: "a",
        title: "sector 0x400",
        locked: true,
        at: { col: 3, row: 8 },
        rows: [
          "##############",
          "#............#",
          "#.@...........",
          "#............#",
          "#............#",
          "##############",
        ],
      },
      {
        id: "e",
        title: "sector 0x4e2",
        locked: true,
        at: { col: 40, row: 6 },
        rows: [
          "##############",
          "#............#",
          "#............#",
          "#.......>....#",
          ".............#",
          "#............#",
          "#............#",
          "#............#",
          "##############",
        ],
      },
      {
        id: "d",
        title: "sector 0x44d",
        at: { col: 45, row: 22 },
        rows: [
          "######.################",
          "#.........#############",
          "...........%...........",
          "#.........#############",
          "#######################",
        ],
      },
      {
        id: "k",
        title: "sector 0x4a1",
        at: { col: 64, row: 3 },
        rows: [
          "##########",
          "#........#",
          "#...$....#",
          "#........#",
          "#........#",
          "######.###",
        ],
      },
    ],
    solution: [place("d", 17, 8), place("k", 17, 2), go("k", 4, 2), go("d", 11, 2)],
  },

  {
    id: "switch",
    name: "switch",
    chapter: 1,
    hint: "a switch flips every gate: + opens and = shuts. step on it again and they flip back.",
    rooms: [
      {
        id: "a",
        title: "sector 0x500",
        locked: true,
        at: { col: 3, row: 4 },
        rows: [
          "##############",
          "#............#",
          "#.@...........",
          "#............#",
          "#............#",
          "##############",
        ],
      },
      {
        id: "e",
        title: "sector 0x5e7",
        locked: true,
        at: { col: 50, row: 18 },
        rows: [
          "##############",
          "#####........#",
          "#####..>.....#",
          "....=........#",
          "#####........#",
          "#####........#",
          "##############",
        ],
      },
      {
        id: "s",
        title: "sector 0x53c",
        at: { col: 55, row: 3 },
        rows: [
          "################",
          "#######........#",
          "......=...^....#",
          "#######........#",
          "#######........#",
          "#######........#",
          "############.###",
        ],
      },
      {
        id: "x",
        title: "sector 0x571",
        at: { col: 8, row: 20 },
        rows: [
          "##.###########",
          "##+###########",
          "##.........###",
          "##########.^..",
          "##############",
        ],
      },
    ],
    triggers: { "s:10,2": [{ kind: "gates" }], "x:11,3": [{ kind: "gates" }] },
    solution: [
      place("x", 36, 18),
      place("s", 17, 4),
      go("s", 10, 2),
      place("s", 26, 11),
      go("x", 11, 3),
    ],
  },

  {
    id: "fragmentation",
    name: "fragmentation",
    chapter: 1,
    hint: "cut, carry, unlock — in whatever order works.",
    rooms: [
      {
        id: "a",
        title: "sector 0x600",
        pinned: true,
        crop: true,
        at: { col: 1, row: 21 },
        rows: [
          "################",
          "#..............#",
          "#.@............#",
          "#..............#",
          "#..............#",
          "#..............#",
          "#..............#",
          "#..............#",
          "################",
        ],
      },
      {
        id: "x",
        title: "bad sector",
        locked: true,
        at: { col: 17, row: 18 },
        rows: [
          "xxxxxxxxxx",
          "x x x x xx",
          "xx x x x x",
          "x x x x xx",
          "xx x x x x",
          "x x x x xx",
          "xx x x x x",
          "x x x x xx",
          "xx x x x x",
          "x x x x xx",
          "xx x x x x",
          "xxxxxxxxxx",
        ],
      },
      {
        id: "e",
        title: "sector 0x6f8",
        locked: true,
        at: { col: 60, row: 8 },
        rows: [
          "################",
          "#.......#......#",
          "#.......#..>...#",
          "........%......#",
          "#.......#......#",
          "#.......#......#",
          "#.......#......#",
          "################",
        ],
      },
      {
        id: "s",
        title: "sector 0x63a",
        at: { col: 44, row: 2 },
        rows: [
          "###################",
          "#.......#.........#",
          "#...^...+....$....#",
          "#.......#..........",
          "#.......#.........#",
          "####.##############",
        ],
      },
      {
        id: "l",
        title: "sector 0x6c0",
        locked: true,
        crop: true,
        at: { col: 30, row: 17 },
        rows: [
          "########################################",
          "########################################",
          "####################....................",
          "####################.###################",
          "####################.###################",
          "####################.###################",
          "####################.###################",
          "####################.###################",
          "####################.###################",
          "####################.###################",
          ".....................###################",
          "########################################",
        ],
      },
    ],
    triggers: { "s:4,2": [{ kind: "gates" }, { kind: "unlock", frag: "l" }] },
    solution: [
      { crop: "a", view: { ox: 0, oy: 1, cols: 16, rows: 8 } },
      place("s", 5, 16),
      go("s", 4, 2),
      go("s", 13, 2),
      { crop: "l", view: { ox: 2, oy: 0, cols: 36, rows: 12 } },
      place("l", 22, 9),
      go("e", 8, 3),
    ],
  },

  /* ── chapter 3: hostile ──────────────────────────────────────────── */

  {
    id: "kill",
    name: "kill",
    chapter: 2,
    hint: "some windows are only processes. find the number, then open a terminal.",
    rooms: [
      {
        id: "a",
        title: "sector 0x700",
        locked: true,
        at: { col: 3, row: 4 },
        rows: [
          "################",
          "#..............#",
          "#..............#",
          "#.@.............",
          "#..............#",
          "#..............#",
          "#######.########",
        ],
      },
      {
        id: "w",
        title: "watchdog.sys",
        locked: true,
        onTop: true,
        pid: 4127,
        at: { col: 32, row: 3 },
        rows: [
          "************",
          "*          *",
          "*  ______  *",
          "* /      \\ *",
          "* | (()) | *",
          "* \\______/ *",
          "*          *",
          "*  i  see  *",
          "*   you    *",
          "*          *",
          "*          *",
          "************",
        ],
      },
      {
        id: "e",
        title: "sector 0x7e0",
        locked: true,
        at: { col: 36, row: 6 },
        rows: [
          "##############",
          "#............#",
          "#............#",
          "#.........>..#",
          ".............#",
          "#............#",
          "#............#",
          "##############",
        ],
      },
      {
        id: "n",
        title: "sector 0x7a2",
        at: { col: 60, row: 20 },
        rows: [
          "#####.####",
          "#........#",
          "#...?....#",
          "#........#",
          "##########",
        ],
      },
      {
        id: "b",
        title: "sector 0x755",
        at: { col: 8, row: 20 },
        rows: [
          "#################",
          ".........########",
          "########.########",
          "########.########",
          "########.........",
          "#################",
        ],
      },
    ],
    notes: {
      "n:4,2": {
        title: "readme.txt",
        lines: [
          "to whoever is still running —",
          "",
          "the watchdog sat down on the door to the last sector",
          "and it will not get up. nothing goes over it.",
          "",
          "it is only a process, though. its pid is 4127.",
          "open a terminal and type:  kill 4127",
        ],
        reveals: [4127],
      },
    },
    solution: [
      place("n", 5, 11),
      raise("a"),
      go("n", 4, 2),
      { kill: 4127 },
      place("b", 19, 6),
    ],
  },

  {
    id: "blink",
    name: "blink",
    chapter: 2,
    hint: "some windows come and go. none of them will vanish with you inside.",
    rooms: [
      {
        id: "a",
        title: "sector 0x800",
        locked: true,
        at: { col: 3, row: 3 },
        rows: [
          "##############",
          "#............#",
          "#.@...........",
          "#............#",
          "#............#",
          "#####.########",
        ],
      },
      {
        id: "q",
        title: "flicker.exe",
        onTop: true,
        hostile: { kind: "blink", up: 3500, down: 2500 },
        at: { col: 26, row: 3 },
        rows: [
          "**************",
          "*............*",
          ".............*",
          "*.**********.*",
          "*.*        *.*",
          "*.* blink  *.*",
          "*.*        *..",
          "*.**********.*",
          "*............*",
          "**************",
        ],
      },
      {
        id: "k",
        title: "sector 0x8c4",
        locked: true,
        at: { col: 20, row: 10 },
        rows: [
          "################",
          "#...........$..#",
          "#..............#",
          "#..............#",
          "...............#",
          "#..............#",
          "################",
        ],
      },
      {
        id: "e",
        title: "sector 0x8f1",
        locked: true,
        at: { col: 52, row: 6 },
        rows: [
          "##############",
          "#......#.....#",
          "#......#..>..#",
          ".......%.....#",
          "#......#.....#",
          "#......#.....#",
          "##############",
        ],
      },
      {
        id: "b",
        title: "sector 0x81b",
        at: { col: 60, row: 20 },
        rows: ["#########", ".........", "#########"],
      },
      {
        id: "c",
        title: "sector 0x833",
        at: { col: 44, row: 18 },
        rows: [
          "#.###########",
          "#...........#",
          "#...........#",
          "#...........#",
          "#...........#",
          "#............",
          "#############",
        ],
      },
      {
        id: "d",
        title: "sector 0x86e",
        at: { col: 64, row: 25 },
        rows: ["############", "............", "############"],
      },
    ],
    solution: [
      place("c", 7, 9),
      raise("a"),
      { hostile: "q", state: "down" },
      go("k", 12, 1),
      go("a", 2, 2),
      { hostile: "q", state: "up" },
      place("b", 17, 4),
      place("d", 40, 8),
      go("e", 7, 3),
    ],
  },

  {
    id: "drift",
    name: "drift",
    chapter: 2,
    hint: "some windows wander. they take whoever is inside along.",
    rooms: [
      {
        id: "a",
        title: "sector 0x900",
        locked: true,
        at: { col: 2, row: 3 },
        rows: [
          "##############",
          "#............#",
          "#............#",
          "#.@...........",
          "#............#",
          "##############",
        ],
      },
      {
        id: "v",
        title: "drifter.exe",
        hostile: {
          kind: "wander",
          every: 4000,
          spots: [
            { col: 16, row: 4 },
            { col: 44, row: 3 },
            { col: 62, row: 14 },
          ],
        },
        at: { col: 16, row: 4 },
        rows: [
          "############",
          "#..........#",
          "...........#",
          "#..........#",
          "#..........#",
          "######.#####",
        ],
      },
      {
        id: "e",
        title: "sector 0x9e3",
        locked: true,
        at: { col: 38, row: 19 },
        rows: [
          "################",
          "#.......#......#",
          "#..>....#......#",
          "#.......#......#",
          "#.......%.......",
          "#.......#......#",
          "#.......#......#",
          "################",
        ],
      },
      {
        id: "k",
        title: "sector 0x94a",
        at: { col: 4, row: 14 },
        rows: [
          "############",
          "#..........#",
          "#...$.......",
          "#..........#",
          "############",
        ],
      },
      {
        id: "b",
        title: "sector 0x9b6",
        at: { col: 12, row: 22 },
        rows: [
          "##############.###",
          "#................#",
          "#................#",
          ".................#",
          "#................#",
          "##################",
        ],
      },
    ],
    solution: [
      place("k", 32, 3),
      place("b", 54, 20),
      go("v", 1, 2),
      { hostile: "v", state: 1 },
      go("k", 4, 2),
      { hostile: "v", state: 2 },
      { hostile: "v", state: 0 },
      { hostile: "v", state: 1 },
      go("v", 1, 2),
      { hostile: "v", state: 2 },
      go("e", 8, 4),
    ],
  },

  {
    id: "popup",
    name: "popup",
    chapter: 2,
    hint: "you can click past a popup, but it will not stay behind for long.",
    rooms: [
      {
        id: "a",
        title: "sector 0xa00",
        locked: true,
        at: { col: 2, row: 5 },
        rows: [
          "##############",
          "#............#",
          "#.@...........",
          "#............#",
          "#............#",
          "##############",
        ],
      },
      {
        id: "n",
        title: "sector 0xa1f",
        pinned: true,
        crop: true,
        at: { col: 15, row: 4 },
        rows: [
          "############",
          "#..........#",
          "#..........#",
          "#...?.......",
          "#..........#",
          "#..........#",
          "############",
        ],
      },
      {
        id: "e",
        title: "sector 0xaf0",
        locked: true,
        at: { col: 47, row: 4 },
        rows: [
          "##############",
          "#............#",
          "#............#",
          ".............#",
          "#............#",
          "#.........>..#",
          "#............#",
          "##############",
        ],
      },
      {
        id: "p",
        title: "WINNER!!.exe",
        pid: 1337,
        hostile: { kind: "popup", every: 2500 },
        at: { col: 30, row: 4 },
        rows: [
          "!!!!!!!!!!!!",
          "!          !",
          "! YOU  ARE !",
          "!   THE    !",
          "! 1000000th!",
          "! VISITOR  !",
          "!          !",
          "!!!!!!!!!!!!",
        ],
      },
      {
        id: "q",
        title: "FREE_RAM.exe",
        pid: 666,
        hostile: { kind: "popup", every: 3100 },
        at: { col: 44, row: 3 },
        rows: [
          "oooooooooo",
          "o        o",
          "o FREE   o",
          "o  RAM   o",
          "o CLICK  o",
          "o  NOW   o",
          "o        o",
          "o        o",
          "oooooooooo",
        ],
      },
      {
        id: "b",
        title: "sector 0xa6b",
        at: { col: 8, row: 20 },
        rows: [
          "####################",
          "....................",
          "##########.#########",
          "##########.#########",
          "##########.#########",
        ],
      },
      {
        id: "k",
        title: "sector 0xa93",
        at: { col: 60, row: 17 },
        rows: [
          "####.#####",
          "#........#",
          "#..?.....#",
          "#........#",
          "##########",
        ],
      },
    ],
    notes: {
      "n:4,3": {
        title: "sysadmin.log",
        lines: [
          "day 41. the popups are back. i close one and it jumps",
          "in front of everything again a few seconds later.",
          "",
          "the one that says i won something is pid 1337.",
          "the other one keeps moving its pid. i left it written",
          "down somewhere further in.",
        ],
        reveals: [1337],
      },
      "k:3,2": {
        title: "sysadmin.log (2)",
        lines: [
          "day 43. FREE_RAM is pid 666. of course it is.",
          "",
          "if you are reading this, i did not make it to the",
          "last sector. you might.",
        ],
        reveals: [666],
      },
    },
    solution: [
      { crop: "n", view: { ox: 1, oy: 0, cols: 11, rows: 7 } },
      go("n", 4, 3),
      { kill: 1337 },
      place("b", 27, 6),
      place("k", 33, 11),
      raise("b"),
      go("k", 3, 2),
      { kill: 666 },
    ],
  },

  {
    id: "defrag",
    name: "defrag",
    chapter: 2,
    hint: "the last sector. everything you know, in one place.",
    rooms: [
      {
        id: "a",
        title: "sector 0xf00",
        pinned: true,
        crop: true,
        at: { col: 1, row: 2 },
        rows: [
          "##############",
          "#............#",
          "#.@?.........#",
          "#............#",
          "#............#",
          "#............#",
          "#............#",
          "##############",
        ],
      },
      {
        id: "x",
        title: "bad sector",
        locked: true,
        onTop: true,
        at: { col: 1, row: 11 },
        rows: ["xxxxxxxxxxxxxx", "x x x x x x xx", "xx x x x x x x", "xxxxxxxxxxxxxx"],
      },
      {
        id: "e",
        title: "sector 0xfff",
        locked: true,
        at: { col: 2, row: 18 },
        rows: [
          "################",
          "#......#.......#",
          "#..>...#.......#",
          "#......%........",
          "#......#.......#",
          "#......#.......#",
          "#......#.......#",
          "################",
        ],
      },
      {
        id: "w",
        title: "init",
        locked: true,
        onTop: true,
        pid: 1,
        at: { col: 1, row: 16 },
        rows: [
          "&&&&&&&&&&&&&&&&&&",
          "&                &",
          "&    ________    &",
          "&   /        \\   &",
          "&  |  (())    |  &",
          "&  |    (())  |  &",
          "&   \\________/   &",
          "&                &",
          "&   everything   &",
          "&   is  fine     &",
          "&&&&&&&&&&&&&&&&&&",
        ],
      },
      {
        id: "v",
        title: "drifter.exe",
        hostile: {
          kind: "wander",
          every: 4000,
          spots: [
            { col: 28, row: 5 },
            { col: 50, row: 2 },
            { col: 40, row: 20 },
          ],
        },
        at: { col: 28, row: 5 },
        rows: [
          "############",
          "#..........#",
          "...........#",
          "#..........#",
          "#..........#",
          "#####.######",
        ],
      },
      {
        id: "s",
        title: "sector 0xf3a",
        at: { col: 60, row: 14 },
        rows: [
          "##############",
          "#.......#....#",
          "#.......#....#",
          "........#....#",
          "#...^...#....#",
          "#.......+.....",
          "#.......#....#",
          "##############",
        ],
      },
      {
        id: "k",
        title: "sector 0xf71",
        at: { col: 66, row: 24 },
        rows: [
          "####.#####",
          "#........#",
          "#...$....#",
          "#........#",
          "##########",
        ],
      },
      {
        id: "l",
        title: "sector 0xfc2",
        locked: true,
        crop: true,
        at: { col: 30, row: 13 },
        rows: [
          "##############################",
          "##############################",
          "..........................####",
          "#########################.####",
          "#########################.....",
          "##############################",
          "###.......................####",
          "###.#######################.##",
          "###.......................#.##",
          "##############################",
        ],
      },
    ],
    triggers: { "s:4,4": [{ kind: "gates" }, { kind: "unlock", frag: "l" }] },
    notes: {
      "a:3,2": {
        title: "boot.log",
        lines: [
          "[ ok ] mounting sectors",
          "[fail] sector 0xfff: held by pid 1 (init)",
          "[fail] sector 0xfff: door requires key",
          "[ ok ] starting drifter.exe",
          "",
          "note to self: killing pid 1 on a real machine is",
          "a very bad idea. here it is the only one left.",
        ],
        reveals: [1],
      },
    },
    solution: [
      go("a", 3, 2),
      { crop: "a", view: { ox: 0, oy: 0, cols: 13, rows: 8 } },
      place("k", 51, 8),
      place("s", 14, 2),
      go("s", 4, 4),
      go("v", 1, 2),
      { hostile: "v", state: 1 },
      go("k", 4, 2),
      { hostile: "v", state: 2 },
      { hostile: "v", state: 0 },
      { hostile: "v", state: 1 },
      go("v", 5, 4),
      { hostile: "v", state: 2 },
      { kill: 1 },
      { crop: "l", view: { ox: 4, oy: 0, cols: 22, rows: 10 } },
      place("l", 14, 19),
      go("e", 7, 3),
    ],
  },
]

/** Window ids for a level's rooms. Namespaced so they cannot meet a VFS path. */
export const roomWindowId = (roomId: string): string => `defrag:${roomId}`
export const isRoomWindow = (id: string): boolean => id.startsWith("defrag:")
export const roomIdOf = (winId: string): string => winId.slice("defrag:".length)
