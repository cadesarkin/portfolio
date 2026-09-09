/**
 * The starmap: worlds, the ship, and travel between them.
 *
 * Pure — no canvas, no DOM. A "world" is a place with its own ASCII scene and,
 * eventually, its own program. The scene id selects a terrain generator; see
 * `scene.ts`.
 */

export type SceneId = "arcanum" | "void"

export interface World {
  id: string
  name: string
  /** One line, shown on the map and on arrival. */
  blurb: string
  /**
   * Backdrop for the surface, for worlds that need one.
   *
   * A world whose program paints the whole view — the fairway, the lane — has
   * no scene: a backdrop nothing can see is a canvas redrawn sixty times a
   * second for nobody.
   */
  scene?: SceneId
  /** Map position, 0..1 in both axes. */
  x: number
  y: number
  /** How the world is drawn on the map. */
  art: string[]
  colour: string
  /** The app that runs on the surface, once there is one. */
  app?: string
}

/** The orb every world is drawn as, differing only in its fill. */
const orb = (fill: string): string[] => [" ,-. ", `(${fill.repeat(3)})`, " `-' "]

export const WORLDS: World[] = [
  {
    id: "links",
    name: "THE LINKS",
    blurb: "rolling fairway, one flag, endless wind",
    x: 0.24,
    y: 0.34,
    art: orb("%"),
    colour: "#7fc07a",
    app: "golf",
  },
  {
    id: "lanes",
    name: "TEN PIN",
    blurb: "a polished lane running off into the dark",
    x: 0.7,
    y: 0.26,
    art: orb("="),
    colour: "#e0a94a",
    app: "bowling",
  },
  {
    id: "arcanum",
    name: "ARCANUM",
    blurb: "a library of spells, sorted by colour",
    scene: "arcanum",
    x: 0.52,
    y: 0.72,
    art: orb("*"),
    colour: "#b18fe0",
    app: "decks",
  },
]

/** Where the ship starts: adrift, between worlds. */
export const ORIGIN = { x: 0.5, y: 0.5 }

export interface Ship {
  x: number
  y: number
  /** Normalised units per second. */
  speed: number
  /** World the ship is travelling to, or null when adrift. */
  target: string | null
  /** World the ship has arrived at, or null when in flight. */
  landed: string | null
}

export function createShip(): Ship {
  return { ...ORIGIN, speed: 0.34, target: null, landed: null }
}

export const worldById = (id: string): World | undefined =>
  WORLDS.find((w) => w.id === id)

/** Close enough to count as arrived. */
export const ARRIVE_RADIUS = 0.02

export function setCourse(ship: Ship, worldId: string): Ship {
  if (!worldById(worldId)) return ship
  // Departing clears the landing; you cannot be on two worlds at once.
  return { ...ship, target: worldId, landed: null }
}

/**
 * Advances the ship toward its target.
 *
 * Snaps to the world on arrival rather than easing in asymptotically — an
 * approach that never quite lands leaves the arrival state unreachable.
 */
export function stepShip(ship: Ship, dt: number): Ship {
  if (!ship.target) return ship
  const world = worldById(ship.target)
  if (!world) return { ...ship, target: null }

  const dx = world.x - ship.x
  const dy = world.y - ship.y
  const dist = Math.hypot(dx, dy)

  if (dist <= ARRIVE_RADIUS || dist <= ship.speed * dt) {
    return { ...ship, x: world.x, y: world.y, target: null, landed: world.id }
  }

  const step = ship.speed * dt
  return { ...ship, x: ship.x + (dx / dist) * step, y: ship.y + (dy / dist) * step }
}

/** Heading in radians, for pointing the ship glyph. */
export function heading(ship: Ship): number {
  if (!ship.target) return -Math.PI / 2
  const world = worldById(ship.target)
  if (!world) return -Math.PI / 2
  return Math.atan2(world.y - ship.y, world.x - ship.x)
}

/**
 * The ship glyph for a heading, from eight compass directions.
 *
 * Index 0 is due east, stepping clockwise — atan2 returns 0 for east and
 * positive angles downward, since screen y grows downward.
 */
export function shipDirection(angle: number): number {
  const i = Math.round(angle / (Math.PI / 4))
  return ((i % 8) + 8) % 8
}

export function shipGlyph(angle: number): string {
  return [">", "\\", "v", "/", "<", "\\", "^", "/"][shipDirection(angle)]
}

/**
 * The ship as ASCII art, one sprite per compass point.
 *
 * Rotating art in a character grid is not possible in any way that still reads,
 * so each heading is drawn by hand. `*` is the exhaust and always sits opposite
 * the nose, which is what makes the heading legible at a glance.
 */
const SHIP_ART: string[][] = [
  // east
  ["   __  ", " *=[=> ", "   --  "],
  // south-east
  [" *=    ", "   \\-  ", "     v "],
  // south
  ["   *   ", "  \\_/  ", "   v   "],
  // south-west
  ["    =* ", "  -/   ", " v     "],
  // west
  ["  __   ", " <=]=* ", "  --   "],
  // north-west
  [" ^     ", "  \\-   ", "    =* "],
  // north
  ["   ^   ", "  /_\\  ", "   *   "],
  // north-east
  ["     ^ ", "   -/  ", " *=    "],
]

export function shipSprite(angle: number): string[] {
  return SHIP_ART[shipDirection(angle)]
}

/** Distance remaining to the target, or 0 when not travelling. */
export function distanceRemaining(ship: Ship): number {
  if (!ship.target) return 0
  const world = worldById(ship.target)
  if (!world) return 0
  return Math.hypot(world.x - ship.x, world.y - ship.y)
}
