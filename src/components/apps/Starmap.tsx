"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
import {
  WORLDS,
  createShip,
  setCourse,
  stepShip,
  heading,
  shipGlyph,
  worldById,
  distanceRemaining,
  type Ship,
} from "@/lib/starmap"
import { sceneFor } from "@/lib/scene"

/** Character cell for the scene canvas. */
const CELL = 9
const LINE = 14

type View = "map" | "surface"

export default function Starmap({
  winId,
  isMobile,
}: {
  winId: string
  isMobile: boolean
}) {
  const [ship, setShip] = useState<Ship>(createShip)
  const [view, setView] = useState<View>("map")
  const [selected, setSelected] = useState(0)

  const landedWorld = ship.landed ? worldById(ship.landed) : undefined
  const travelling = ship.target !== null

  // Flight. A fixed interval rather than rAF: the map is a character grid and
  // does not need sixty updates a second to read as movement.
  useEffect(() => {
    if (!travelling) return
    const id = setInterval(() => setShip((s) => stepShip(s, 0.05)), 50)
    return () => clearInterval(id)
  }, [travelling])

  const travelTo = useCallback((id: string) => {
    setView("map")
    setShip((s) => setCourse(s, id))
  }, [])

  useWindowKeys(winId, (e) => {
    if (view === "surface") {
      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault()
        setView("map")
      }
      return
    }
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault()
      setSelected((i) => (i + 1) % WORLDS.length)
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault()
      setSelected((i) => (i - 1 + WORLDS.length) % WORLDS.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const w = WORLDS[selected]
      if (ship.landed === w.id) setView("surface")
      else travelTo(w.id)
    }
  })

  return view === "surface" && landedWorld ? (
    <Surface
      world={landedWorld}
      isMobile={isMobile}
      onLeave={() => setView("map")}
    />
  ) : (
    <Map
      ship={ship}
      selected={selected}
      onSelect={setSelected}
      onTravel={travelTo}
      onLand={() => setView("surface")}
      isMobile={isMobile}
    />
  )
}

/* ── The map ─────────────────────────────────────────────────────────── */

function Map({
  ship,
  selected,
  onSelect,
  onTravel,
  onLand,
  isMobile,
}: {
  ship: Ship
  selected: number
  onSelect: (i: number) => void
  onTravel: (id: string) => void
  onLand: () => void
  isMobile: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Starfield backdrop.
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !wrap || !ctx) return

    let raf = 0
    let t = 0
    let last = performance.now()
    const scene = sceneFor("void")

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (document.hidden) {
        last = now
        return
      }
      t += Math.min((now - last) / 1000, 0.05)
      last = now

      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (canvas.width !== Math.floor(rect.width * dpr)) {
        canvas.width = Math.floor(rect.width * dpr)
        canvas.height = Math.floor(rect.height * dpr)
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `${CELL + 2}px ui-monospace, Menlo, Consolas, monospace`
      ctx.textBaseline = "top"

      ctx.fillStyle = scene.background
      ctx.fillRect(0, 0, rect.width, rect.height)

      const cols = Math.ceil(rect.width / CELL)
      const rows = Math.ceil(rect.height / LINE)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const { ch, color } = scene.shade((c + 0.5) / cols, (r + 0.5) / rows, t)
          if (ch === " ") continue
          ctx.fillStyle = color
          ctx.fillText(ch, c * CELL, r * LINE)
        }
      }
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const target = ship.target ? worldById(ship.target) : undefined

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 12px",
          borderBottom: "1px solid var(--win-rule)",
          fontSize: 12.5,
          color: "var(--ink-muted)",
        }}
      >
        <span>
          {ship.landed
            ? `landed · ${worldById(ship.landed)?.name}`
            : target
              ? `en route to ${target.name} · ${(distanceRemaining(ship) * 100).toFixed(0)} units`
              : "adrift"}
        </span>
        <span style={{ marginLeft: "auto", color: "var(--ink-faint)" }}>
          {WORLDS.length} worlds charted
        </span>
      </div>

      <div
        ref={wrapRef}
        style={{ position: "relative", flex: "1 1 auto", minHeight: 220 }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, display: "block" }}
        />

        {WORLDS.map((w, i) => {
          const here = ship.landed === w.id
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                onSelect(i)
                if (here) onLand()
                else onTravel(w.id)
              }}
              onMouseEnter={() => onSelect(i)}
              aria-label={`${w.name}: ${w.blurb}`}
              style={{
                position: "absolute",
                left: `${w.x * 100}%`,
                top: `${w.y * 100}%`,
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "6px 10px",
                font: "inherit",
                fontSize: isMobile ? 11 : 12,
                color: here ? "#8fe0a0" : selected === i ? "#cfe6ff" : "#7f9ab8",
                background:
                  selected === i ? "rgba(120,170,230,0.14)" : "transparent",
                border: `1px solid ${
                  selected === i ? "rgba(150,200,255,0.5)" : "transparent"
                }`,
                borderRadius: 3,
                cursor: "pointer",
                whiteSpace: "nowrap",
                textShadow: "0 1px 4px rgba(0,0,0,0.9)",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
                {here ? "◉" : "○"}
              </span>
              <span>{w.name}</span>
            </button>
          )
        })}

        {/* The ship. */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${ship.x * 100}%`,
            top: `${ship.y * 100}%`,
            transform: "translate(-50%, -50%)",
            fontSize: 20,
            lineHeight: 1,
            color: "#ffd166",
            textShadow: "0 0 8px rgba(255,209,102,0.8)",
            transition: "left 60ms linear, top 60ms linear",
            pointerEvents: "none",
          }}
        >
          {shipGlyph(heading(ship))}
        </span>
      </div>

      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid var(--win-rule)",
          fontSize: 12,
          color: "var(--ink-faint)",
          textAlign: "center",
        }}
      >
        {WORLDS[selected]?.blurb}
        {" · "}
        {ship.landed === WORLDS[selected]?.id
          ? "click again to land"
          : "click a world to set course"}
      </div>
    </div>
  )
}

/* ── A world's surface ───────────────────────────────────────────────── */

function Surface({
  world,
  isMobile,
  onLeave,
}: {
  world: (typeof WORLDS)[number]
  isMobile: boolean
  onLeave: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !wrap || !ctx) return

    const scene = sceneFor(world.scene)
    let raf = 0
    let t = 0
    let last = performance.now()

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (document.hidden) {
        last = now
        return
      }
      t += Math.min((now - last) / 1000, 0.05)
      last = now

      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (canvas.width !== Math.floor(rect.width * dpr)) {
        canvas.width = Math.floor(rect.width * dpr)
        canvas.height = Math.floor(rect.height * dpr)
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `${CELL + 2}px ui-monospace, Menlo, Consolas, monospace`
      ctx.textBaseline = "top"

      ctx.fillStyle = scene.background
      ctx.fillRect(0, 0, rect.width, rect.height)

      const cols = Math.ceil(rect.width / CELL)
      const rows = Math.ceil(rect.height / LINE)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const { ch, color } = scene.shade((c + 0.5) / cols, (r + 0.5) / rows, t)
          if (ch === " ") continue
          ctx.fillStyle = color
          ctx.fillText(ch, c * CELL, r * LINE)
        }
      }
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [world.scene])

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          borderBottom: "1px solid var(--win-rule)",
          fontSize: 12.5,
        }}
      >
        <button type="button" className="seg" onClick={onLeave}>
          ‹ back to map
        </button>
        <span style={{ color: "var(--ink)" }}>{world.name}</span>
        <span style={{ color: "var(--ink-faint)", marginLeft: "auto" }}>
          {world.blurb}
        </span>
      </div>

      <div ref={wrapRef} style={{ position: "relative", flex: "1 1 auto", minHeight: 220 }}>
        <canvas
          ref={canvasRef}
          aria-label={`${world.name} surface`}
          style={{ position: "absolute", inset: 0, display: "block" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              background: "rgba(6, 12, 24, 0.72)",
              border: "1px solid rgba(160,200,255,0.28)",
              color: "#dbe9f5",
              fontSize: isMobile ? 12 : 13,
              textAlign: "center",
              maxWidth: "42ch",
              lineHeight: 1.6,
            }}
          >
            <div style={{ letterSpacing: "0.18em", fontSize: 11, opacity: 0.7 }}>
              SURVEY COMPLETE
            </div>
            <div style={{ marginTop: 8 }}>
              Nothing installed here yet. This is where{" "}
              <strong>{world.app}</strong> will run.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
