"use client"

import FolderView from "./FolderView"
import TextView from "./TextView"
import ContactView from "./ContactView"
import ResumeView from "./ResumeView"
import Terminal from "./Terminal"
import Minesweeper from "./games/Minesweeper"
import Snake from "./games/Snake"
import CubeRunner from "./games/CubeRunner"
import Pong from "./games/Pong"
import Solitaire from "./games/Solitaire"
import DisplayProperties from "./DisplayProperties"
import ImageView from "./ImageView"
import AsciiPaint from "./AsciiPaint"
import Chiptune from "./Chiptune"
import type { VNode } from "@/lib/vfs-types"

interface Props {
  node: VNode
  winId: string
  isMobile: boolean
  onReboot: () => void
}

export default function AppHost({ node, winId, isMobile, onReboot }: Props) {
  switch (node.kind) {
    case "dir":
      return <FolderView dir={node} winId={winId} isMobile={isMobile} />
    case "file":
      return <TextView file={node} />
    case "image":
      return <ImageView node={node} winId={winId} />
    case "app":
      switch (node.app) {
        case "contact":
          return <ContactView />
        case "resume":
          return <ResumeView />
        case "terminal":
          return (
            <Terminal winId={winId} isMobile={isMobile} onReboot={onReboot} />
          )
        case "minesweeper":
          return <Minesweeper isMobile={isMobile} />
        case "snake":
          return <Snake winId={winId} isMobile={isMobile} />
        case "cube-runner":
          return <CubeRunner winId={winId} isMobile={isMobile} />
        case "pong":
          return <Pong winId={winId} isMobile={isMobile} />
        case "solitaire":
          return <Solitaire winId={winId} isMobile={isMobile} />
        case "display":
          return <DisplayProperties />
        case "paint":
          return <AsciiPaint winId={winId} isMobile={isMobile} />
        case "music":
          return <Chiptune winId={winId} isMobile={isMobile} />
      }
    case "link":
      // Links navigate rather than open; this is unreachable in practice.
      return null
  }
}
