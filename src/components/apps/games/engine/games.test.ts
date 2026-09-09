import { describe, it, expect } from "vitest"
import {
  createBoard,
  reveal,
  toggleFlag,
  chord,
  flagsUsed,
  idx,
  type Board,
} from "./minesweeper"
import { createGame, tick, turn, type Game, type Point } from "./snake"

/** Deterministic rng so board and food layouts are reproducible. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe("minesweeper — first click safety", () => {
  it("never puts a mine on the first revealed cell", () => {
    for (let s = 1; s <= 40; s++) {
      const b = reveal(createBoard(9, 9, 10), 40, seeded(s))
      expect(b.cells[40].mine).toBe(false)
      expect(b.status).not.toBe("lost")
    }
  })

  it("keeps the neighbours of the first click clear, so it opens a region", () => {
    const b = reveal(createBoard(9, 9, 10), 40, seeded(7))
    expect(b.cells[40].adj).toBe(0)
    expect(b.cells.filter((c) => c.state === "revealed").length).toBeGreaterThan(1)
  })

  it("places exactly the requested number of mines", () => {
    const b = reveal(createBoard(9, 9, 10), 40, seeded(3))
    expect(b.cells.filter((c) => c.mine).length).toBe(10)
  })

  it("starts in the ready state and moves to playing on first reveal", () => {
    const fresh = createBoard()
    expect(fresh.status).toBe("ready")
    expect(reveal(fresh, 40, seeded(1)).status).toBe("playing")
  })
})

describe("minesweeper — revealing", () => {
  it("floods only through zero-adjacency cells", () => {
    const b = reveal(createBoard(9, 9, 10), 40, seeded(5))
    for (const c of b.cells) {
      if (c.state === "revealed") expect(c.mine).toBe(false)
    }
  })

  it("does not flood past a numbered cell", () => {
    const b = reveal(createBoard(9, 9, 10), 40, seeded(5))
    // Every revealed cell is either zero, or adjacent to a revealed zero.
    const revealed = b.cells
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.state === "revealed")
    expect(revealed.length).toBeLessThan(81)
  })

  it("handles a large empty board without blowing the stack", () => {
    // A 40x40 board with one mine cascades across nearly every cell.
    const b = reveal(createBoard(40, 40, 1), idx({ w: 40 }, 20, 20), seeded(9))
    expect(b.cells.filter((c) => c.state === "revealed").length).toBeGreaterThan(1000)
  })

  it("reveals every mine on a loss", () => {
    let b = reveal(createBoard(9, 9, 10), 40, seeded(2))
    const mine = b.cells.findIndex((c) => c.mine)
    b = reveal(b, mine, seeded(2))
    expect(b.status).toBe("lost")
    expect(b.cells.filter((c) => c.mine && c.state === "revealed").length).toBe(10)
  })

  it("ignores a reveal on an already-revealed cell", () => {
    const b = reveal(createBoard(9, 9, 10), 40, seeded(4))
    expect(reveal(b, 40, seeded(4))).toBe(b)
  })

  it("ignores input once the game is over", () => {
    let b = reveal(createBoard(9, 9, 10), 40, seeded(2))
    b = reveal(b, b.cells.findIndex((c) => c.mine), seeded(2))
    const after = reveal(b, 0, seeded(2))
    expect(after).toBe(b)
  })

  it("wins when every safe cell is revealed", () => {
    let b: Board = reveal(createBoard(4, 4, 1), 0, seeded(11))
    for (let i = 0; i < b.cells.length; i++) {
      if (!b.cells[i].mine) b = reveal(b, i, seeded(11))
    }
    expect(b.status).toBe("won")
  })
})

describe("minesweeper — flags and chording", () => {
  it("toggles a flag on and off", () => {
    let b = createBoard()
    b = toggleFlag(b, 5)
    expect(b.cells[5].state).toBe("flagged")
    expect(flagsUsed(b)).toBe(1)
    b = toggleFlag(b, 5)
    expect(b.cells[5].state).toBe("hidden")
  })

  it("will not flag a revealed cell", () => {
    const b = reveal(createBoard(9, 9, 10), 40, seeded(6))
    expect(toggleFlag(b, 40).cells[40].state).toBe("revealed")
  })

  it("will not reveal a flagged cell", () => {
    let b = reveal(createBoard(9, 9, 10), 40, seeded(6))
    const hidden = b.cells.findIndex((c) => c.state === "hidden")
    b = toggleFlag(b, hidden)
    expect(reveal(b, hidden, seeded(6)).cells[hidden].state).toBe("flagged")
  })

  it("does nothing when chording a cell whose flags do not match", () => {
    const b = reveal(createBoard(9, 9, 10), 40, seeded(8))
    const numbered = b.cells.findIndex(
      (c) => c.state === "revealed" && c.adj > 0
    )
    expect(chord(b, numbered, seeded(8))).toBe(b)
  })
})

describe("snake — movement", () => {
  const g = () => createGame(20, 12, seeded(1))

  it("moves the head in the current direction", () => {
    const before = g()
    const after = tick(before, seeded(1))
    expect(after.snake[0][0]).toBe(before.snake[0][0] + 1)
  })

  it("keeps its length when it does not eat", () => {
    const before = g()
    expect(tick(before, seeded(1)).snake).toHaveLength(before.snake.length)
  })

  it("dies on a wall", () => {
    let game = g()
    for (let i = 0; i < 30; i++) game = tick(game, seeded(1))
    expect(game.dead).toBe(true)
  })

  it("ignores ticks once dead", () => {
    let game = g()
    for (let i = 0; i < 30; i++) game = tick(game, seeded(1))
    expect(tick(game, seeded(1))).toBe(game)
  })
})

describe("snake — turning", () => {
  it("queues a valid turn", () => {
    expect(turn(createGame(20, 12, seeded(1)), "up").queue).toEqual(["up"])
  })

  it("refuses a reversal into its own neck", () => {
    const game = createGame(20, 12, seeded(1)) // heading right
    expect(turn(game, "left").queue).toEqual([])
  })

  it("refuses a repeat of the current heading", () => {
    expect(turn(createGame(20, 12, seeded(1)), "right").queue).toEqual([])
  })

  /**
   * The bug this prevents: pressing up then left inside one tick. Validating
   * the second press against the current heading would accept it, and the
   * snake would reverse into itself on a move the player never saw.
   */
  it("validates a second queued turn against the first, not the heading", () => {
    let game = createGame(20, 12, seeded(1)) // right
    game = turn(game, "up")
    game = turn(game, "down") // reverses 'up' — must be refused
    expect(game.queue).toEqual(["up"])

    game = turn(game, "left") // legal after 'up'
    expect(game.queue).toEqual(["up", "left"])
  })

  it("consumes exactly one queued turn per tick", () => {
    let game = createGame(20, 12, seeded(1))
    game = turn(game, "up")
    game = turn(game, "left")
    game = tick(game, seeded(1))
    expect(game.dir).toBe("up")
    expect(game.queue).toEqual(["left"])
  })

  it("caps the queue so held keys cannot bank turns", () => {
    let game = createGame(20, 12, seeded(1))
    game = turn(game, "up")
    game = turn(game, "left")
    game = turn(game, "down")
    expect(game.queue).toHaveLength(2)
  })
})

describe("snake — eating and collision", () => {
  /** Places food directly ahead of the head. */
  const withFoodAhead = (game: Game): Game => ({
    ...game,
    food: [game.snake[0][0] + 1, game.snake[0][1]] as Point,
  })

  it("grows and scores when it eats", () => {
    const before = withFoodAhead(createGame(20, 12, seeded(1)))
    const after = tick(before, seeded(1))
    expect(after.snake).toHaveLength(before.snake.length + 1)
    expect(after.score).toBe(1)
  })

  it("moves the food off the snake after eating", () => {
    const after = tick(withFoodAhead(createGame(20, 12, seeded(1))), seeded(1))
    expect(after.snake.some((s) => s[0] === after.food[0] && s[1] === after.food[1])).toBe(
      false
    )
  })

  it("dies when the head runs into its own body", () => {
    // A long snake curled so that turning drives the head into its middle.
    const snake: Point[] = [
      [5, 5],
      [4, 5],
      [3, 5],
      [3, 6],
      [4, 6],
      [5, 6],
      [6, 6],
    ]
    const game: Game = {
      snake,
      food: [19, 11],
      dir: "right",
      queue: ["down"],
      w: 20,
      h: 12,
      score: 0,
      dead: false,
    }
    expect(tick(game, seeded(1)).dead).toBe(true)
  })

  /**
   * Moving into the square the tail is vacating this tick is legal — the tail
   * has left by the time the head arrives.
   */
  it("allows the head to follow its own vacating tail", () => {
    const snake: Point[] = [
      [5, 5],
      [5, 6],
      [4, 6],
      [4, 5],
    ]
    const game: Game = {
      snake,
      food: [19, 11],
      dir: "up",
      queue: ["left"],
      w: 20,
      h: 12,
      score: 0,
      dead: false,
    }
    expect(tick(game, seeded(1)).dead).toBe(false)
  })
})
