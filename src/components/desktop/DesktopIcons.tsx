"use client"

import { useRef } from "react"
import { root } from "@/lib/vfs"
import { bigGlyphFor } from "@/components/apps/glyphs"
import { useWindows } from "./window-manager"
import type { VNode } from "@/lib/vfs-types"

interface Props {
  isMobile: boolean
  revealed: boolean
}

export default function DesktopIcons({ isMobile, revealed }: Props) {
  const { open } = useWindows()
  const listRef = useRef<HTMLDivElement>(null)
  const items = root.children

  const activate = (node: VNode) => {
    if (node.kind === "link") {
      window.open(node.url, "_blank", "noopener,noreferrer")
      return
    }
    open(node)
  }

  /** Arrow keys walk the icon list; Enter opens. */
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const dir =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0
    if (dir === 0) return
    e.preventDefault()
    const next = (i + dir + items.length) % items.length
    listRef.current
      ?.querySelectorAll<HTMLButtonElement>("button")
      [next]?.focus()
  }

  return (
    <div
      ref={listRef}
      style={{
        position: "fixed",
        top: 16,
        left: 12,
        zIndex: 10,
        display: isMobile ? "grid" : "flex",
        gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : undefined,
        flexDirection: isMobile ? undefined : "column",
        gap: isMobile ? 8 : 2,
        right: isMobile ? 12 : undefined,
      }}
    >
      {items.map((node, i) => (
        <button
          key={node.name}
          type="button"
          id={`icon-${node.name}`}
          className="icon-btn"
          style={{
            width: isMobile ? "100%" : undefined,
            opacity: revealed ? 1 : 0,
            transform: revealed ? "none" : "translateY(6px)",
            transition: `opacity 220ms ease-out ${i * 40}ms, transform 220ms ease-out ${i * 40}ms`,
          }}
          onClick={() => isMobile && activate(node)}
          onDoubleClick={() => !isMobile && activate(node)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              activate(node)
            } else {
              onKeyDown(e, i)
            }
          }}
        >
          <span className="icon-glyph" aria-hidden="true">
            {bigGlyphFor(node)}
          </span>
          <span>{node.label ?? node.name}</span>
        </button>
      ))}
    </div>
  )
}
