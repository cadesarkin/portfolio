/**
 * defrag — chapter 5, kernel.
 *
 * Everything the game has, unlit, and more of it at once: watchdogs whose pids
 * are written down further in, a window that wanders between three hubs,
 * chains of rooms released one by one. Every level has a par, and the shortcut
 * hunter checks it cannot be beaten. See levels-deep.ts for the helpers.
 */

import type { Level, Move } from "./levels"
import { box, sign } from "./levels-deep"

const place = (id: string, col: number, row: number): Move => ({ place: id, col, row })
const raise = (id: string): Move => ({ raise: id })
const go = (room: string, x: number, y: number): Move => ({ walk: { room, x, y } })

const bridge = (w: number): string[] =>
  box(w, 3, [
    { side: "left", at: 1 },
    { side: "right", at: 1 },
  ])

const dog = (w: number, h: number, words: string): string[] =>
  sign(w, h, ["", "   ______", "  / (()) \\", "  \\______/", "", `  ${words}`])

export const KERNEL_LEVELS: Level[] = [
  {
    id: "fork",
    name: "fork",
    chapter: 4,
    par: 5,
    hint: "two watchdogs, two numbers. the second number is past the first dog.",
    rooms: [
      {
        id: "a",
        title: "sector 0x8000",
        locked: true,
        at: { col: 2, row: 11 },
        rows: box(10, 7, [{ side: "right", at: 3 }], [{ x: 2, y: 3, ch: "@" }]),
      },
      {
        id: "n1",
        title: "sector 0x8100",
        locked: true,
        at: { col: 22, row: 11 },
        rows: box(
          10,
          7,
          [
            { side: "left", at: 3 },
            { side: "right", at: 3 },
          ],
          [{ x: 5, y: 1, ch: "?" }]
        ),
      },
      {
        id: "n2",
        title: "sector 0x8200",
        locked: true,
        at: { col: 42, row: 11 },
        rows: box(
          10,
          7,
          [
            { side: "left", at: 3 },
            { side: "right", at: 3 },
          ],
          [{ x: 6, y: 5, ch: "?" }]
        ),
      },
      {
        id: "e",
        title: "sector 0x8300",
        locked: true,
        at: { col: 62, row: 11 },
        rows: box(12, 7, [{ side: "left", at: 3 }], [{ x: 8, y: 3, ch: ">" }]),
      },
      {
        id: "w1",
        title: "watchdog.sys",
        locked: true,
        onTop: true,
        pid: 301,
        at: { col: 32, row: 9 },
        rows: sign(14, 11, ["", "   ______", "  / (()) \\", "  \\______/", "", "  first", "  watch"]),
      },
      {
        id: "w2",
        title: "watchdog2.sys",
        locked: true,
        onTop: true,
        pid: 302,
        at: { col: 52, row: 9 },
        rows: sign(14, 11, ["", "   ______", "  / (()) \\", "  \\______/", "", "  second", "  watch"]),
      },
      { id: "b1", title: "sector 0x8a01", heavy: true, at: { col: 4, row: 24 }, rows: bridge(10) },
      { id: "b2", title: "sector 0x8a02", heavy: true, at: { col: 20, row: 24 }, rows: bridge(10) },
    ],
    notes: {
      "n1:5,1": {
        title: "watch.log",
        lines: [
          "two dogs on the way out.",
          "",
          "the first one answers to pid 301.",
          "the second keeps its number in the room past the first.",
        ],
        reveals: [301],
      },
      "n2:6,5": {
        title: "watch.log (2)",
        lines: ["if you got here, 301 is gone.", "the other one is pid 302."],
        reveals: [302],
      },
    },
    solution: [
      place("b1", 12, 13),
      go("n1", 5, 1),
      { kill: 301 },
      place("b2", 32, 13),
      go("n2", 6, 5),
      { kill: 302 },
      place("b1", 52, 13),
    ],
  },

  {
    id: "orbit",
    name: "orbit",
    chapter: 4,
    par: 6,
    hint: "the wanderer calls at three hubs. you have two bridges.",
    rooms: [
      {
        id: "eh",
        title: "sector 0x9000",
        locked: true,
        at: { col: 62, row: 12 },
        rows: box(
          10,
          5,
          [
            { side: "left", at: 2 },
            { side: "down", at: 4 },
          ],
          [{ x: 5, y: 2, ch: "@" }]
        ),
      },
      {
        id: "wh",
        title: "sector 0x9100",
        locked: true,
        at: { col: 2, row: 12 },
        rows: box(10, 5, [{ side: "right", at: 2 }], [{ x: 4, y: 2, ch: "^" }]),
      },
      {
        id: "nh",
        title: "sector 0x9200",
        locked: true,
        at: { col: 40, row: 2 },
        rows: box(10, 5, [{ side: "left", at: 2 }], [{ x: 5, y: 2, ch: "$" }]),
      },
      {
        id: "e",
        title: "sector 0x9300",
        locked: true,
        at: { col: 60, row: 22 },
        rows: ["######.#####", "######.#####", "######%#####", "#..........#", "#...>......#", "############"],
      },
      {
        id: "v",
        title: "drifter.exe",
        hostile: {
          kind: "wander",
          every: 5000,
          spots: [
            { col: 42, row: 12 },
            { col: 22, row: 12 },
            { col: 20, row: 2 },
          ],
        },
        at: { col: 42, row: 12 },
        rows: box(10, 5, [
          { side: "left", at: 2 },
          { side: "right", at: 2 },
        ]),
      },
      { id: "b1", title: "sector 0x9a01", heavy: true, at: { col: 4, row: 24 }, rows: bridge(10) },
      { id: "b2", title: "sector 0x9a02", heavy: true, at: { col: 20, row: 24 }, rows: bridge(10) },
      {
        id: "l",
        title: "sector 0x9a03",
        locked: true,
        heavy: true,
        crop: true,
        at: { col: 74, row: 20 },
        rows: box(6, 9, [
          { side: "up", at: 3 },
          { side: "down", at: 3 },
        ]),
      },
    ],
    triggers: { "wh:4,2": [{ kind: "unlock", frag: "l" }] },
    solution: [
      place("b2", 12, 13),
      place("b1", 52, 13),
      go("v", 5, 2),
      { hostile: "v", state: 1 },
      go("wh", 4, 2),
      go("v", 5, 2),
      { hostile: "v", state: 2 },
      place("b1", 30, 3),
      go("nh", 5, 2),
      go("v", 5, 2),
      { hostile: "v", state: 0 },
      place("b2", 52, 13),
      go("eh", 5, 2),
      { crop: "l", view: { ox: 0, oy: 0, cols: 6, rows: 5 } },
      place("l", 63, 17),
      raise("eh"),
      go("e", 6, 2),
    ],
  },

  {
    id: "deadlock",
    name: "deadlock",
    chapter: 4,
    par: 6,
    hint: "each switch lets go of the room you need to reach the next one.",
    rooms: [
      {
        id: "a",
        title: "sector 0xa000",
        locked: true,
        at: { col: 2, row: 3 },
        rows: box(10, 6, [{ side: "right", at: 2 }], [{ x: 2, y: 2, ch: "@" }]),
      },
      {
        id: "s1",
        title: "sector 0xa100",
        locked: true,
        at: { col: 22, row: 3 },
        rows: box(
          10,
          6,
          [
            { side: "left", at: 2 },
            { side: "down", at: 5 },
          ],
          [{ x: 6, y: 2, ch: "^" }]
        ),
      },
      {
        id: "s2",
        title: "sector 0xa200",
        locked: true,
        at: { col: 22, row: 18 },
        rows: box(
          10,
          8,
          [
            { side: "up", at: 5 },
            { side: "right", at: 2 },
            { side: "right", at: 6 },
          ],
          [{ x: 5, y: 4, ch: "^" }]
        ),
      },
      {
        id: "k",
        title: "sector 0xa300",
        locked: true,
        at: { col: 42, row: 18 },
        rows: box(10, 5, [{ side: "left", at: 2 }], [{ x: 5, y: 2, ch: "$" }]),
      },
      {
        id: "e",
        title: "sector 0xa400",
        locked: true,
        at: { col: 42, row: 23 },
        rows: ["############", "...%.......#", "####.......#", "####..>....#", "####.......#", "############"],
      },
      { id: "b", title: "sector 0xaa01", heavy: true, at: { col: 40, row: 2 }, rows: bridge(10) },
      {
        id: "l1",
        title: "sector 0xaa02",
        locked: true,
        heavy: true,
        crop: true,
        at: { col: 60, row: 3 },
        rows: [
          "###.##",
          "###.##",
          "###.##",
          "###.##",
          "#...##",
          "#.####",
          "#.####",
          "#.####",
          "#.####",
          "#.####",
          "#...##",
          "###.##",
          "###.##",
          "###.##",
          "###.##",
        ],
      },
      { id: "l2", title: "sector 0xaa03", locked: true, heavy: true, at: { col: 60, row: 25 }, rows: bridge(10) },
    ],
    triggers: {
      "s1:6,2": [{ kind: "unlock", frag: "l1" }],
      "s2:5,4": [{ kind: "unlock", frag: "l2" }],
    },
    solution: [
      place("b", 12, 4),
      go("s1", 6, 2),
      { crop: "l1", view: { ox: 0, oy: 2, cols: 6, rows: 13 } },
      { crop: "l1", view: { ox: 0, oy: 2, cols: 6, rows: 9 } },
      place("l1", 24, 7),
      raise("s1"),
      go("s2", 5, 4),
      place("l2", 32, 19),
      go("k", 5, 2),
      go("s2", 2, 2),
      place("l2", 32, 23),
      go("e", 3, 1),
    ],
  },

  {
    id: "panic",
    name: "panic",
    chapter: 4,
    par: 6,
    hint: "one room to carry you. every stop is guarded, and every guard's number is written at the stop before.",
    rooms: [
      {
        id: "a",
        title: "sector 0xb000",
        locked: true,
        at: { col: 2, row: 12 },
        rows: box(10, 5, [{ side: "right", at: 2 }], [{ x: 3, y: 2, ch: "@" }]),
      },
      {
        id: "n1",
        title: "sector 0xb100",
        locked: true,
        at: { col: 2, row: 2 },
        rows: box(10, 5, [{ side: "right", at: 2 }], [{ x: 4, y: 2, ch: "?" }]),
      },
      {
        id: "n2",
        title: "sector 0xb200",
        locked: true,
        at: { col: 30, row: 22 },
        rows: box(10, 5, [{ side: "right", at: 2 }], [{ x: 4, y: 2, ch: "?" }]),
      },
      {
        id: "e",
        title: "sector 0xb300",
        locked: true,
        at: { col: 60, row: 2 },
        rows: box(12, 7, [{ side: "right", at: 3 }], [{ x: 3, y: 3, ch: ">" }]),
      },
      {
        id: "w1",
        title: "panic.sys",
        locked: true,
        onTop: true,
        pid: 401,
        at: { col: 38, row: 19 },
        rows: sign(14, 9, ["", "  !! panic !!", "", "  do not dock", "  here"]),
      },
      {
        id: "w2",
        title: "panic2.sys",
        locked: true,
        onTop: true,
        pid: 402,
        at: { col: 70, row: 2 },
        rows: sign(14, 8, ["", "  !! panic !!", "", "  nor here"]),
      },
      {
        id: "f",
        title: "sector 0xba01",
        at: { col: 40, row: 10 },
        rows: box(8, 5, [{ side: "left", at: 2 }]),
      },
      {
        id: "g",
        title: "sector 0xba02",
        at: { col: 20, row: 24 },
        rows: box(8, 5, [{ side: "right", at: 2 }]),
      },
    ],
    notes: {
      "n1:4,2": {
        title: "panic.log",
        lines: ["the machine is panicking. two guards went up.", "", "the one down by the second stop is pid 401."],
        reveals: [401],
      },
      "n2:4,2": {
        title: "panic.log (2)",
        lines: ["the last guard, the one on the way out, is pid 402.", "", "breathe."],
        reveals: [402],
      },
    },
    solution: [
      place("f", 12, 12),
      go("f", 2, 2),
      place("f", 12, 2),
      go("n1", 4, 2),
      go("f", 2, 2),
      { kill: 401 },
      place("f", 40, 22),
      go("n2", 4, 2),
      go("f", 2, 2),
      { kill: 402 },
      place("f", 72, 3),
    ],
  },

  {
    id: "watchlist",
    name: "watchlist",
    chapter: 4,
    par: 7,
    hint: "three watchdogs. each one's number is in the room before it.",
    rooms: [
      {
        id: "a",
        title: "sector 0xd000",
        locked: true,
        at: { col: 2, row: 3 },
        rows: box(10, 7, [{ side: "right", at: 3 }], [{ x: 2, y: 3, ch: "@" }]),
      },
      {
        id: "n1",
        title: "sector 0xd100",
        locked: true,
        at: { col: 22, row: 3 },
        rows: box(
          10,
          7,
          [
            { side: "left", at: 3 },
            { side: "right", at: 3 },
          ],
          [{ x: 5, y: 1, ch: "?" }]
        ),
      },
      {
        id: "n2",
        title: "sector 0xd200",
        locked: true,
        at: { col: 42, row: 3 },
        rows: box(
          10,
          7,
          [
            { side: "left", at: 3 },
            { side: "down", at: 5 },
          ],
          [{ x: 7, y: 1, ch: "?" }]
        ),
      },
      {
        id: "n3",
        title: "sector 0xd300",
        locked: true,
        at: { col: 45, row: 16 },
        rows: box(
          10,
          7,
          [
            { side: "up", at: 3 },
            { side: "right", at: 3 },
          ],
          [{ x: 5, y: 4, ch: "?" }]
        ),
      },
      {
        id: "e",
        title: "sector 0xd400",
        locked: true,
        at: { col: 65, row: 16 },
        rows: box(12, 7, [{ side: "left", at: 3 }], [{ x: 8, y: 3, ch: ">" }]),
      },
      { id: "w1", title: "watch1.sys", locked: true, onTop: true, pid: 501, at: { col: 32, row: 2 }, rows: dog(14, 9, "one") },
      { id: "w2", title: "watch2.sys", locked: true, onTop: true, pid: 502, at: { col: 40, row: 10 }, rows: dog(12, 8, "two") },
      { id: "w3", title: "watch3.sys", locked: true, onTop: true, pid: 503, at: { col: 60, row: 15 }, rows: dog(14, 8, "three") },
      { id: "b1", title: "sector 0xda01", heavy: true, at: { col: 4, row: 24 }, rows: bridge(10) },
      { id: "b2", title: "sector 0xda02", heavy: true, at: { col: 20, row: 24 }, rows: bridge(10) },
      {
        id: "v",
        title: "sector 0xda03",
        heavy: true,
        at: { col: 30, row: 20 },
        rows: box(6, 6, [
          { side: "up", at: 2 },
          { side: "down", at: 3 },
        ]),
      },
    ],
    notes: {
      "n1:5,1": { title: "watch.log", lines: ["the first dog is pid 501."], reveals: [501] },
      "n2:7,1": { title: "watch.log (2)", lines: ["the second, down below, is pid 502."], reveals: [502] },
      "n3:5,4": { title: "watch.log (3)", lines: ["the last one, on the door out, is pid 503."], reveals: [503] },
    },
    solution: [
      place("b1", 12, 5),
      go("n1", 5, 1),
      { kill: 501 },
      place("b2", 32, 5),
      go("n2", 7, 1),
      { kill: 502 },
      place("v", 45, 10),
      raise("n2"),
      go("n3", 5, 4),
      { kill: 503 },
      place("b1", 55, 18),
    ],
  },

  {
    id: "descent",
    name: "descent",
    chapter: 4,
    par: 8,
    hint: "down the ledges again, and off to the side for a key. the bridges will have to change shape on the way.",
    rooms: [
      {
        id: "a",
        title: "sector 0xc000",
        locked: true,
        at: { col: 2, row: 2 },
        rows: box(12, 5, [{ side: "down", at: 6 }], [{ x: 2, y: 2, ch: "@" }]),
      },
      {
        id: "l1",
        title: "sector 0xc100",
        locked: true,
        at: { col: 6, row: 12 },
        rows: box(12, 5, [
          { side: "up", at: 4 },
          { side: "right", at: 2 },
        ]),
      },
      {
        id: "l2",
        title: "sector 0xc200",
        locked: true,
        at: { col: 30, row: 12 },
        rows: box(12, 5, [
          { side: "left", at: 2 },
          { side: "down", at: 6 },
          { side: "right", at: 2 },
        ]),
      },
      {
        id: "k",
        title: "sector 0xc300",
        locked: true,
        at: { col: 52, row: 12 },
        rows: box(10, 5, [{ side: "left", at: 2 }], [{ x: 5, y: 2, ch: "$" }]),
      },
      {
        id: "l3",
        title: "sector 0xc400",
        locked: true,
        at: { col: 34, row: 21 },
        rows: box(12, 5, [
          { side: "up", at: 4 },
          { side: "right", at: 2 },
        ]),
      },
      {
        id: "e",
        title: "sector 0xc500",
        locked: true,
        at: { col: 58, row: 21 },
        rows: [
          "##############",
          "#####........#",
          "....%....>...#",
          "#####........#",
          "#####........#",
          "##############",
        ],
      },
      {
        id: "v",
        title: "sector 0xca01",
        heavy: true,
        crop: true,
        at: { col: 66, row: 3 },
        rows: box(6, 5, [
          { side: "up", at: 2 },
          { side: "down", at: 4 },
        ]),
      },
      {
        id: "h",
        title: "sector 0xca02",
        heavy: true,
        crop: true,
        at: { col: 48, row: 4 },
        rows: bridge(12),
      },
      {
        id: "vv",
        title: "sector 0xca03",
        heavy: true,
        at: { col: 75, row: 10 },
        rows: box(6, 5, [
          { side: "up", at: 4 },
          { side: "down", at: 2 },
        ]),
      },
      { id: "hh", title: "sector 0xca04", heavy: true, at: { col: 62, row: 17 }, rows: bridge(10) },
    ],
    solution: [
      place("v", 6, 7),
      raise("a"),
      place("h", 18, 13),
      go("l2", 6, 3),
      { crop: "v", view: { ox: 0, oy: 0, cols: 6, rows: 4 } },
      place("v", 34, 17),
      raise("l2"),
      { crop: "h", view: { ox: 0, oy: 0, cols: 10, rows: 3 } },
      place("h", 42, 13),
      go("k", 5, 2),
      go("l2", 6, 3),
      go("l3", 6, 3),
      { crop: "h", view: { ox: 0, oy: 0, cols: 12, rows: 3 } },
      place("h", 46, 22),
      go("e", 4, 2),
    ],
  },

  {
    id: "core",
    name: "core",
    chapter: 4,
    par: 10,
    hint: "the core. cut your way out, silence the guard, throw the switch, fetch the key, and cut the last bridge to fit.",
    rooms: [
      {
        id: "a",
        title: "sector 0xe000",
        pinned: true,
        crop: true,
        at: { col: 1, row: 3 },
        rows: box(12, 7, [], [{ x: 2, y: 3, ch: "@" }]),
      },
      {
        id: "n",
        title: "sector 0xe100",
        locked: true,
        at: { col: 22, row: 3 },
        rows: box(
          10,
          7,
          [
            { side: "left", at: 3 },
            { side: "right", at: 3 },
          ],
          [{ x: 5, y: 1, ch: "?" }]
        ),
      },
      {
        id: "s",
        title: "sector 0xe200",
        locked: true,
        at: { col: 42, row: 3 },
        rows: box(
          10,
          7,
          [
            { side: "left", at: 3 },
            { side: "down", at: 5 },
          ],
          [{ x: 6, y: 1, ch: "^" }]
        ),
      },
      {
        id: "h",
        title: "sector 0xe300",
        locked: true,
        at: { col: 45, row: 16 },
        rows: box(12, 6, [
          { side: "up", at: 3 },
          { side: "left", at: 3 },
          { side: "right", at: 3 },
        ]),
      },
      {
        id: "k",
        title: "sector 0xe400",
        locked: true,
        at: { col: 2, row: 23 },
        rows: box(10, 5, [{ side: "right", at: 2 }], [{ x: 4, y: 2, ch: "$" }]),
      },
      {
        id: "e",
        title: "sector 0xe500",
        locked: true,
        at: { col: 20, row: 17 },
        rows: ["##############", "#........#####", "#..>....+%....", "#........#####", "#........#####", "##############"],
      },
      { id: "w", title: "core.sys", locked: true, onTop: true, pid: 601, at: { col: 34, row: 2 }, rows: dog(12, 9, "core") },
      { id: "b1", title: "sector 0xea01", heavy: true, at: { col: 60, row: 12 }, rows: bridge(10) },
      { id: "b2", title: "sector 0xea02", heavy: true, at: { col: 71, row: 12 }, rows: bridge(12) },
      {
        id: "v",
        title: "sector 0xea03",
        heavy: true,
        at: { col: 60, row: 4 },
        rows: box(6, 6, [
          { side: "up", at: 2 },
          { side: "down", at: 3 },
        ]),
      },
      { id: "f", title: "sector 0xea04", at: { col: 66, row: 24 }, rows: box(8, 5, [{ side: "left", at: 2 }]) },
      { id: "g", title: "sector 0xea05", at: { col: 72, row: 2 }, rows: box(8, 5, [{ side: "right", at: 2 }]) },
      { id: "l", title: "sector 0xea06", locked: true, heavy: true, crop: true, at: { col: 4, row: 13 }, rows: bridge(20) },
    ],
    triggers: { "s:6,1": [{ kind: "gates" }, { kind: "unlock", frag: "l" }] },
    notes: {
      "n:5,1": {
        title: "core.log",
        lines: [
          "the guard on the core is pid 601.",
          "past it, a switch. past that, a way down.",
          "the door out wants a key. the key is a long way off.",
        ],
        reveals: [601],
      },
    },
    solution: [
      { crop: "a", view: { ox: 0, oy: 0, cols: 11, rows: 7 } },
      place("b1", 12, 5),
      go("n", 5, 1),
      { kill: 601 },
      place("b1", 32, 5),
      go("s", 6, 1),
      place("v", 45, 10),
      raise("s"),
      go("h", 3, 2),
      place("f", 57, 17),
      go("f", 2, 2),
      place("f", 12, 23),
      go("k", 4, 2),
      go("f", 2, 2),
      place("f", 57, 17),
      go("h", 3, 2),
      { crop: "l", view: { ox: 0, oy: 0, cols: 11, rows: 3 } },
      place("l", 34, 18),
      go("e", 9, 2),
    ],
  },
]
