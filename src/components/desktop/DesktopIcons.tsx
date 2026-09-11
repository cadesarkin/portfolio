"use client"

import { useRef } from "react"
import { root } from "@/lib/vfs"
import { NodeIcon } from "@/components/apps/Icon"
import { useWindows } from "./window-manager"
import type { VNode } from "@/lib/vfs-types"

interface Props {
  isMobile: boolean
  revealed: boolean
}

export default function DesktopIcons({ isMobile, revealed }: Props) {
  // Hidden nodes stay in the filesystem for the terminal but keep off the
  // desktop — the crash site is found on the plains, not in a list.
  const items = root.children.filter((n) => !n.hidden)

  // On a phone everything shares one grid; there is no right-hand side to
  // speak of.
  if (isMobile) return <IconList items={items} isMobile revealed={revealed} />

  return (
    <>
      <IconList items={items.filter((n) => n.side !== "right")} isMobile={false} revealed={revealed} />
      <IconList
        items={items.filter((n) => n.side === "right")}
        isMobile={false}
        revealed={revealed}
        right
      />
    </>
  )
}

function IconList({
  items,
  isMobile,
  revealed,
  right = false,
}: {
  items: VNode[]
  isMobile: boolean
  revealed: boolean
  right?: boolean
}) {
  const { open } = useWindows()
  const listRef = useRef<HTMLDivElement>(null)

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

  if (items.length === 0) return null

  return (
    <div
      ref={listRef}
      style={{
        position: "fixed",
        top: 16,
        left: right ? undefined : 12,
        right: isMobile || right ? 12 : undefined,
        zIndex: 10,
        display: isMobile ? "grid" : "flex",
        gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : undefined,
        flexDirection: isMobile ? undefined : "column",
        gap: isMobile ? 8 : 2,
        // Flow into a second column once the first runs out of height, the way
        // a real desktop does, rather than running off under the taskbar.
        flexWrap: isMobile ? undefined : "wrap",
        alignContent: isMobile ? undefined : right ? "flex-end" : "flex-start",
        maxHeight: isMobile
          ? undefined
          : "calc(100vh - var(--taskbar-h) - 32px)",
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
            <NodeIcon node={node} size={44} />
          </span>
          <span>{node.label ?? node.name}</span>
        </button>
      ))}
    </div>
  )
}
