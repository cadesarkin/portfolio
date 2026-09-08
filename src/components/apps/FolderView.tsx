"use client"

import { useState } from "react"
import { useWindows } from "@/components/desktop/window-manager"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
import { NodeIcon } from "./Icon"
import type { VDir, VNode } from "@/lib/vfs-types"

interface Props {
  dir: VDir
  winId: string
  isMobile: boolean
}

export default function FolderView({ dir, winId, isMobile }: Props) {
  const { open } = useWindows()
  const [selected, setSelected] = useState(0)
  const items = dir.children

  const activate = (node: VNode) => {
    if (node.kind === "link") {
      window.open(node.url, "_blank", "noopener,noreferrer")
      return
    }
    open(node)
  }

  useWindowKeys(winId, (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelected((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelected((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const node = items[selected]
      if (node) activate(node)
    }
  })

  return (
    <>
      <div className="view-pad">
        {items.map((node, i) => (
          <button
            key={node.name}
            type="button"
            className="row"
            data-selected={i === selected ? "" : undefined}
            onClick={() => {
              setSelected(i)
              // A tap should open directly; a mouse click only selects.
              if (isMobile) activate(node)
            }}
            onDoubleClick={() => activate(node)}
          >
            <NodeIcon node={node} size={18} />
            <span className="row-name">
              {node.label ?? node.name}
              {node.kind === "dir" ? "/" : ""}
              {node.kind === "link" ? " ↗" : ""}
            </span>
            {node.desc && <span className="row-desc">{node.desc}</span>}
            {node.tag && <span className="row-tag">{node.tag}</span>}
          </button>
        ))}
      </div>
      <div className="view-foot">
        {items.length} item{items.length === 1 ? "" : "s"}
        {!isMobile && " · double-click to open"}
      </div>
    </>
  )
}
