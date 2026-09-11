"use client"

import FolderView from "./FolderView"
import TextView from "./TextView"
import ContactView from "./ContactView"
import ResumeView from "./ResumeView"
import Terminal from "./Terminal"
import Minesweeper from "./games/Minesweeper"
import Snake from "./games/Snake"
import Pong from "./games/Pong"
import Solitaire from "./games/Solitaire"
import DisplayProperties from "./DisplayProperties"
import ImageView from "./ImageView"
import AsciiPaint from "./AsciiPaint"
import Chiptune from "./Chiptune"
import Leaderboard from "./Leaderboard"
import Starmap from "./Starmap"
import Defrag from "./defrag/Defrag"
import RoomView from "./defrag/RoomView"
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
        case "leaderboard":
          return <Leaderboard />
        case "starmap":
          return <Starmap winId={winId} isMobile={isMobile} />
        case "defrag":
          return <Defrag winId={winId} isMobile={isMobile} />
        case "fragment":
          return <RoomView winId={winId} />
      }
    case "link":
      // Links navigate rather than open; this is unreachable in practice.
      return null
  }
}
