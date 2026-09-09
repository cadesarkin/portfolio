"use client"

import { useState } from "react"
import { CRATER } from "./BlissCanvas"
import { resolve } from "@/lib/vfs-utils"
import { useWindows } from "./window-manager"

/**
 * Wreckage in the impact crater, on the plains at the right of the wallpaper.
 *
 * Deliberately not a desktop icon. It belongs to the world the wallpaper
 * depicts rather than to the desktop chrome — which is what keeps the space
 * material from reading as a second, unrelated metaphor pasted on top of the
 * first. You find it in the field; you do not launch it from a list.
 *
 * Positioned from the same CRATER constant the terrain shader uses, so the two
 * cannot drift apart when the window resizes.
 */
const POD = [
  "   _____   ",
  "  /_|_|_\\  ",
  " |  o o  | ",
  " |_______| ",
  "  \\_/ \\_/  ",
]

export default function CrashSite({ isMobile }: { isMobile: boolean }) {
  const { open } = useWindows()
  const [hover, setHover] = useState(false)

  const launch = () => {
    const node = resolve("/starmap", "/")
    if (node) open(node)
  }

  return (
    <button
      type="button"
      aria-label="Wreckage in the crater — open the starmap"
      title="something crashed here"
      onClick={launch}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        position: "fixed",
        left: `${CRATER.x * 100}%`,
        top: `${CRATER.y * 100}%`,
        transform: "translate(-50%, -60%)",
        zIndex: 6,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: 8,
        background: "none",
        border: "1px solid transparent",
        cursor: "pointer",
        font: "inherit",
        // Scales with the viewport so it stays proportional to the crater.
        fontSize: isMobile ? 7 : 11,
        lineHeight: 1.05,
        // The crater floor is busy rubble, so the pod carries its own dark
        // plate — a text shadow alone left it lost in the texture.
        color: "#ffd98a",
        whiteSpace: "pre",
        textShadow: "0 1px 2px rgba(0,0,0,0.9)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          padding: "4px 6px",
          borderRadius: 3,
          background: "rgba(10, 18, 30, 0.55)",
          transition: "transform 160ms ease-out, filter 160ms ease-out",
          transform: hover ? "translateY(-3px) scale(1.06)" : "none",
          filter: hover
            ? "drop-shadow(0 0 6px var(--accent))"
            : "none",
        }}
      >
        {POD.join("\n")}
      </span>
      <span
        aria-hidden="true"
        style={{
          fontSize: isMobile ? 9 : 11,
          padding: "1px 6px",
          borderRadius: 2,
          background: "var(--icon-label-bg)",
          color: "#fff",
          opacity: hover ? 1 : 0,
          transform: hover ? "none" : "translateY(-2px)",
          transition: "opacity 160ms ease-out, transform 160ms ease-out",
          whiteSpace: "nowrap",
        }}
      >
        investigate
      </span>
    </button>
  )
}
