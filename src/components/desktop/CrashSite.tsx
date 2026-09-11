"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { CRATER } from "./BlissCanvas"
import { resolve } from "@/lib/vfs-utils"
import { useWindows } from "./window-manager"
import {
  EXHAUST,
  LAUNCH,
  LAUNCH_FIRE,
  WALK_SPEED,
  carryAt,
  countdownAt,
  crewFor,
  figure,
  liftAt,
  stageFor,
  width,
  type Layer,
} from "@/lib/crash-site"
import type { FireMix } from "@/lib/embers"
import {
  getProgress,
  getServerProgress,
  landInSpace,
  launch,
  setProgress,
  subscribeProgress,
} from "@/lib/defrag/progress"
import { LEVELS } from "@/lib/defrag/levels"

/**
 * The crash site, in the crater on the plains at the right of the wallpaper.
 *
 * Deliberately not a desktop icon. It belongs to the world the wallpaper
 * depicts rather than to the desktop chrome — which is what keeps the space
 * material from reading as a second, unrelated metaphor pasted on top of the
 * first. You find it in the field; you do not launch it from a list.
 *
 * defrag's levels rebuild it: every level finished sends one more person
 * walking up from the right, and the wreck becomes a ship. See crash-site.ts
 * for the stages. Positioned from the same CRATER constant the terrain shader
 * uses, so the two cannot drift apart when the window resizes.
 */

/** Line height, in em. Positions in lines are multiplied by it. */
const LINE = 1.05

/** Where newcomers start walking from: off the right edge of most screens. */
const FROM = 48

/** Seconds between newcomers setting off, when several are due at once. */
const STAGGER = 1.6

const CREW_COLORS = ["#ff9d3b", "#ffe066", "#7ee0c3", "#ff7aa8", "#9ecbff", "#f2f2e8"]

const OUTLINE =
  "1px 0 0 #0a1220, -1px 0 0 #0a1220, 0 1px 0 #0a1220, 0 -1px 0 #0a1220, 0 0 6px rgba(0,0,0,0.9)"

interface Member {
  x: number
  /** Standing where the job is; until then, walking there. */
  arrived: boolean
  /** When this one may set off, for someone who has not arrived yet. */
  leaves: number
}

interface Props {
  isMobile: boolean
  /** A game is in the way: newcomers wait off-screen until it is not. */
  busy: boolean
  /** Written here, read by the wallpaper: how hard the site is burning. */
  fire: React.MutableRefObject<FireMix>
}

export default function CrashSite({ isMobile, busy, fire }: Props) {
  const { open } = useWindows()
  const [hover, setHover] = useState(false)
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getServerProgress)
  const stage = stageFor(progress.reached, progress.launched, LEVELS.length)
  const crewCount = crewFor(progress.reached, progress.launched)
  const ready = stage.id === "ready"

  const crewRefs = useRef<(HTMLPreElement | null)[]>([])
  const rocketRef = useRef<HTMLDivElement>(null)
  const exhaustRef = useRef<HTMLPreElement>(null)
  const countRef = useRef<HTMLDivElement>(null)
  const members = useRef<Member[]>([])

  // Read by the animation loop, which is installed once.
  const live = useRef({ stage, crewCount, busy, launching: progress.launching })
  live.current = { stage, crewCount, busy, launching: progress.launching }

  // Whoever has already come stays where they were; newcomers queue up.
  useEffect(() => {
    const seen = getProgress().crewSeen
    const now = performance.now() / 1000
    const list = members.current
    const first = Math.max(seen, list.length)
    for (let i = list.length; i < crewCount; i++) {
      const known = i < seen
      list.push({
        x: known ? (stage.stations[i]?.x ?? 0) : FROM,
        arrived: known,
        leaves: now + Math.max(0, i - first) * STAGGER,
      })
    }
    list.length = crewCount
  }, [crewCount, stage.stations])

  useEffect(() => {
    fire.current = stage.fire
  }, [stage.fire, fire])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let launchStart = 0
    let landed = false
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame)
      if (document.hidden) {
        last = nowMs
        return
      }
      const now = nowMs / 1000
      const dt = Math.min((nowMs - last) / 1000, 0.1)
      last = nowMs
      const { stage, crewCount, busy, launching } = live.current
      const firstWaiting = members.current.findIndex((m) => !m.arrived)

      members.current.forEach((m, i) => {
        const el = crewRefs.current[i]
        const st = stage.stations[i]
        if (!el || !st || i >= crewCount) return
        let lines: string[]
        let x = m.x
        if (!m.arrived) {
          // Held back while a game covers the screen, so nobody arrives unseen.
          if (busy) m.leaves = now + (i - firstWaiting) * STAGGER
          if (busy || now < m.leaves) {
            el.style.visibility = "hidden"
            return
          }
          const target = st.span ? st.span[0] : st.x
          const dir = Math.sign(target - m.x)
          const stepX = WALK_SPEED * dt * (reduced ? 50 : 1)
          m.x = Math.abs(target - m.x) <= stepX ? target : m.x + dir * stepX
          x = m.x
          lines = figure("walk", now, dir < 0 ? -1 : 1)
          if (m.x === target) {
            m.arrived = true
            if (getProgress().crewSeen < i + 1) setProgress({ crewSeen: i + 1 })
          }
        } else if (st.span) {
          const c = carryAt(st.span, now + i * 1.7)
          m.x = x = c.x
          lines = figure(c.moving ? "carry" : "look", now, c.facing)
        } else {
          if (m.x !== st.x) {
            // The job moved: walk over to it.
            const dir = Math.sign(st.x - m.x)
            const stepX = WALK_SPEED * dt
            m.x = Math.abs(st.x - m.x) <= stepX ? st.x : m.x + dir * stepX
            x = m.x
            lines = m.x === st.x ? figure(st.action, now + i * 0.37, st.facing) : figure("walk", now, dir < 0 ? -1 : 1)
          } else {
            lines = figure(st.action, now + i * 0.37, st.facing)
          }
        }
        el.style.visibility = "visible"
        el.style.left = `${x - lines[0].length / 2}ch`
        el.style.bottom = `${st.bottom * LINE}em`
        el.textContent = lines.join("\n")
      })

      // The launch: count down, light, lift, and follow it up into space.
      const rocket = rocketRef.current
      if (launching && rocket) {
        if (!launchStart) launchStart = now
        const t = now - launchStart
        const lift = liftAt(t, window.innerHeight)
        const shake = t > LAUNCH.ignite && t < LAUNCH.lift + 1.2 ? Math.sin(now * 90) * 1.2 : 0
        rocket.style.transform = `translate(${shake}px, ${-lift}px)`
        if (exhaustRef.current) {
          const lit = t >= LAUNCH.ignite
          exhaustRef.current.style.visibility = lit ? "visible" : "hidden"
          exhaustRef.current.textContent = EXHAUST[Math.floor(now * 12) % EXHAUST.length].join("\n")
        }
        fire.current = t >= LAUNCH.ignite && t < LAUNCH.gone ? LAUNCH_FIRE : live.current.stage.fire
        if (countRef.current) countRef.current.textContent = countdownAt(t) ?? ""
        if (t >= LAUNCH.gone && !landed) {
          landed = true
          landInSpace()
        }
      } else if (rocket && launchStart) {
        launchStart = 0
        rocket.style.transform = ""
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [fire])

  const click = () => {
    if (ready) {
      launch()
      return
    }
    const node = resolve("/starmap", "/")
    if (node) open(node)
  }

  const rocket = stage.layers.find((l) => l.id === "rocket")
  const still = stage.layers.filter((l) => l.id !== "rocket")
  const top = Math.max(0, ...stage.layers.map((l) => l.bottom + l.art.length))
  // The button covers the art, so all of it answers to a click and a focus
  // ring has something to go round. Pieces are placed inside it from its edge.
  const left = Math.min(...stage.layers.map((l) => l.x))
  const right = Math.max(...stage.layers.map((l) => l.x + width(l.art)))

  return (
    <div
      style={{
        position: "fixed",
        left: `${CRATER.x * 100}%`,
        top: `calc(${CRATER.y * 100}% + 3.4em)`,
        width: 0,
        height: 0,
        zIndex: 6,
        font: "inherit",
        // Scales with the viewport so it stays proportional to the crater.
        fontSize: isMobile ? 8 : 12.5,
        lineHeight: LINE,
        whiteSpace: "pre",
        textShadow: OUTLINE,
      }}
    >
      <button
        type="button"
        aria-label={ready ? `${stage.label} — launch it` : stage.label}
        title={ready ? "ready" : "something crashed here"}
        onClick={click}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        disabled={progress.launching}
        style={{
          position: "absolute",
          left: `${left}ch`,
          bottom: 0,
          width: `${right - left}ch`,
          height: `${top * LINE}em`,
          padding: 0,
          background: "none",
          border: 0,
          font: "inherit",
          color: "inherit",
          cursor: progress.launching ? "default" : "pointer",
          transition: "transform 160ms ease-out, filter 160ms ease-out",
          transform: hover && !progress.launching ? "translateY(-3px)" : "none",
          filter: hover && !progress.launching ? "drop-shadow(0 0 6px var(--accent))" : "none",
        }}
      >
        {still.map((l) => (
          <Piece key={l.id} layer={l} from={left} />
        ))}
        {rocket && (
          <div ref={rocketRef} style={{ position: "absolute", left: 0, bottom: 0 }}>
            <Piece layer={rocket} from={left} />
            <pre
              ref={exhaustRef}
              aria-hidden="true"
              style={{
                ...pieceStyle,
                left: `${-width(EXHAUST[0]) / 2 - left}ch`,
                bottom: `${(rocket.bottom - EXHAUST[0].length) * LINE}em`,
                color: "#ffb347",
                visibility: "hidden",
              }}
            />
          </div>
        )}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${-left}ch`,
            bottom: `${(top + 1) * LINE}em`,
            transform: `translateX(-50%) ${hover ? "" : "translateY(-2px)"}`,
            fontSize: isMobile ? 9 : 11,
            padding: "1px 6px",
            borderRadius: 2,
            background: "var(--icon-label-bg)",
            color: "#fff",
            textShadow: "none",
            opacity: hover && !progress.launching ? 1 : 0,
            transition: "opacity 160ms ease-out, transform 160ms ease-out",
            whiteSpace: "nowrap",
          }}
        >
          {ready ? "launch" : stage.id === "wreck" ? "investigate" : "starmap"}
        </span>
      </button>

      <div
        ref={countRef}
        aria-live="polite"
        style={{
          position: "absolute",
          left: 0,
          bottom: `${(top + 3) * LINE}em`,
          transform: "translateX(-50%)",
          fontSize: "2em",
          color: "#fff",
          pointerEvents: "none",
        }}
      />

      <div aria-hidden="true" style={{ position: "absolute", left: 0, bottom: 0, pointerEvents: "none" }}>
        {Array.from({ length: crewCount }, (_, i) => (
          <pre
            key={i}
            ref={(el) => {
              crewRefs.current[i] = el
            }}
            style={{ ...pieceStyle, color: CREW_COLORS[i % CREW_COLORS.length], visibility: "hidden" }}
          />
        ))}
      </div>
    </div>
  )
}

const pieceStyle: React.CSSProperties = {
  position: "absolute",
  margin: 0,
  font: "inherit",
  lineHeight: "inherit",
  whiteSpace: "pre",
}

/** A piece of the site, placed from the left edge of the art, `from`. */
function Piece({ layer, from }: { layer: Layer; from: number }) {
  return (
    <pre
      aria-hidden="true"
      style={{
        ...pieceStyle,
        left: `${layer.x - from}ch`,
        bottom: `${layer.bottom * LINE}em`,
        color: layer.color,
      }}
    >
      {layer.art.join("\n")}
    </pre>
  )
}
