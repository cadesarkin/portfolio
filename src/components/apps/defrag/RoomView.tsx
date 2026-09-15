"use client"

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { CELL_H, CELL_W, parseFragment, tileAt, wholeView } from "@/lib/defrag/engine"
import { LEVELS, lightsJoins, roomIdOf } from "@/lib/defrag/levels"
import { getState, subscribe } from "@/lib/defrag/store"

/**
 * One room of the level, drawn on the fixed grid.
 *
 * The whole room is drawn, and the window shows the part of it its crop
 * allows: the canvas is shifted by the crop through CSS variables the window
 * sets, so a crop being dragged moves it without a React render.
 *
 * Glyphs are centred in their cell rather than laid out by the font's advance:
 * the cell is what has to line up with the room next door, and fonts do not
 * agree on how wide a character is.
 */

const BG = "#0a1016"
const FONT = "15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

const INK = {
  wall: "#5b95a3",
  heldWall: "#8a9bb4",
  hostile: "#e0604f",
  // Visible, but well below the walls: the floor is where you can go, and it
  // has to read as open space rather than as more wall.
  floor: "#3a6572",
  port: "#c9a44a",
  linked: "#7cf0b0",
  player: "#ffd166",
  exit: "#d98cff",
  key: "#ffd166",
  door: "#e39a4f",
  switch: "#6fd3ff",
  note: "#f2f2e8",
  read: "#56707a",
  open: "#4fbf87",
  shut: "#e0604f",
  static: "#243a45",
}

/** Characters for a cell with nothing in it: the machine coming apart. */
const STATIC = " .:'`,"

/** Tiles the player can stand on, at least some of the time. */
const WALKABLE = new Set([".", ">", "$", "%", "^", "?", "+", "="])

export default function RoomView({ winId }: { winId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const game = useSyncExternalStore(subscribe, getState, getState)
  const roomId = roomIdOf(winId)
  const level = LEVELS[game.level]
  const def = level?.rooms.find((r) => r.id === roomId)
  const frag = useMemo(() => (def ? parseFragment(def.id, def.rows) : null), [def])

  // Read by the draw loop, which is installed once per room.
  const live = useRef(game)
  live.current = game

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || !frag || !def) return

    const w = frag.cols * CELL_W
    const h = frag.rows * CELL_H
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const notes = level?.notes ?? {}

    let raf = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (document.hidden) return
      const g = live.current
      const world = g.world
      const view = g.views[frag.id] ?? wholeView(frag)
      // Unlit levels show where the doors are, but not which of them meet,
      // unless a hint is showing.
      const lit = (level && lightsJoins(level)) || now < g.hint
      const linked = new Set(lit ? (g.links[frag.id] ?? []) : [])
      const t = now / 1000
      const pulse = 0.55 + 0.45 * Math.sin(t * 4)
      // Walls say what a room will let you do with it: red for a window that
      // works against you, grey for one held in place.
      const released = world.unlocked.includes(def.id)
      const wallInk =
        def.onTop || def.hostile
          ? INK.hostile
          : def.pinned || (def.locked && !released)
            ? INK.heldWall
            : INK.wall

      ctx.fillStyle = BG
      ctx.fillRect(0, 0, w, h)
      ctx.font = FONT
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      const glyph = (ch: string, ink: string, x: number, y: number) => {
        ctx.fillStyle = ink
        ctx.fillText(ch, x * CELL_W + CELL_W / 2, y * CELL_H + CELL_H / 2)
      }
      const tint = (rgba: string, x: number, y: number) => {
        ctx.fillStyle = rgba
        ctx.fillRect(x * CELL_W, y * CELL_H, CELL_W, CELL_H)
      }

      for (let y = 0; y < frag.rows; y++) {
        for (let x = 0; x < frag.cols; x++) {
          const tile = tileAt(frag, x, y, world)

          if (tile === " ") {
            // Static that shifts a few times a second, seeded per cell so it
            // flickers rather than scrolls.
            const n = Math.sin(x * 12.9898 + y * 78.233 + Math.floor(t * 3) * 3.7) * 43758.5
            const ch = STATIC[Math.floor((n - Math.floor(n)) * STATIC.length)]
            if (ch !== " ") glyph(ch, INK.static, x, y)
            continue
          }

          const edge =
            WALKABLE.has(tile) &&
            (x === view.ox ||
              y === view.oy ||
              x === view.ox + view.cols - 1 ||
              y === view.oy + view.rows - 1)
          const on = edge && linked.has(`${x},${y}`)
          if (on) tint("rgba(124, 240, 176, 0.14)", x, y)

          switch (tile) {
            case ".":
              // An open edge: lit when it meets another room, a warm dot when
              // it leads nowhere yet.
              if (edge) glyph("·", on ? INK.linked : INK.port, x, y)
              else glyph(".", INK.floor, x, y)
              break
            case ">":
              tint(`rgba(217, 140, 255, ${(0.12 * pulse).toFixed(3)})`, x, y)
              glyph(">", INK.exit, x, y)
              break
            case "$":
              glyph("$", INK.key, x, y)
              break
            case "%":
              if (world.keys > 0) tint(`rgba(227, 154, 79, ${(0.16 * pulse).toFixed(3)})`, x, y)
              glyph("%", INK.door, x, y)
              break
            case "^":
              glyph("^", INK.switch, x, y)
              break
            case "?": {
              const read = world.read.includes(`${frag.id}:${x},${y}`)
              if (!read && notes[`${frag.id}:${x},${y}`]) {
                tint(`rgba(242, 242, 232, ${(0.1 * pulse).toFixed(3)})`, x, y)
              }
              glyph("?", read ? INK.read : INK.note, x, y)
              break
            }
            case "+":
              glyph("+", world.gates ? INK.open : INK.shut, x, y)
              break
            case "=":
              glyph("=", world.gates ? INK.shut : INK.open, x, y)
              break
            default:
              glyph(tile, wallInk, x, y)
          }
        }
      }

      const p = g.player
      if (p && p.frag === frag.id) {
        const bumped = g.bump && g.bump.frag === frag.id && now - g.bump.at < 180
        tint(bumped ? "rgba(224, 88, 74, 0.5)" : "rgba(255, 209, 102, 0.18)", p.x, p.y)
        glyph("@", INK.player, p.x, p.y)
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [frag, def, level])

  if (!frag || !def) return null
  const what = def.hostile ? ", hostile" : def.locked ? ", locked in place" : def.pinned ? ", pinned" : ""
  return (
    <div style={{ background: BG, lineHeight: 0, flex: "0 0 auto" }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${def.title}${what}`}
        style={{
          display: "block",
          transform: "translate(calc(-1 * var(--crop-x, 0px)), calc(-1 * var(--crop-y, 0px)))",
        }}
      />
    </div>
  )
}
