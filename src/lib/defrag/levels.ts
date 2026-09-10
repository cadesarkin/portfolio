/**
 * defrag — the levels.
 *
 * Each level is a set of fragment windows. `at` is where a window opens and
 * `solution` is one layout that works, in grid cells. The solution is never
 * shown to the player; it exists so a test can prove every level can be
 * finished, and that none of them is finished before the player touches it.
 *
 * Each level teaches one thing, and the order matters:
 *   1. rooms join where their edges meet
 *   2. a title bar sits above a room, so going down needs the upper window on top
 *   3. some windows will not move, and will not go under anything
 */

import { parseFragment, type Fragment } from "./engine"

export interface FragmentDef {
  id: string
  title: string
  rows: string[]
  at: { col: number; row: number }
  /** Cannot be dragged, closed or minimized. */
  locked?: boolean
  /** Always drawn over every other window. */
  onTop?: boolean
}

export interface Level {
  id: string
  name: string
  /** One line, shown while the level is played. */
  hint: string
  fragments: FragmentDef[]
  solution: {
    /** Where each movable fragment goes. Locked ones stay put. */
    at: Record<string, { col: number; row: number }>
    /** Stacking order, lowest first, where it matters. */
    order?: string[]
  }
}

export const LEVELS: Level[] = [
  {
    id: "handshake",
    name: "handshake",
    hint: "drag the rooms until their open edges meet, then walk across.",
    fragments: [
      {
        id: "a",
        title: "sector 0x00",
        locked: true,
        at: { col: 4, row: 3 },
        rows: [
          "##################",
          "#................#",
          "#.@..............#",
          "#................#",
          "#.................",
          "#................#",
          "##################",
        ],
      },
      {
        id: "b",
        title: "sector 0x1f",
        at: { col: 10, row: 20 },
        rows: [
          "####################",
          ".........###########",
          "########.###########",
          "########.###########",
          "########.###########",
          "########............",
          "####################",
        ],
      },
      {
        id: "c",
        title: "sector 0x3a",
        at: { col: 60, row: 19 },
        rows: [
          "################",
          "#..............#",
          "#..........>...#",
          "...............#",
          "#..............#",
          "#..............#",
          "################",
        ],
      },
    ],
    solution: { at: { b: { col: 22, row: 6 }, c: { col: 42, row: 8 } } },
  },

  {
    id: "tuck",
    name: "tuck",
    hint: "a window's title bar sits above its room. to go down, the room above has to be on top.",
    fragments: [
      {
        id: "a",
        title: "sector 0x41",
        locked: true,
        at: { col: 4, row: 3 },
        rows: [
          "##################",
          "#.@..............#",
          "#................#",
          "#................#",
          "#................#",
          "#########.########",
        ],
      },
      {
        id: "b",
        title: "sector 0x5c",
        at: { col: 44, row: 20 },
        rows: [
          "###.############",
          "#..............#",
          "#..............#",
          "#..............#",
          "#..............#",
          "#...............",
          "################",
        ],
      },
      {
        id: "c",
        title: "sector 0x7e",
        at: { col: 64, row: 4 },
        rows: [
          "##############",
          "#............#",
          ".......>.....#",
          "#............#",
          "#............#",
          "#............#",
          "##############",
        ],
      },
    ],
    solution: {
      at: { b: { col: 10, row: 9 }, c: { col: 26, row: 12 } },
      order: ["c", "b", "a"],
    },
  },

  {
    id: "watchdog",
    name: "watchdog",
    hint: "some windows will not move, and will not go under anything. find the way round.",
    fragments: [
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
          "+----------+",
          "|          |",
          "|   ____   |",
          "|  / () \\  |",
          "|  \\____/  |",
          "|          |",
          "|  WATCH   |",
          "|          |",
          "+----------+",
        ],
      },
      {
        id: "b",
        title: "sector 0xa7",
        at: { col: 50, row: 20 },
        rows: [
          "##########",
          "..........",
          "#.########",
          "#.########",
          "#.########",
          "#.########",
          "#.########",
          "#.........",
          "##########",
        ],
      },
      {
        id: "c",
        title: "sector 0xc3",
        at: { col: 66, row: 19 },
        rows: [
          "##############",
          "#............#",
          ".......>.....#",
          "#............#",
          "#............#",
          "#............#",
          "##############",
        ],
      },
    ],
    solution: { at: { b: { col: 22, row: 7 }, c: { col: 32, row: 12 } } },
  },
]

/** The smallest screen every level fits on, controller window included. */
export const MIN_VIEW = { w: 1200, h: 640 }

/** Width of the controller window, which sits to the right of every level. */
export const CONTROLLER_W = 340

/** A level's rooms, parsed and keyed by id. */
export function fragmentsOf(level: Level): Record<string, Fragment> {
  return Object.fromEntries(level.fragments.map((f) => [f.id, parseFragment(f.id, f.rows)]))
}

/** Where the player starts: the one fragment with an `@` in it. */
export function startOf(level: Level): { frag: string; x: number; y: number } {
  for (const f of level.fragments) {
    const parsed = parseFragment(f.id, f.rows)
    if (parsed.start) return { frag: f.id, ...parsed.start }
  }
  throw new Error(`level ${level.id} has no start`)
}

/** Window ids for a level's fragments. Namespaced so they cannot meet a VFS path. */
export const fragmentWindowId = (fragId: string): string => `defrag:${fragId}`
export const isFragmentWindow = (id: string): boolean => id.startsWith("defrag:")
export const fragmentIdOf = (winId: string): string => winId.slice("defrag:".length)
