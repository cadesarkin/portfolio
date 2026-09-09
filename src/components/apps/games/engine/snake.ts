/** Snake rules. Pure — no DOM, no rendering. */

export type Dir = "up" | "down" | "left" | "right"
export type Point = readonly [number, number]

export interface Game {
  snake: Point[]
  food: Point
  dir: Dir
  /** Turns taken this tick or queued for the next. See `turn`. */
  queue: Dir[]
  w: number
  h: number
  score: number
  dead: boolean
}

const DELTA: Record<Dir, Point> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
}

const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1]

export function createGame(w = 24, h = 16, rng: () => number = Math.random): Game {
  const start: Point[] = [
    [4, Math.floor(h / 2)],
    [3, Math.floor(h / 2)],
    [2, Math.floor(h / 2)],
  ]
  return {
    snake: start,
    food: placeFood(start, w, h, rng),
    dir: "right",
    queue: [],
    w,
    h,
    score: 0,
    dead: false,
  }
}

function placeFood(snake: Point[], w: number, h: number, rng: () => number): Point {
  const free: Point[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!snake.some((s) => s[0] === x && s[1] === y)) free.push([x, y])
    }
  }
  if (free.length === 0) return snake[0]
  return free[Math.floor(rng() * free.length)]
}

/**
 * Queues a direction change.
 *
 * Queued rather than applied immediately: within one tick a fast player can
 * press up-then-left, and applying both directly would turn the snake back
 * into its own neck and kill it for input the game never rendered. Each tick
 * consumes exactly one queued turn.
 */
export function turn(game: Game, dir: Dir): Game {
  if (game.dead) return game
  // Compare against the last queued turn, not the current heading, so a second
  // press in the same tick validates against where the snake will be pointing.
  const last = game.queue.length > 0 ? game.queue[game.queue.length - 1] : game.dir
  if (dir === last || dir === OPPOSITE[last]) return game
  if (game.queue.length >= 2) return game
  return { ...game, queue: [...game.queue, dir] }
}

export function tick(game: Game, rng: () => number = Math.random): Game {
  if (game.dead) return game

  const queue = [...game.queue]
  const dir = queue.shift() ?? game.dir

  const [dx, dy] = DELTA[dir]
  const head = game.snake[0]
  const next: Point = [head[0] + dx, head[1] + dy]

  // Walls are solid; there is no wrapping.
  if (next[0] < 0 || next[1] < 0 || next[0] >= game.w || next[1] >= game.h) {
    return { ...game, dir, queue, dead: true }
  }

  const eating = same(next, game.food)
  // The tail vacates this tick unless the snake is growing, so moving into the
  // square the tail is leaving is legal.
  const body = eating ? game.snake : game.snake.slice(0, -1)
  if (body.some((s) => same(s, next))) {
    return { ...game, dir, queue, dead: true }
  }

  const snake: Point[] = [next, ...body]
  return {
    ...game,
    snake,
    dir,
    queue,
    food: eating ? placeFood(snake, game.w, game.h, rng) : game.food,
    score: eating ? game.score + 1 : game.score,
  }
}
