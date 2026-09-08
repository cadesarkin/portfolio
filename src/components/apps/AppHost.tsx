"use client"

import FolderView from "./FolderView"
import TextView from "./TextView"
import ContactView from "./ContactView"
import ResumeView from "./ResumeView"
import type { VNode } from "@/lib/vfs-types"

interface Props {
  node: VNode
  winId: string
  isMobile: boolean
}

/** Shown for apps that later phases implement, so no folder is a dead end. */
function PlaceholderView({ node }: { node: VNode }) {
  return (
    <div style={{ padding: "18px 20px", maxWidth: "60ch" }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}>{node.label ?? node.name}</div>
      {node.desc && (
        <div style={{ color: "var(--ink-muted)", fontSize: 12.5 }}>
          {node.desc}
        </div>
      )}
      <div
        style={{
          marginTop: 14,
          padding: "8px 10px",
          border: "1px dashed var(--win-rule)",
          color: "var(--ink-faint)",
          fontSize: 12,
        }}
      >
        not yet installed — arriving in a later build
      </div>
    </div>
  )
}

export default function AppHost({ node, winId, isMobile }: Props) {
  switch (node.kind) {
    case "dir":
      return <FolderView dir={node} winId={winId} isMobile={isMobile} />
    case "file":
      return <TextView file={node} />
    case "app":
      switch (node.app) {
        case "contact":
          return <ContactView />
        case "resume":
          return <ResumeView />
        default:
          return <PlaceholderView node={node} />
      }
    case "link":
      // Links navigate rather than open; this is unreachable in practice.
      return null
  }
}
