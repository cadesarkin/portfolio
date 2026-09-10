"use client"

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { CELL_H, CELL_W, parseFragment } from "@/lib/defrag/engine"
import { LEVELS, fragmentIdOf } from "@/lib/defrag/levels"
import { getState, subscribe } from "@/lib/defrag/store"

/**
 * One room of the level, drawn on the fixed grid.
 *
 * Glyphs are centred in their cell rather than laid out by the font's advance:
 * the cell is what has to line up with the room next door, and fonts do not
 * agree on how wide a character is.
 */

const BG = "#0a1016"
const FONT = "15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

const INK = {
  wall: "#5b95a3",
  lockedWall: "#8a9bb4",
  hostile: "#e0604f",
  // Visible, but well below the walls: the floor is where you can go, and it
  // has to read as open space rather than as more wall.
  floor: "#3a6572",
  port: "#c9a44a",
  linked: "#7cf0b0",
  player: "#ffd166",
  exit: "#d98cff",
  static: "#243a45",
}

/** Characters for a cell with nothing in it: the machine coming apart. */
const STATIC = " .:'`,"

export default function FragmentView({ winId }: { winId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const game = useSyncExternalStore(subscribe, getState, getState)
  const fragId = fragmentIdOf(winId)
  const def = LEVELS[game.level]?.fragments.find((f) => f.id === fragId)
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

    const portAt = new Set(frag.ports.map((p) => `${p.x},${p.y}`))
    const wallInk = def.onTop ? INK.hostile : def.locked ? INK.lockedWall : INK.wall

    let raf = 0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (document.hidden) return
      const g = live.current
      const linked = new Set(g.links[frag.id] ?? [])
      const t = now / 1000

      ctx.fillStyle = BG
      ctx.fillRect(0, 0, w, h)
      ctx.font = FONT
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      for (let y = 0; y < frag.rows; y++) {
        for (let x = 0; x < frag.cols; x++) {
          const tile = frag.tiles[y][x]
          const cx = x * CELL_W + CELL_W / 2
          const cy = y * CELL_H + CELL_H / 2
          const key = `${x},${y}`

          if (tile === " ") {
            // Static that shifts a few times a second, seeded per cell so it
            // flickers rather than scrolls.
            const n = Math.sin(x * 12.9898 + y * 78.233 + Math.floor(t * 3) * 3.7) * 43758.5
            const r = n - Math.floor(n)
            const ch = STATIC[Math.floor(r * STATIC.length)]
            if (ch !== " ") {
              ctx.fillStyle = INK.static
              ctx.fillText(ch, cx, cy)
            }
            continue
          }

          if (portAt.has(key)) {
            // An open edge: lit when it meets another room, a warm dot when
            // it leads nowhere yet.
            const on = linked.has(key)
            if (on) {
              ctx.fillStyle = "rgba(124, 240, 176, 0.14)"
              ctx.fillRect(x * CELL_W, y * CELL_H, CELL_W, CELL_H)
            }
            ctx.fillStyle = on ? INK.linked : INK.port
            ctx.fillText(on ? "=" : "·", cx, cy)
            continue
          }

          if (tile === ">") {
            const pulse = 0.55 + 0.45 * Math.sin(t * 4)
            ctx.fillStyle = `rgba(217, 140, 255, ${(0.12 * pulse).toFixed(3)})`
            ctx.fillRect(x * CELL_W, y * CELL_H, CELL_W, CELL_H)
            ctx.fillStyle = INK.exit
            ctx.fillText(">", cx, cy)
            continue
          }

          ctx.fillStyle = tile === "." ? INK.floor : wallInk
          ctx.fillText(tile, cx, cy)
        }
      }

      const p = g.player
      if (p && p.frag === frag.id) {
        const bumped = g.bump && g.bump.frag === frag.id && now - g.bump.at < 180
        ctx.fillStyle = bumped ? "rgba(224, 88, 74, 0.5)" : "rgba(255, 209, 102, 0.18)"
        ctx.fillRect(p.x * CELL_W, p.y * CELL_H, CELL_W, CELL_H)
        ctx.fillStyle = INK.player
        ctx.fillText("@", p.x * CELL_W + CELL_W / 2, p.y * CELL_H + CELL_H / 2)
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [frag, def])

  if (!frag) return null
  return (
    <div style={{ background: BG, lineHeight: 0, flex: "0 0 auto" }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${def?.title ?? "room"}${def?.locked ? ", locked in place" : ""}`}
        style={{ display: "block" }}
      />
    </div>
  )
}
