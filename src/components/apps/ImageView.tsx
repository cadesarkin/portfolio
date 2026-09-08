"use client"

import { useState } from "react"
import NextImage from "next/image"
import { useWindows } from "@/components/desktop/window-manager"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
import { resolve, pathOf } from "@/lib/vfs-utils"
import { isDir, isImage, type VImage } from "@/lib/vfs-types"

/**
 * Screenshot viewer.
 *
 * Arrow keys page through the other images in the same folder, so a client's
 * shots browse as a set rather than needing a window each.
 */
export default function ImageView({
  node,
  winId,
}: {
  node: VImage
  winId: string
}) {
  const { open } = useWindows()
  const [broken, setBroken] = useState(false)

  // Siblings, so the viewer knows what "next" means.
  const parentPath = pathOf(node).split("/").slice(0, -1).join("/") || "/"
  const parent = resolve(parentPath, "/")
  const siblings =
    parent && isDir(parent) ? parent.children.filter(isImage) : [node]
  const index = siblings.findIndex((s) => s.name === node.name)

  const step = (delta: number) => {
    if (siblings.length < 2) return
    const next = siblings[(index + delta + siblings.length) % siblings.length]
    if (next) open(next)
  }

  useWindowKeys(winId, (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault()
      step(1)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      step(-1)
    }
  })

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 14,
          background: "var(--cell-shown)",
        }}
      >
        {broken ? (
          <span style={{ color: "var(--ink-faint)", fontSize: 13 }}>
            {node.src} could not be loaded
          </span>
        ) : (
          <NextImage
            src={node.src}
            alt={node.caption}
            width={1600}
            height={1000}
            onError={() => setBroken(true)}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              border: "1px solid var(--win-rule)",
            }}
          />
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "9px 14px",
          borderTop: "1px solid var(--win-rule)",
          fontSize: 13,
        }}
      >
        <span style={{ color: "var(--ink-muted)", flex: "1 1 auto" }}>
          {node.caption}
        </span>
        {siblings.length > 1 && (
          <>
            <span
              style={{
                color: "var(--ink-faint)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {index + 1} / {siblings.length}
            </span>
            <button type="button" className="seg" onClick={() => step(-1)}>
              prev
            </button>
            <button type="button" className="seg" onClick={() => step(1)}>
              next
            </button>
          </>
        )}
      </div>
    </div>
  )
}
