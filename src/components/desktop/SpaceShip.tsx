"use client"

import { useState } from "react"
import { resolve } from "@/lib/vfs-utils"
import { useWindows } from "./window-manager"
import { EXHAUST, ROCKET, width } from "@/lib/crash-site"

/**
 * The ship the crew rebuilt, out among the planets once it has launched.
 *
 * It takes over from the crash site as the way to the starmap: the wreck is
 * where the starmap was found, and this is where it gets used. It arrives from
 * below and then idles, bobbing, with its engine ticking over.
 */
export default function SpaceShip({ isMobile }: { isMobile: boolean }) {
  const { open } = useWindows()
  const [hover, setHover] = useState(false)

  const launch = () => {
    const node = resolve("/starmap", "/")
    if (node) open(node)
  }

  const w = width(ROCKET)
  return (
    <button
      type="button"
      aria-label="your ship, out in space — open the starmap"
      title="your ship"
      onClick={launch}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="space-ship"
      style={{
        position: "fixed",
        left: "72%",
        top: "44%",
        zIndex: 6,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 8,
        background: "none",
        border: "1px solid transparent",
        cursor: "pointer",
        font: "inherit",
        fontSize: isMobile ? 7 : 11,
        lineHeight: 1.05,
        whiteSpace: "pre",
        color: "#ffd98a",
        textShadow: "0 0 6px rgba(0,0,0,0.9)",
        filter: hover ? "drop-shadow(0 0 6px var(--accent))" : "none",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: isMobile ? 9 : 11,
          padding: "1px 6px",
          marginBottom: 6,
          borderRadius: 2,
          background: "var(--icon-label-bg)",
          color: "#fff",
          textShadow: "none",
          opacity: hover ? 1 : 0,
          transition: "opacity 160ms ease-out",
        }}
      >
        starmap
      </span>
      <span aria-hidden="true" style={{ width: `${w}ch`, textAlign: "left" }}>
        {ROCKET.join("\n")}
      </span>
      <span
        aria-hidden="true"
        className="space-ship-flame"
        style={{ width: `${w}ch`, textAlign: "left", color: "#ffb347" }}
      >
        {EXHAUST[0]
          .slice(0, 2)
          .map((l) => l.padStart(l.length + Math.floor((w - width(EXHAUST[0])) / 2)))
          .join("\n")}
      </span>
    </button>
  )
}
