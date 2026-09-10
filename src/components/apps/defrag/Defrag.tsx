"use client"

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import { useWindows } from "@/components/desktop/window-manager"
import { stackOrder, type Win } from "@/components/desktop/window-reducer"
import {
  CELL_H,
  CELL_W,
  CHROME,
  links,
  step,
  type Dir,
  type Placement,
} from "@/lib/defrag/engine"
import {
  CONTROLLER_W,
  LEVELS,
  MIN_VIEW,
  fragmentIdOf,
  fragmentWindowId,
  fragmentsOf,
  isFragmentWindow,
  startOf,
} from "@/lib/defrag/levels"
import {
  getState,
  initialState,
  loadReached,
  saveReached,
  setState,
  subscribe,
} from "@/lib/defrag/store"
import type { VNode } from "@/lib/vfs-types"

/**
 * defrag.exe — the program that runs the game.
 *
 * It opens a level's rooms as windows, owns the keyboard for all of them, and
 * applies the rules. It does not draw rooms; each room window draws itself
 * from the shared store. The rules need to know where windows really are, so
 * this is the one place that reads geometry from the DOM.
 */

/** What every room window is, as far as the window manager can tell. */
const ROOM_NODE: VNode = { kind: "app", name: "room", app: "fragment", icon: "game" }

const KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
}

/** What a refused step means, said once, plainly. A wall needs no words. */
const NOTES: Record<string, string | null> = {
  wall: null,
  void: "there's no room on the other side of that edge.",
  hidden: "something is covering the way. you can only walk where you can see.",
  offscreen: "that's off the edge of the screen.",
}

/** Every visible window, as the rules see it, measured from the page. */
function measure(wins: Win[]): Placement[] {
  const out: Placement[] = []
  for (const w of wins) {
    if (w.state === "minimized") continue
    const el = document.querySelector<HTMLElement>(`[data-win-id="${CSS.escape(w.id)}"]`)
    const body = el?.querySelector<HTMLElement>(".win-body")
    if (!el || !body) continue
    const o = el.getBoundingClientRect()
    const b = body.getBoundingClientRect()
    out.push({
      id: w.id,
      frag: isFragmentWindow(w.id) ? fragmentIdOf(w.id) : undefined,
      outer: { x: o.left, y: o.top, w: o.width, h: o.height },
      body: { x: b.left, y: b.top, w: b.width, h: b.height },
      z: stackOrder(w),
    })
  }
  return out
}

const viewport = () => ({ w: window.innerWidth, h: window.innerHeight })

export default function Defrag({ winId, isMobile }: { winId: string; isMobile: boolean }) {
  const { wins, open, close, move, minimize, registerKeys } = useWindows()
  const game = useSyncExternalStore(subscribe, getState, getState)
  const winsRef = useRef(wins)
  winsRef.current = wins

  const level = LEVELS[game.level]
  const tooSmall =
    typeof window !== "undefined" &&
    (window.innerWidth < MIN_VIEW.w || window.innerHeight < MIN_VIEW.h)

  /* ── Rooms ─────────────────────────────────────────────────────────── */

  const closeRooms = useCallback(() => {
    for (const w of winsRef.current) if (isFragmentWindow(w.id)) close(w.id, true)
  }, [close])

  const startLevel = useCallback(
    (index: number) => {
      const lvl = LEVELS[index]
      if (!lvl) return
      closeRooms()

      // Clear the stage. Every window on screen is part of the level, so a
      // folder left open from before would sit across the rooms and block the
      // way for reasons that have nothing to do with the puzzle.
      for (const w of winsRef.current) {
        if (w.id !== winId && !isFragmentWindow(w.id)) minimize(w.id)
      }

      // The program sits out of the way on the right, where no level reaches.
      move(winId, { x: window.innerWidth - CONTROLLER_W - 16, y: 48 }, true)

      for (const f of lvl.fragments) {
        const cols = f.rows[0].length
        const rows = f.rows.length
        open(ROOM_NODE, {
          id: fragmentWindowId(f.id),
          title: f.locked ? `${f.title} · locked` : f.title,
          // Approximate: the window corrects itself onto the grid on its
          // first frame, using the chrome it actually has.
          rect: {
            x: f.at.col * CELL_W - CHROME.left,
            y: f.at.row * CELL_H - CHROME.top,
            w: cols * CELL_W + CHROME.left + CHROME.right,
            h: rows * CELL_H + CHROME.top + CHROME.bottom,
          },
          grid: { cw: CELL_W, ch: CELL_H, cols, rows },
          allow: f.locked
            ? { move: false, close: false, minimize: false, maximize: false, resize: false }
            : { close: false, minimize: false, maximize: false, resize: false },
          onTop: f.onTop,
        })
      }

      setState({
        level: index,
        status: "playing",
        player: startOf(lvl),
        moves: 0,
        links: {},
        bump: null,
        note: null,
      })
    },
    [closeRooms, minimize, move, open, winId]
  )

  /*
   * Closing the program takes its rooms with it, and the next launch starts
   * clean. Unmount only: the window manager's functions change identity
   * whenever any window moves, so an effect keyed on them would tear the
   * level down every time the player dragged a room.
   */
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(
    () => () => {
      for (const w of winsRef.current) if (isFragmentWindow(w.id)) closeRef.current(w.id, true)
      setState(initialState)
    },
    []
  )

  /* ── Links: which edges meet, recomputed whenever windows move ────── */

  const refreshLinks = useCallback(() => {
    const g = getState()
    if (g.status !== "playing") return
    const lvl = LEVELS[g.level]
    const frags = fragmentsOf(lvl)
    const placements = measure(winsRef.current)
    const next: Record<string, string[]> = {}
    for (const f of lvl.fragments) next[f.id] = links(f.id, placements, frags, viewport())
    setState({ links: next })
  }, [])

  useEffect(() => {
    // After the windows have painted in their new places.
    const raf = requestAnimationFrame(refreshLinks)
    return () => cancelAnimationFrame(raf)
  }, [wins, game.status, game.level, refreshLinks])

  useEffect(() => {
    // Mid-drag, windows move without the window manager hearing about it
    // until the drop; they announce it on the page instead, and the lit edges
    // follow along. Throttled to a frame.
    let raf = 0
    const onGeometry = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        refreshLinks()
      })
    }
    document.addEventListener("win-geometry", onGeometry)
    window.addEventListener("resize", onGeometry)
    return () => {
      document.removeEventListener("win-geometry", onGeometry)
      window.removeEventListener("resize", onGeometry)
      cancelAnimationFrame(raf)
    }
  }, [refreshLinks])

  /* ── Keys ──────────────────────────────────────────────────────────── */

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const g = getState()

      if (e.key === "Enter" || e.key === " ") {
        if (g.status === "intro") {
          e.preventDefault()
          startLevel(loadReached() < LEVELS.length ? loadReached() : 0)
        } else if (g.status === "won") {
          e.preventDefault()
          startLevel(g.level + 1)
        }
        return
      }

      if (g.status !== "playing" || !g.player) return

      if (e.key === "r") {
        e.preventDefault()
        setState({ player: startOf(LEVELS[g.level]), note: null })
        return
      }

      const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase()]
      if (!dir) return
      e.preventDefault()

      const lvl = LEVELS[g.level]
      const r = step(g.player, dir, measure(winsRef.current), fragmentsOf(lvl), viewport())
      if (!r.moved) {
        setState({
          bump: { ...g.player, at: performance.now() },
          note: NOTES[r.blocked ?? "wall"] ?? g.note,
        })
        return
      }
      if (!r.won) {
        setState({ player: r.player, moves: g.moves + 1, note: null })
        return
      }

      const last = g.level === LEVELS.length - 1
      saveReached(last ? LEVELS.length : g.level + 1)
      setState({ player: r.player, moves: g.moves + 1, status: last ? "done" : "won", note: null })
    },
    [startLevel]
  )

  /*
   * The keyboard belongs to the game, not to whichever window is focused.
   * Clicking a room to raise it would otherwise take the player's controls
   * with it — so every window of the game hears the same keys.
   */
  const ids = [winId, ...wins.filter((w) => isFragmentWindow(w.id)).map((w) => w.id)].join("|")
  const keyRef = useRef(onKey)
  keyRef.current = onKey
  useEffect(() => {
    const offs = ids.split("|").map((id) => registerKeys(id, (e) => keyRef.current(e)))
    return () => offs.forEach((off) => off())
  }, [ids, registerKeys])

  /* ── Screen ────────────────────────────────────────────────────────── */

  if (isMobile || tooSmall) {
    return (
      <Panel>
        <Title />
        <p>
          defrag is played by dragging windows around a desktop, so it needs a
          screen at least {MIN_VIEW.w}×{MIN_VIEW.h}. come back on a bigger one.
        </p>
      </Panel>
    )
  }

  if (game.status === "intro") {
    const reached = loadReached()
    const resume = reached > 0 && reached < LEVELS.length
    return (
      <Panel>
        <Title />
        <p>
          the machine is coming apart. its rooms have drifted into separate
          windows.
        </p>
        <p>
          drag the windows so the rooms meet edge to edge, then walk through.
          you can only walk where you can see.
        </p>
        <Keys />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" className="seg" onClick={() => startLevel(resume ? reached : 0)}>
            {resume ? `continue — level ${reached + 1}` : "start"}
          </button>
          {resume && (
            <button type="button" className="seg" onClick={() => startLevel(0)}>
              from the beginning
            </button>
          )}
        </div>
      </Panel>
    )
  }

  if (game.status === "done") {
    return (
      <Panel>
        <Title />
        <p>every sector is back where it belongs. the machine holds — for now.</p>
        <p style={{ color: "var(--ink-faint)" }}>that&rsquo;s all there is so far.</p>
        <button type="button" className="seg" onClick={() => startLevel(0)}>
          play again
        </button>
      </Panel>
    )
  }

  const linked = Object.values(game.links).reduce((n, l) => n + l.length, 0)

  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong style={{ letterSpacing: "0.06em" }}>
          {game.level + 1}/{LEVELS.length} · {level.name}
        </strong>
        <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>
          {game.moves} steps · {Math.floor(linked / 2)} joined
        </span>
      </div>

      {game.status === "won" ? (
        <>
          <p style={{ color: "#2c9a5f" }}>sector restored.</p>
          <button type="button" className="seg" onClick={() => startLevel(game.level + 1)}>
            next — enter
          </button>
        </>
      ) : (
        <>
          <p>{level.hint}</p>
          <p style={{ minHeight: "1.6em", color: "#c0584a" }}>{game.note ?? ""}</p>
          <Keys />
        </>
      )}
    </Panel>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 16px", fontSize: 13, lineHeight: 1.6 }}>{children}</div>
  )
}

function Title() {
  return (
    <pre style={{ margin: "0 0 10px", font: "inherit", fontSize: 12, lineHeight: 1.2 }}>
      {"defrag.exe\n──────────"}
    </pre>
  )
}

function Keys() {
  return (
    <p style={{ color: "var(--ink-faint)", fontSize: 12 }}>
      arrows or wasd to walk · r back to the start · click a room to bring it forward
    </p>
  )
}
