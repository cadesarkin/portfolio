import { describe, it, expect, beforeEach } from "vitest"
import {
  PROGRESS_KEY,
  getProgress,
  landInSpace,
  launch,
  reloadProgress,
  setProgress,
  showScene,
  startOver,
  subscribeProgress,
} from "./progress"
import { loadReached, saveReached } from "./store"

/** A browser's storage, enough of it for these tests. */
const store = new Map<string, string>()
Object.assign(globalThis, {
  window: globalThis,
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
})

const saved = () => JSON.parse(store.get(PROGRESS_KEY) ?? "{}")

beforeEach(() => {
  store.clear()
  reloadProgress()
})

describe("progress", () => {
  it("starts from nothing", () => {
    expect(getProgress()).toMatchObject({ reached: 0, launched: false, scene: "plains", crewSeen: 0 })
  })

  it("reads what an earlier version saved, which only knew the level", () => {
    store.set(PROGRESS_KEY, JSON.stringify({ reached: 7 }))
    reloadProgress()
    expect(getProgress()).toMatchObject({ reached: 7, launched: false, scene: "plains", crewSeen: 0 })
  })

  it("shrugs off storage that is not what it expects", () => {
    store.set(PROGRESS_KEY, "{not json")
    reloadProgress()
    expect(getProgress().reached).toBe(0)
    store.set(PROGRESS_KEY, JSON.stringify({ reached: -4, scene: "space", crewSeen: "lots" }))
    reloadProgress()
    // Space without a launch is not a place anyone can have got to.
    expect(getProgress()).toMatchObject({ reached: 0, scene: "plains", crewSeen: 0 })
  })

  it("saves the level reached, and never goes back on it", () => {
    saveReached(5)
    saveReached(3)
    expect(loadReached()).toBe(5)
    expect(saved().reached).toBe(5)
  })

  it("tells whoever is listening when it changes", () => {
    let calls = 0
    const off = subscribeProgress(() => calls++)
    setProgress({ crewSeen: 2 })
    off()
    setProgress({ crewSeen: 3 })
    expect(calls).toBe(1)
  })
})

describe("the launch", () => {
  it("plays, then leaves the wallpaper in space", () => {
    setProgress({ reached: 15 })
    launch()
    expect(getProgress().launching).toBe(true)
    // A launch interrupted by a reload has not happened.
    expect(saved().launching).toBeUndefined()
    landInSpace()
    expect(getProgress()).toMatchObject({ launching: false, launched: true, scene: "space" })
    expect(saved()).toMatchObject({ launched: true, scene: "space" })
  })

  it("only goes once", () => {
    landInSpace()
    launch()
    expect(getProgress().launching).toBe(false)
  })

  it("will not show space before the ship has got there", () => {
    showScene("space")
    expect(getProgress().scene).toBe("plains")
  })

  it("lets the plains and space be swapped afterwards", () => {
    landInSpace()
    showScene("plains")
    expect(getProgress().scene).toBe("plains")
    showScene("space")
    expect(getProgress().scene).toBe("space")
  })

  it("starts over from the burning wreck", () => {
    setProgress({ reached: 15, crewSeen: 6 })
    landInSpace()
    startOver()
    expect(getProgress()).toMatchObject({ reached: 0, launched: false, scene: "plains", crewSeen: 0 })
    expect(saved()).toMatchObject({ reached: 0, launched: false })
  })
})
