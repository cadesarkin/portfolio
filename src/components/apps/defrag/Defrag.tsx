"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useWindows } from "@/components/desktop/window-manager"
import { allowed, stackOrder, type Allow, type Win } from "@/components/desktop/window-reducer"
import {
  CELL_H,
  CELL_W,
  CHROME,
  applyEvents,
  links,
  newWorld,
  step,
  type Dir,
  type Placement,
  type Trigger,
  type View,
  type World,
} from "@/lib/defrag/engine"
import {
  CHAPTERS,
  CONTROLLER_W,
  LEVELS,
  MIN_CROP,
  MIN_VIEW,
  HINT_MS,
  fullView,
  lightsJoins,
  isRoomWindow,
  roomIdOf,
  roomWindowId,
  roomsOf,
  startOf,
  startingAt,
  type Note,
  type RoomDef,
} from "@/lib/defrag/levels"
import {
  getState,
  initialState,
  loadReached,
  saveReached,
  setState,
  subscribe,
} from "@/lib/defrag/store"
import {
  getProgress,
  getServerProgress,
  launch,
  showScene,
  startOver,
  subscribeProgress,
} from "@/lib/defrag/progress"
import { resolve } from "@/lib/vfs-utils"
import type { VFile, VNode } from "@/lib/vfs-types"

/**
 * defrag.exe — the program that runs the game.
 *
 * It opens a level's rooms as windows, owns the keyboard for all of them,
 * applies the rules, and runs the windows that work against the player. It
 * does not draw rooms; each room window draws itself from the shared store.
 * The rules need to know where windows really are, so this is the one place
 * that reads geometry from the DOM.
 */

/** What every room window is, as far as the window manager can tell. */
const ROOM_NODE: VNode = { kind: "app", name: "room", app: "fragment", icon: "game" }

/** Notes found in rooms open as text windows with ids of their own. */
const NOTE_PREFIX = "defrag-note:"
const isNoteWindow = (id: string): boolean => id.startsWith(NOTE_PREFIX)

/** The controller window's height: the side column below it holds notes and the terminal. */
const CONTROLLER_H = 300

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
const REFUSED: Record<string, string | null> = {
  wall: null,
  door: "a locked door. it wants a key.",
  gate: "a gate, shut. somewhere a switch flips it.",
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
      frag: isRoomWindow(w.id) ? roomIdOf(w.id) : undefined,
      outer: { x: o.left, y: o.top, w: o.width, h: o.height },
      body: { x: b.left, y: b.top, w: b.width, h: b.height },
      z: stackOrder(w),
      // Read from the element, which a crop being dragged updates live.
      ox: Number(el.dataset.ox ?? 0),
      oy: Number(el.dataset.oy ?? 0),
    })
  }
  return out
}

const viewport = () => ({ w: window.innerWidth, h: window.innerHeight })

/**
 * What the player may do to a room's window, given what has happened so far
 * and whether they are standing in it.
 */
function allowFor(r: RoomDef, world: World, inside = false): Allow {
  const held = Boolean(r.hostile) || (Boolean(r.locked) && !world.unlocked.includes(r.id))
  return {
    move: !held && !r.pinned && !(r.heavy && inside),
    resize: Boolean(r.crop) && !held,
    close: false,
    minimize: false,
    maximize: false,
  }
}

/** A room's title, with what holds it first: narrow windows cut titles short. */
function titleFor(r: RoomDef, world: World): string {
  if (r.hostile) return r.title
  if (r.locked && !world.unlocked.includes(r.id)) return `locked · ${r.title}`
  if (r.pinned) return `pinned · ${r.title}`
  if (r.heavy) return `heavy · ${r.title}`
  return r.title
}

/** The outer rect that puts a room's view at a spot, before the window snaps it. */
function rectAt(spot: { col: number; row: number }, v: View) {
  return {
    x: (spot.col + v.ox) * CELL_W - CHROME.left,
    y: (spot.row + v.oy) * CELL_H - CHROME.top,
    w: v.cols * CELL_W + CHROME.left + CHROME.right,
    h: v.rows * CELL_H + CHROME.top + CHROME.bottom,
  }
}

/** The column under the controller, where no level reaches: notes open here. */
function sideRect() {
  const x = window.innerWidth - CONTROLLER_W - 16
  const y = 48 + CONTROLLER_H + 12
  return { x, y, w: CONTROLLER_W, h: Math.max(180, window.innerHeight - 32 - y - 8) }
}

function switchNote(triggers: Trigger[] | undefined): string {
  const parts = ["click."]
  if (triggers?.some((t) => t.kind === "gates")) parts.push("every gate flips.")
  if (triggers?.some((t) => t.kind === "unlock")) parts.push("somewhere, a window comes loose.")
  if (triggers?.some((t) => t.kind === "kill")) parts.push("somewhere, a process dies.")
  if (parts.length === 1) parts.push("nothing happens.")
  return parts.join(" ")
}

export default function Defrag({ winId, isMobile }: { winId: string; isMobile: boolean }) {
  const api = useWindows()
  const { wins, registerKeys } = api
  const game = useSyncExternalStore(subscribe, getState, getState)
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getServerProgress)

  // Read by timers and listeners that outlive a render. The window manager's
  // functions change identity whenever any window moves.
  const winsRef = useRef(wins)
  winsRef.current = wins
  const apiRef = useRef(api)
  apiRef.current = api

  /** Bumped whenever a level (re)starts, so its hostile timers start over. */
  const [run, setRun] = useState(0)

  const level = LEVELS[game.level]
  const tooSmall =
    typeof window !== "undefined" &&
    (window.innerWidth < MIN_VIEW.w || window.innerHeight < MIN_VIEW.h)

  /* ── Opening and closing a level ───────────────────────────────────── */

  const closeLevel = useCallback(() => {
    for (const w of winsRef.current) {
      if (isRoomWindow(w.id) || isNoteWindow(w.id)) apiRef.current.close(w.id, true)
    }
  }, [])

  const startLevel = useCallback(
    (index: number) => {
      const lvl = LEVELS[index]
      if (!lvl) return
      const { open, minimize, move, focus } = apiRef.current
      closeLevel()

      // Clear the stage. Every window on screen is part of the level, so a
      // folder left open from before would sit across the rooms and block the
      // way for reasons that have nothing to do with the puzzle.
      for (const w of winsRef.current) {
        if (w.id !== winId && !isRoomWindow(w.id) && !isNoteWindow(w.id)) minimize(w.id)
      }

      // The program sits out of the way on the right, where no level reaches.
      move(winId, { x: window.innerWidth - CONTROLLER_W - 16, y: 48 }, true)

      const world = newWorld()
      const frags = roomsOf(lvl)
      const start = startOf(lvl)
      for (const r of lvl.rooms) {
        const f = frags[r.id]
        const v = fullView(r)
        open(ROOM_NODE, {
          id: roomWindowId(r.id),
          title: titleFor(r, world),
          // Approximate: the window corrects itself onto the grid on its
          // first frame, using the chrome it actually has.
          rect: rectAt(startingAt(r), v),
          grid: {
            cw: CELL_W,
            ch: CELL_H,
            cols: v.cols,
            rows: v.rows,
            ox: v.ox,
            oy: v.oy,
            ...(r.crop && { max: { cols: f.cols, rows: f.rows }, min: MIN_CROP }),
          },
          allow: allowFor(r, world, r.id === start.frag),
          onTop: r.onTop,
          skipTaskbar: true,
        })
      }
      focus(winId)

      setState({
        level: index,
        status: "playing",
        player: startOf(lvl),
        world,
        moves: 0,
        links: {},
        views: {},
        bump: null,
        note: null,
        hint: 0,
        hintsUsed: 0,
      })
      heavyIn.current = lvl.rooms.find((r) => r.heavy && r.id === start.frag)?.id ?? null
      setRun((n) => n + 1)
    },
    [closeLevel, winId]
  )

  const toMenu = useCallback(() => {
    closeLevel()
    setState({ ...initialState })
  }, [closeLevel])

  /**
   * Clears the screen and sends the ship up. Everything steps aside, this
   * window too, so the launch has the whole sky.
   */
  const takeOff = useCallback(() => {
    closeLevel()
    setState({ ...initialState })
    apiRef.current.minimizeAll()
    launch()
  }, [closeLevel])

  /*
   * Closing the program takes its rooms with it, and the next launch starts
   * clean. Unmount only: an effect keyed on the window manager's functions
   * would tear the level down every time the player dragged a room.
   */
  useEffect(
    () => () => {
      for (const w of winsRef.current) {
        if (isRoomWindow(w.id) || isNoteWindow(w.id)) apiRef.current.close(w.id, true)
      }
      setState(initialState)
    },
    []
  )

  /* ── Lit edges and views, recomputed whenever windows move ─────────── */

  const refresh = useCallback(() => {
    const g = getState()
    if (g.status !== "playing") return
    const lvl = LEVELS[g.level]
    const frags = roomsOf(lvl)
    const placements = measure(winsRef.current)
    const next: Record<string, string[]> = {}
    const views: Record<string, View> = {}
    for (const p of placements) {
      if (!p.frag || !frags[p.frag]) continue
      views[p.frag] = {
        ox: p.ox ?? 0,
        oy: p.oy ?? 0,
        cols: Math.round(p.body.w / CELL_W),
        rows: Math.round(p.body.h / CELL_H),
      }
      next[p.frag] = links(p.frag, placements, frags, viewport(), g.world)
    }
    setState({ links: next, views })
  }, [])

  useEffect(() => {
    // After the windows have painted in their new places.
    const raf = requestAnimationFrame(refresh)
    return () => cancelAnimationFrame(raf)
  }, [wins, game.status, game.level, game.world, refresh])

  useEffect(() => {
    // Mid-drag, windows move without the window manager hearing about it
    // until the drop; they announce it on the page instead, and the lit edges
    // follow along. Throttled to a frame.
    let raf = 0
    const onGeometry = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        refresh()
      })
    }
    document.addEventListener("win-geometry", onGeometry)
    window.addEventListener("resize", onGeometry)
    return () => {
      document.removeEventListener("win-geometry", onGeometry)
      window.removeEventListener("resize", onGeometry)
      cancelAnimationFrame(raf)
    }
  }, [refresh])

  /* ── The world acting on the windows ───────────────────────────────── */

  // A room released by a switch can now be moved; a killed process's window
  // goes. Keyed on the two lists, which change only when something happens.
  const { killed, unlocked } = game.world
  useEffect(() => {
    if (getState().status !== "playing") return
    const g = getState()
    for (const r of LEVELS[g.level].rooms) {
      const id = roomWindowId(r.id)
      const win = winsRef.current.find((w) => w.id === id)
      if (!win) continue
      if (killed.includes(r.id)) {
        apiRef.current.close(id, true)
        // The kill was typed into the terminal; the arrows belong to the game
        // again straight after, without a click to take them back, and the
        // terminal steps aside until it is asked for again.
        apiRef.current.minimize("/terminal")
        apiRef.current.focus(winId)
      } else if (unlocked.includes(r.id) && !allowed(win, "move")) {
        apiRef.current.configure(id, {
          allow: allowFor(r, g.world, g.player?.frag === r.id),
          title: titleFor(r, g.world),
        })
      }
    }
  }, [killed, unlocked, winId])

  // A heavy room holds still while the player stands in it, and lets go when
  // they step out.
  const player = game.player
  const heavyIn = useRef<string | null>(null)
  useEffect(() => {
    const g = getState()
    if (!player || g.status !== "playing") return
    const rooms = LEVELS[g.level].rooms
    const now = rooms.find((r) => r.heavy && r.id === player.frag)?.id ?? null
    if (now === heavyIn.current) return
    for (const id of [heavyIn.current, now]) {
      const r = id ? rooms.find((q) => q.id === id) : undefined
      if (r) apiRef.current.configure(roomWindowId(r.id), { allow: allowFor(r, g.world, r.id === now) })
    }
    heavyIn.current = now
  }, [player])

  // A crop may never cut out the tile the player is standing on.
  const keptIn = useRef<string | null>(null)
  useEffect(() => {
    if (!player || getState().status !== "playing") return
    const { regrid } = apiRef.current
    const def = LEVELS[getState().level].rooms.find((r) => r.id === player.frag)
    if (keptIn.current && keptIn.current !== player.frag) {
      regrid(roomWindowId(keptIn.current), { keep: null }, undefined, true)
      keptIn.current = null
    }
    if (def?.crop) {
      regrid(roomWindowId(def.id), { keep: { x: player.x, y: player.y } }, undefined, true)
      keptIn.current = def.id
    }
  }, [player])

  /* ── Hostile windows ───────────────────────────────────────────────── */

  useEffect(() => {
    if (game.status !== "playing") return
    const lvl = LEVELS[game.level]
    const timers: number[] = []
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))
    const alive = (r: RoomDef) => !getState().world.killed.includes(r.id)

    for (const r of lvl.rooms) {
      const h = r.hostile
      if (!h) continue
      const id = roomWindowId(r.id)

      if (h.kind === "popup") {
        const pop = () => {
          if (!alive(r)) return
          apiRef.current.raise(id)
          later(pop, h.every)
        }
        later(pop, h.every)
      }

      if (h.kind === "blink") {
        const hide = () => {
          if (!alive(r)) return
          // It will not vanish with the player inside: it waits.
          if (getState().player?.frag === r.id) return later(hide, 300)
          apiRef.current.minimize(id, true)
          later(show, h.down)
        }
        const show = () => {
          if (!alive(r)) return
          apiRef.current.raise(id)
          later(hide, h.up)
        }
        later(hide, h.up)
      }

      if (h.kind === "wander") {
        let i = 0
        const hop = () => {
          if (!alive(r)) return
          i = (i + 1) % h.spots.length
          const { x, y } = rectAt(h.spots[i], fullView(r))
          // Whoever is inside goes along: the player stands in the room, not
          // on the screen.
          apiRef.current.move(id, { x, y }, true)
          apiRef.current.raise(id)
          later(hop, h.every)
        }
        later(hop, h.every)
      }
    }
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [game.status, game.level, run])

  /* ── Notes and the terminal ────────────────────────────────────────── */

  const openNote = useCallback((at: string, note: Note) => {
    const file: VFile = { kind: "file", name: note.title, ext: "txt", body: note.lines.join("\n") }
    apiRef.current.open(file, {
      id: `${NOTE_PREFIX}${at}`,
      title: note.title,
      rect: sideRect(),
      allow: { maximize: false },
      skipTaskbar: true,
    })
  }, [])

  /*
   * The terminal opens over this window rather than beside it: the notes that
   * hold the pids sit beside it, and have to stay readable while one is typed.
   * A kill hands the keyboard back here, which brings this window back up.
   */
  const openTerminal = useCallback(() => {
    const node = resolve("/terminal", "/")
    if (!node) return
    const { open, move, resize, focus } = apiRef.current
    const x = window.innerWidth - CONTROLLER_W - 16
    open(node, { rect: { x, y: 48, w: CONTROLLER_W, h: CONTROLLER_H } })
    // Already open somewhere across the rooms: bring it over here.
    move("/terminal", { x, y: 48 }, true)
    resize("/terminal", { w: CONTROLLER_W, h: CONTROLLER_H }, true)
    focus("/terminal")
  }, [])

  /** Lights the joins for a moment, and counts it. */
  const askHint = useCallback(() => {
    const g = getState()
    if (g.status !== "playing") return
    setState({ hint: performance.now() + HINT_MS, hintsUsed: g.hintsUsed + 1 })
    // The rooms only redraw what they are told; wake them when it lapses.
    window.setTimeout(() => setState({}), HINT_MS + 50)
  }, [])

  /* ── Keys ──────────────────────────────────────────────────────────── */

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const g = getState()

      if (e.key === "Enter" || e.key === " ") {
        if (g.status === "intro") {
          e.preventDefault()
          const reached = loadReached()
          startLevel(reached < LEVELS.length ? reached : 0)
        } else if (g.status === "won") {
          e.preventDefault()
          startLevel(g.level + 1)
        }
        return
      }

      if (g.status !== "playing" || !g.player) return

      if (e.key === "r" || e.key === "R") {
        e.preventDefault()
        startLevel(g.level)
        return
      }

      if ((e.key === "h" || e.key === "H") && !lightsJoins(LEVELS[g.level])) {
        e.preventDefault()
        askHint()
        return
      }

      const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase()]
      if (!dir) return
      e.preventDefault()

      const lvl = LEVELS[g.level]
      const r = step(g.player, dir, measure(winsRef.current), roomsOf(lvl), viewport(), g.world)
      if (!r.moved) {
        setState({
          bump: { ...g.player, at: performance.now() },
          note: REFUSED[r.blocked ?? "wall"] ?? g.note,
        })
        return
      }

      const world = applyEvents(g.world, r.events, lvl.triggers)
      let note: string | null = null
      for (const ev of r.events) {
        if (ev.kind === "key") note = "picked up a key."
        if (ev.kind === "door") note = "the door opens, and stays open."
        if (ev.kind === "switch") note = switchNote(lvl.triggers?.[ev.at])
        if (ev.kind === "note") {
          const found = lvl.notes?.[ev.at]
          if (found) {
            openNote(ev.at, found)
            note = `found ${found.title}.`
          }
        }
      }

      if (!r.won) {
        setState({ player: r.player, world, moves: g.moves + 1, note })
        return
      }
      const last = g.level === LEVELS.length - 1
      saveReached(last ? LEVELS.length : g.level + 1)
      setState({
        player: r.player,
        world,
        moves: g.moves + 1,
        status: last ? "done" : "won",
        note: null,
      })
    },
    [startLevel, openNote, askHint]
  )

  /*
   * The keyboard belongs to the game, not to whichever window is focused.
   * Clicking a room to raise it would otherwise take the player's controls
   * with it — so every window of the game hears the same keys.
   */
  const ids = [winId, ...wins.filter((w) => isRoomWindow(w.id) || isNoteWindow(w.id)).map((w) => w.id)].join("|")
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

  if (game.status === "intro") return <Menu onStart={startLevel} onLaunch={takeOff} />

  if (game.status === "done") {
    return (
      <Panel>
        <Title />
        <p>every sector is back where it belongs.</p>
        <p style={{ color: "var(--ink-faint)" }}>
          {progress.launched
            ? "the machine holds. for now. thank you for playing."
            : "out on the plains, the crew have finished. the ship is ready."}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {!progress.launched && (
            <button type="button" className="seg" onClick={takeOff}>
              launch
            </button>
          )}
          <button type="button" className="seg" onClick={toMenu}>
            levels
          </button>
        </div>
      </Panel>
    )
  }

  const hasProcs = level.rooms.some((r) => r.pid)

  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>
          {CHAPTERS[level.chapter]} · {game.level + 1}/{LEVELS.length}
        </span>
        <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>{game.moves} steps</span>
      </div>
      <strong style={{ letterSpacing: "0.06em" }}>{level.name}</strong>

      {game.status === "won" ? (
        <>
          <p style={{ color: "#2c9a5f" }}>
            sector restored in {game.moves} steps
            {lightsJoins(level)
              ? "."
              : game.hintsUsed === 0
                ? ", without a hint."
                : `, with ${game.hintsUsed} hint${game.hintsUsed === 1 ? "" : "s"}.`}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="seg" onClick={() => startLevel(game.level + 1)}>
              next — enter
            </button>
            <button type="button" className="seg" onClick={toMenu}>
              levels
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: "6px 0" }}>{level.hint}</p>
          <p style={{ minHeight: "1.6em", margin: "6px 0", color: "#c0584a" }}>{game.note ?? ""}</p>
          <Carrying world={game.world} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
            <button type="button" className="seg" onClick={() => startLevel(game.level)}>
              restart — r
            </button>
            {hasProcs && (
              <button type="button" className="seg" onClick={openTerminal}>
                terminal
              </button>
            )}
            {!lightsJoins(level) && (
              <button
                type="button"
                className="seg"
                onClick={askHint}
                title="light the edges that meet, for a moment"
              >
                hint — h{game.hintsUsed ? ` (${game.hintsUsed})` : ""}
              </button>
            )}
            <button type="button" className="seg" onClick={toMenu}>
              levels
            </button>
          </div>
          <Keys />
        </>
      )}
    </Panel>
  )
}

/** The level list: every chapter, every level reached so far. */
function Menu({ onStart, onLaunch }: { onStart: (i: number) => void; onLaunch: () => void }) {
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getServerProgress)
  const reached = Math.min(progress.reached, LEVELS.length)
  const done = reached >= LEVELS.length
  const next = done ? 0 : reached
  const label = reached === 0 ? "start" : done ? "play again" : `continue — ${LEVELS[next].name}`
  const intro = progress.launched
    ? "the ship has gone. out there, everything is fine."
    : done
      ? "every sector is back. the ship is waiting on the plains."
      : "the machine is coming apart. put it back."
  return (
    <Panel>
      <Title />
      <p style={{ margin: "0 0 8px" }}>{intro}</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" className="seg" onClick={() => onStart(next)}>
          {label}
        </button>
        {done && !progress.launched && (
          <button type="button" className="seg" onClick={onLaunch}>
            launch
          </button>
        )}
        {progress.launched && (
          <button
            type="button"
            className="seg"
            onClick={() => showScene(progress.scene === "space" ? "plains" : "space")}
          >
            {progress.scene === "space" ? "back to the plains" : "back to space"}
          </button>
        )}
        {progress.launched && (
          <button
            type="button"
            className="seg"
            onClick={startOver}
            title="the wreck burns again, and every level starts locked"
          >
            start over
          </button>
        )}
      </div>
      {/* Five chapters have to fit a 300px window: small buttons, tight rows. */}
      <div style={{ marginTop: 8, display: "grid", gap: 2 }}>
        {CHAPTERS.map((name, c) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ color: "var(--ink-faint)", fontSize: 11, width: 92, flex: "0 0 92px" }}>
              {name}
            </span>
            {LEVELS.map((l, i) =>
              l.chapter !== c ? null : (
                <button
                  key={l.id}
                  type="button"
                  className="seg"
                  disabled={i > reached}
                  onClick={() => onStart(i)}
                  title={i > reached ? "not reached yet" : l.name}
                  aria-label={`level ${i + 1}${i > reached ? ", not reached yet" : `, ${l.name}`}`}
                  style={{
                    fontSize: 11,
                    padding: 0,
                    width: 26,
                    height: 20,
                    lineHeight: "18px",
                    opacity: i > reached ? 0.35 : 1,
                  }}
                >
                  {i + 1}
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}

/** What the player is carrying, and which way the gates stand. */
function Carrying({ world }: { world: World }) {
  const bits: string[] = []
  if (world.keys > 0) bits.push(world.keys === 1 ? "carrying a key" : `carrying ${world.keys} keys`)
  if (world.gates) bits.push("gates flipped")
  if (!bits.length) return null
  return <p style={{ margin: "4px 0", color: "#c9a44a", fontSize: 12 }}>{bits.join(" · ")}</p>
}

/**
 * The panel is filled over the window's own translucent fill: the terminal
 * opens under this window, and its text must not show through.
 */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        fontSize: 13,
        lineHeight: 1.6,
        flex: "1 1 auto",
        background: "var(--win-fill-focus)",
      }}
    >
      {children}
    </div>
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
    <p style={{ color: "var(--ink-faint)", fontSize: 12, margin: 0 }}>
      arrows or wasd walk · click a room to bring it forward · dashed windows can be cut at the edges
    </p>
  )
}
