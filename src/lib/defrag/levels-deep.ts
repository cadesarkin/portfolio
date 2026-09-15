/**
 * defrag — the deep end.
 *
 * Chapters four and five: the same rules as the first fifteen levels, with
 * nothing lit for you and a lot more to do. Every level here says how many
 * moves it should take at the least, `par`, and the tests set the shortcut
 * hunter (hunt.ts) on it to make sure it cannot be done in fewer.
 *
 * Kept apart from levels.ts so the first three chapters stay readable. It
 * imports only types from there: levels.ts imports this file.
 */

import type { Level, Move } from "./levels"
import type { Dir } from "./engine"

const place = (id: string, col: number, row: number): Move => ({ place: id, col, row })
const raise = (id: string): Move => ({ raise: id })
const go = (room: string, x: number, y: number): Move => ({ walk: { room, x, y } })

/**
 * A walled room, open inside, with doors cut into its edges. `at` counts
 * along the edge: a row for left and right, a column for top and bottom.
 * `marks` put tiles inside it: the start, the exit, keys, switches, walls.
 */
export function box(
  w: number,
  h: number,
  doors: { side: Dir; at: number }[],
  marks: { x: number; y: number; ch: string }[] = []
): string[] {
  const g: string[][] = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? "#" : "."))
  )
  for (const d of doors) {
    if (d.side === "left") g[d.at][0] = "."
    if (d.side === "right") g[d.at][w - 1] = "."
    if (d.side === "up") g[0][d.at] = "."
    if (d.side === "down") g[h - 1][d.at] = "."
  }
  for (const m of marks) g[m.y][m.x] = m.ch
  return g.map((r) => r.join(""))
}

/** A block of wall with words on it, for watchdogs and the like. */
export function sign(w: number, h: number, text: string[]): string[] {
  const edge = "*".repeat(w)
  const rows = [edge]
  for (let y = 1; y < h - 1; y++) rows.push(`*${(text[y - 1] ?? "").padEnd(w - 2).slice(0, w - 2)}*`)
  rows.push(edge)
  return rows
}

export const DEEP_CHAPTERS = ["relocation", "kernel"]

export const DEEP_LEVELS: Level[] = [
  /* ── chapter 4: relocation ───────────────────────────────────────── */

  {
    id: "leapfrog",
    name: "leapfrog",
    chapter: 3,
    par: 4,
    hint: "heavy rooms will not move while you stand in them. two bridges, four gaps — and nothing lights up any more.",
    rooms: [
      {
        id: "a",
        title: "sector 0x1000",
        locked: true,
        at: { col: 1, row: 9 },
        rows: box(8, 7, [{ side: "right", at: 3 }], [{ x: 2, y: 2, ch: "@" }]),
      },
      {
        id: "i1",
        title: "sector 0x1100",
        locked: true,
        at: { col: 17, row: 11 },
        rows: box(6, 7, [
          { side: "left", at: 3 },
          { side: "right", at: 3 },
        ]),
      },
      {
        id: "i2",
        title: "sector 0x1200",
        locked: true,
        at: { col: 35, row: 9 },
        rows: box(6, 7, [
          { side: "left", at: 3 },
          { side: "right", at: 3 },
        ]),
      },
      {
        id: "i3",
        title: "sector 0x1300",
        locked: true,
        at: { col: 49, row: 11 },
        rows: box(6, 7, [
          { side: "left", at: 3 },
          { side: "right", at: 3 },
        ]),
      },
      {
        id: "e",
        title: "sector 0x1400",
        locked: true,
        at: { col: 67, row: 9 },
        rows: box(12, 7, [{ side: "left", at: 3 }], [{ x: 7, y: 2, ch: ">" }]),
      },
      {
        id: "p",
        heavy: true,
        title: "sector 0x1a01",
        at: { col: 4, row: 22 },
        rows: ["########", "....####", "###.####", "###.....", "########"],
      },
      {
        id: "q",
        heavy: true,
        title: "sector 0x1a02",
        at: { col: 24, row: 22 },
        rows: ["############", "#######.....", "#######.####", "........####", "############"],
      },
      {
        id: "pp",
        heavy: true,
        title: "sector 0x1a03",
        at: { col: 44, row: 22 },
        rows: ["########", "###.....", "###.####", "....####", "########"],
      },
      {
        id: "qq",
        heavy: true,
        title: "sector 0x1a04",
        at: { col: 60, row: 22 },
        rows: ["############", "........####", "#######.####", "#######.....", "############"],
      },
    ],
    solution: [place("p", 9, 11), place("q", 23, 11), go("i2", 3, 3), place("p", 41, 11), go("i3", 3, 3), place("q", 55, 11)],
  },

  {
    id: "switchback",
    name: "switchback",
    chapter: 3,
    par: 4,
    hint: "down the ledges. a room going down into another has to be in front of it.",
    rooms: [
      {
        id: "a",
        title: "sector 0x2000",
        locked: true,
        at: { col: 2, row: 2 },
        rows: box(12, 5, [{ side: "down", at: 6 }], [{ x: 2, y: 2, ch: "@" }]),
      },
      {
        id: "l1",
        title: "sector 0x2100",
        locked: true,
        at: { col: 6, row: 12 },
        rows: box(12, 5, [
          { side: "up", at: 4 },
          { side: "right", at: 2 },
        ]),
      },
      {
        id: "l2",
        title: "sector 0x2200",
        locked: true,
        at: { col: 30, row: 12 },
        rows: box(12, 5, [
          { side: "left", at: 2 },
          { side: "down", at: 6 },
        ]),
      },
      {
        id: "l3",
        title: "sector 0x2300",
        locked: true,
        at: { col: 34, row: 22 },
        rows: box(12, 5, [
          { side: "up", at: 4 },
          { side: "right", at: 2 },
        ]),
      },
      {
        id: "e",
        title: "sector 0x2400",
        locked: true,
        at: { col: 58, row: 22 },
        rows: box(14, 6, [{ side: "left", at: 2 }], [{ x: 9, y: 2, ch: ">" }]),
      },
      {
        id: "v",
        title: "sector 0x2a01",
        heavy: true,
        at: { col: 66, row: 3 },
        rows: box(6, 5, [
          { side: "up", at: 2 },
          { side: "down", at: 4 },
        ]),
      },
      {
        id: "h",
        title: "sector 0x2a02",
        heavy: true,
        at: { col: 48, row: 4 },
        rows: box(12, 3, [
          { side: "left", at: 1 },
          { side: "right", at: 1 },
        ]),
      },
      {
        id: "vv",
        title: "sector 0x2a03",
        heavy: true,
        at: { col: 75, row: 11 },
        rows: box(6, 5, [
          { side: "up", at: 4 },
          { side: "down", at: 2 },
        ]),
      },
      {
        id: "hh",
        title: "sector 0x2a04",
        heavy: true,
        at: { col: 60, row: 15 },
        rows: box(10, 3, [
          { side: "left", at: 1 },
          { side: "right", at: 1 },
        ]),
      },
    ],
    solution: [
      place("v", 6, 7),
      raise("a"),
      place("h", 18, 13),
      go("l2", 6, 3),
      place("v", 34, 17),
      raise("l2"),
      go("l3", 6, 3),
      place("h", 46, 23),
    ],
  },

  {
    id: "errands",
    name: "errands",
    chapter: 3,
    par: 3,
    hint: "a key one way, a switch the other, and only so many bridges.",
    rooms: [
      {
        id: "a",
        title: "sector 0x3000",
        locked: true,
        at: { col: 30, row: 5 },
        rows: box(
          10,
          8,
          [
            { side: "right", at: 4 },
            { side: "down", at: 4 },
          ],
          [{ x: 2, y: 2, ch: "@" }]
        ),
      },
      {
        id: "k",
        title: "sector 0x3100",
        locked: true,
        at: { col: 62, row: 3 },
        rows: box(8, 5, [{ side: "left", at: 2 }], [{ x: 4, y: 2, ch: "$" }]),
      },
      {
        id: "s",
        title: "sector 0x3200",
        locked: true,
        at: { col: 32, row: 19 },
        rows: box(
          10,
          6,
          [
            { side: "up", at: 3 },
            { side: "right", at: 4 },
          ],
          [{ x: 6, y: 2, ch: "^" }]
        ),
      },
      {
        id: "e",
        title: "sector 0x3300",
        locked: true,
        at: { col: 64, row: 16 },
        rows: [
          "############",
          "#######....#",
          "#######.>..#",
          "...+..%....#",
          "#######....#",
          "############",
        ],
      },
      {
        id: "b1",
        title: "sector 0x3a01",
        heavy: true,
        at: { col: 2, row: 22 },
        rows: box(22, 7, [
          { side: "left", at: 5 },
          { side: "right", at: 1 },
        ]),
      },
      {
        id: "b2",
        title: "sector 0x3a02",
        heavy: true,
        at: { col: 10, row: 4 },
        rows: box(6, 6, [
          { side: "up", at: 2 },
          { side: "down", at: 3 },
        ]),
      },
      {
        id: "b3",
        title: "sector 0x3a03",
        heavy: true,
        at: { col: 2, row: 13 },
        rows: box(22, 7, [
          { side: "left", at: 1 },
          { side: "right", at: 5 },
        ]),
      },
    ],
    triggers: { "s:6,2": [{ kind: "gates" }] },
    solution: [
      place("b1", 40, 4),
      place("b2", 32, 13),
      raise("a"),
      go("k", 4, 2),
      go("s", 6, 2),
      place("b1", 42, 18),
      go("e", 6, 3),
    ],
  },

  {
    id: "shuttle",
    name: "shuttle",
    chapter: 3,
    par: 5,
    hint: "three keys, three doors, and one room light enough to carry you.",
    rooms: [
      {
        id: "a",
        title: "sector 0x4000",
        locked: true,
        at: { col: 34, row: 11 },
        rows: box(12, 7, [{ side: "right", at: 3 }], [{ x: 3, y: 3, ch: "@" }]),
      },
      {
        id: "k1",
        title: "sector 0x4100",
        locked: true,
        at: { col: 2, row: 2 },
        rows: box(10, 5, [{ side: "right", at: 2 }], [{ x: 4, y: 2, ch: "$" }]),
      },
      {
        id: "k2",
        title: "sector 0x4200",
        locked: true,
        at: { col: 58, row: 12 },
        rows: box(10, 5, [{ side: "left", at: 2 }], [{ x: 5, y: 2, ch: "$" }]),
      },
      {
        id: "k3",
        title: "sector 0x4300",
        locked: true,
        at: { col: 2, row: 23 },
        rows: box(10, 5, [{ side: "right", at: 2 }], [{ x: 4, y: 2, ch: "$" }]),
      },
      {
        id: "e",
        title: "sector 0x4400",
        locked: true,
        at: { col: 62, row: 20 },
        rows: [
          "##############",
          "#.....########",
          "#.>...########",
          "#......%.%.%..",
          "#.....########",
          "#.....########",
          "##############",
        ],
      },
      {
        id: "f",
        title: "sector 0x4a01",
        at: { col: 20, row: 14 },
        rows: box(8, 5, [{ side: "left", at: 2 }]),
      },
      {
        id: "g",
        title: "sector 0x4a02",
        at: { col: 20, row: 24 },
        rows: box(8, 5, [{ side: "right", at: 2 }]),
      },
      {
        id: "b",
        title: "sector 0x4a03",
        heavy: true,
        at: { col: 50, row: 4 },
        rows: box(12, 3, [
          { side: "left", at: 1 },
          { side: "right", at: 1 },
        ]),
      },
    ],
    solution: [
      place("b", 46, 13),
      go("k2", 5, 2),
      go("a", 3, 3),
      place("f", 46, 12),
      go("f", 2, 2),
      place("f", 12, 2),
      go("k1", 4, 2),
      go("f", 2, 2),
      place("f", 12, 23),
      go("k3", 4, 2),
      go("f", 2, 2),
      place("f", 76, 21),
      go("e", 11, 3),
      go("e", 9, 3),
      go("e", 7, 3),
    ],
  },
  {
    id: "offcut",
    name: "offcut",
    chapter: 3,
    par: 5,
    hint: "one piece of scrap, two gaps. cut it to fit the first, then cut it again.",
    rooms: [
      {
        id: "a",
        title: "sector 0x5000",
        locked: true,
        at: { col: 2, row: 5 },
        rows: box(10, 7, [{ side: "right", at: 3 }], [{ x: 2, y: 3, ch: "@" }]),
      },
      {
        id: "i",
        title: "sector 0x5100",
        locked: true,
        at: { col: 24, row: 7 },
        rows: box(
          8,
          7,
          [
            { side: "left", at: 3 },
            { side: "right", at: 1 },
          ],
          [{ x: 4, y: 4, ch: "$" }]
        ),
      },
      {
        id: "e",
        title: "sector 0x5200",
        locked: true,
        at: { col: 40, row: 10 },
        rows: [
          "############",
          "#####......#",
          "#####..>...#",
          "....%......#",
          "#####......#",
          "#####......#",
          "############",
        ],
      },
      {
        id: "m",
        title: "scrap.dat",
        heavy: true,
        crop: true,
        at: { col: 20, row: 17 },
        rows: [
          "##############################",
          "##############################",
          "..............................",
          "###############.##############",
          "..............................",
          "######################.#######",
          "######################.#######",
          "######################.#######",
          "######################.#######",
          "..............................",
          "##############################",
        ]
      },
    ],
    solution: [
      { crop: "m", view: { ox: 15, oy: 0, cols: 15, rows: 11 } },
      { crop: "m", view: { ox: 15, oy: 0, cols: 12, rows: 11 } },
      place("m", -3, 6),
      go("i", 4, 4),
      { crop: "m", view: { ox: 15, oy: 0, cols: 8, rows: 11 } },
      place("m", 17, 5),
      go("e", 4, 3),
    ],
  },

  {
    id: "tandem",
    name: "tandem",
    chapter: 3,
    par: 4,
    hint: "one room light enough to carry you, and two that will not budge with you inside. each meets the next only one way.",
    rooms: [
      {
        id: "a",
        title: "sector 0x6000",
        locked: true,
        at: { col: 2, row: 20 },
        rows: box(10, 6, [{ side: "up", at: 5 }], [{ x: 2, y: 3, ch: "@" }]),
      },
      {
        id: "e",
        title: "sector 0x6100",
        locked: true,
        at: { col: 66, row: 21 },
        rows: box(12, 6, [{ side: "left", at: 3 }], [{ x: 8, y: 2, ch: ">" }]),
      },
      {
        id: "w",
        title: "watchdog.sys",
        locked: true,
        onTop: true,
        at: { col: 56, row: 12 },
        rows: sign(28, 10, [
          "",
          String.raw`    ______`,
          String.raw`   /      \    nothing`,
          String.raw`   | (()) |    lands on`,
          String.raw`   \______/    my watch`,
        ]),
      },
      {
        id: "f1",
        title: "sector 0x6a01",
        at: { col: 20, row: 3 },
        rows: box(8, 6, [
          { side: "left", at: 2 },
          { side: "down", at: 4 },
        ]),
      },
      {
        id: "f2",
        heavy: true,
        title: "sector 0x6a02",
        at: { col: 4, row: 3 },
        rows: box(10, 5, [
          { side: "up", at: 3 },
          { side: "right", at: 2 },
        ]),
      },
      {
        id: "f3",
        heavy: true,
        title: "sector 0x6a03",
        at: { col: 30, row: 20 },
        rows: box(8, 5, [
          { side: "left", at: 2 },
          { side: "right", at: 2 },
        ]),
      },
      {
        id: "g",
        title: "sector 0x6a04",
        at: { col: 34, row: 9 },
        rows: box(8, 5, [
          { side: "up", at: 2 },
          { side: "left", at: 2 },
        ]),
      },
    ],
    solution: [
      place("f3", 58, 22),
      place("f2", 48, 22),
      place("f1", 3, 14),
      go("f1", 2, 2),
      place("f1", 47, 16),
    ],
  },

  {
    id: "relocation",
    name: "relocation",
    chapter: 3,
    par: 7,
    hint: "everything this chapter has asked of you, in one place.",
    rooms: [
      {
        id: "a",
        title: "sector 0x7000",
        locked: true,
        at: { col: 2, row: 11 },
        rows: box(12, 7, [{ side: "right", at: 3 }], [{ x: 3, y: 3, ch: "@" }]),
      },
      {
        id: "k",
        title: "sector 0x7100",
        locked: true,
        at: { col: 2, row: 2 },
        rows: box(10, 5, [{ side: "right", at: 2 }], [{ x: 4, y: 2, ch: "$" }]),
      },
      {
        id: "i1",
        title: "sector 0x7200",
        locked: true,
        at: { col: 24, row: 8 },
        rows: box(12, 9, [
          { side: "left", at: 6 },
          { side: "right", at: 2 },
          { side: "down", at: 5 },
        ]),
      },
      {
        id: "s",
        title: "sector 0x7300",
        locked: true,
        at: { col: 26, row: 23 },
        rows: box(10, 5, [{ side: "up", at: 4 }], [{ x: 6, y: 2, ch: "^" }]),
      },
      {
        id: "e",
        title: "sector 0x7400",
        locked: true,
        at: { col: 50, row: 7 },
        rows: [
          "############",
          "#####......#",
          "#####..>...#",
          "....%......#",
          "#####......#",
          "#####......#",
          "############",
        ],
      },
      {
        id: "f",
        title: "sector 0x7a01",
        at: { col: 60, row: 20 },
        rows: box(8, 5, [{ side: "left", at: 2 }]),
      },
      {
        id: "h",
        title: "sector 0x7a02",
        heavy: true,
        at: { col: 44, row: 2 },
        rows: box(10, 3, [
          { side: "left", at: 1 },
          { side: "right", at: 1 },
        ]),
      },
      {
        id: "hh",
        title: "sector 0x7a03",
        heavy: true,
        at: { col: 60, row: 2 },
        rows: box(12, 3, [
          { side: "left", at: 1 },
          { side: "right", at: 1 },
        ]),
      },
      {
        id: "v",
        title: "sector 0x7a04",
        heavy: true,
        at: { col: 44, row: 18 },
        rows: box(6, 6, [
          { side: "up", at: 2 },
          { side: "down", at: 3 },
        ]),
      },
      {
        id: "l",
        title: "sector 0x7a05",
        heavy: true,
        locked: true,
        crop: true,
        at: { col: 50, row: 26 },
        rows: box(24, 3, [
          { side: "left", at: 1 },
          { side: "right", at: 1 },
        ]),
      },
    ],
    triggers: { "s:6,2": [{ kind: "unlock", frag: "l" }] },
    solution: [
      place("f", 14, 12),
      go("f", 2, 2),
      place("f", 12, 2),
      go("k", 4, 2),
      go("f", 2, 2),
      place("f", 14, 12),
      go("a", 5, 3),
      place("h", 14, 13),
      go("i1", 5, 6),
      place("v", 27, 17),
      raise("i1"),
      go("s", 6, 2),
      { crop: "l", view: { ox: 0, oy: 0, cols: 14, rows: 3 } },
      place("l", 36, 9),
      go("e", 4, 3),
    ],
  },
]

export { raise }
