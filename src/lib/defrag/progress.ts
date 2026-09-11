/**
 * How far the player has got, as the whole desktop sees it.
 *
 * defrag's levels, and what they have done to the world outside the game: the
 * crew at the crash site, the ship they rebuild, and — once the last level is
 * done — whether it has launched and which scene the wallpaper shows. Kept
 * apart from the game's own store because the wallpaper and the crash site
 * read it whether or not the game is open.
 *
 * Persisted to localStorage; `launching` alone is not, since a launch cut
 * short by a reload simply has not happened yet.
 */

export type Scene = "plains" | "space"

export interface Progress {
  /** Levels finished, 0 to the number of levels. */
  reached: number
  /** The ship has left. */
  launched: boolean
  /** Which wallpaper is showing. Space only once the ship has launched. */
  scene: Scene
  /** Crew members who have already walked up to the site, so they do not walk up again. */
  crewSeen: number
  /** A launch is playing right now. */
  launching: boolean
}

export const PROGRESS_KEY = "sarkin.defrag"

export const NO_PROGRESS: Progress = {
  reached: 0,
  launched: false,
  scene: "plains",
  crewSeen: 0,
  launching: false,
}

type Listener = () => void

let state: Progress | null = null
const listeners = new Set<Listener>()

const count = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0

function load(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}")
    const launched = raw.launched === true
    return {
      reached: count(raw.reached),
      launched,
      scene: launched && raw.scene === "space" ? "space" : "plains",
      crewSeen: count(raw.crewSeen),
      launching: false,
    }
  } catch {
    return NO_PROGRESS
  }
}

export function getProgress(): Progress {
  if (!state) state = typeof window === "undefined" ? NO_PROGRESS : load()
  return state
}

/** The snapshot for server rendering, before storage can be read. */
export const getServerProgress = (): Progress => NO_PROGRESS

export function setProgress(patch: Partial<Progress>): void {
  state = { ...getProgress(), ...patch }
  try {
    const { reached, launched, scene, crewSeen } = state
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ reached, launched, scene, crewSeen }))
  } catch {
    // Storage unavailable: progress lasts for the session only.
  }
  for (const l of listeners) l()
}

export function subscribeProgress(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Every level finished: the ship is ready to go. */
export const ready = (p: Progress, levels: number): boolean => p.reached >= levels

/** Starts the launch. The crash site plays it and calls `landInSpace` at the end. */
export function launch(): void {
  const p = getProgress()
  if (p.launched || p.launching) return
  setProgress({ launching: true })
}

/** The ship is gone; the wallpaper follows it up. */
export function landInSpace(): void {
  setProgress({ launching: false, launched: true, scene: "space" })
}

export function showScene(scene: Scene): void {
  if (scene === "space" && !getProgress().launched) return
  setProgress({ scene })
}

/** Everything back to the start: the wreck burns again, and no one has come yet. */
export function startOver(): void {
  setProgress({ ...NO_PROGRESS })
}

/** Test seam: forget what has been loaded, so the next read goes to storage. */
export function reloadProgress(): void {
  state = null
}
