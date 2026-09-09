import type { IconKey, VNode } from "@/lib/vfs-types"

/**
 * Pixel-art icons on a 16x16 grid.
 *
 * `shapeRendering="crispEdges"` keeps the edges hard at any size, so they sit
 * on the same visual grid as the ASCII wallpaper instead of looking like
 * smooth vector art dropped on top of it.
 *
 * Colours are literal rather than `currentColor`: a folder reads as a folder
 * because it is manila, and these hues were picked to hold up against both the
 * bright sky and the night one. Only the outline shifts with the theme.
 */

const OUTLINE = "var(--icon-outline)"

function Folder() {
  return (
    <>
      <path d="M1 4h5l1.5 1.5H15V14H1z" fill="#e0a94a" />
      <path d="M1 4h5l1.5 1.5H15v1.5H1z" fill="#f0c268" />
      <path d="M2 8h12v5H2z" fill="#eab657" />
      <path
        d="M1 4h5l1.5 1.5H15V14H1z"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1"
      />
    </>
  )
}

function Terminal() {
  return (
    <>
      <rect x="1" y="2" width="14" height="12" fill="#16212e" />
      <rect x="1" y="2" width="14" height="2" fill="#2b3d52" />
      <path d="M3 7l2 2-2 2" fill="none" stroke="#6ee08a" strokeWidth="1.4" />
      <path d="M8 11h5" stroke="#6ee08a" strokeWidth="1.4" />
      <rect
        x="1"
        y="2"
        width="14"
        height="12"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1"
      />
    </>
  )
}

function Mail() {
  return (
    <>
      <rect x="1" y="3" width="14" height="10" fill="#f2f5f8" />
      <path d="M1 3l7 5.5L15 3" fill="none" stroke="#7d93a8" strokeWidth="1.3" />
      <rect
        x="1"
        y="3"
        width="14"
        height="10"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1"
      />
    </>
  )
}

function Doc() {
  return (
    <>
      <path d="M3 1h7l3 3v11H3z" fill="#f7f9fb" />
      <path d="M10 1v3h3" fill="#cfd9e2" />
      <path d="M5 7h6M5 9.5h6M5 12h4" stroke="#8ba0b3" strokeWidth="1.1" />
      <path
        d="M3 1h7l3 3v11H3z"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1"
      />
    </>
  )
}

function Game() {
  return (
    <>
      <rect x="1" y="4" width="14" height="8" fill="#5b6bd6" />
      <rect x="3" y="6" width="1.6" height="4" fill="#eef2ff" />
      <rect x="2.2" y="7.2" width="3.2" height="1.6" fill="#eef2ff" />
      <circle cx="11" cy="7.4" r="1.1" fill="#ff7a6b" />
      <circle cx="12.8" cy="9.4" r="1.1" fill="#ffd166" />
      <rect
        x="1"
        y="4"
        width="14"
        height="8"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1"
      />
    </>
  )
}

function Image() {
  return (
    <>
      <rect x="1" y="3" width="14" height="10" fill="#dff0fb" />
      <circle cx="5" cy="6.4" r="1.5" fill="#ffd166" />
      <path d="M2 12l4-4 3 2.5L11.5 8 14 12z" fill="#5ea36a" />
      <rect
        x="1"
        y="3"
        width="14"
        height="10"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1"
      />
    </>
  )
}

function Settings() {
  return (
    <>
      <rect x="1" y="2" width="14" height="10" fill="#d7e2ec" />
      <rect x="2.5" y="3.5" width="11" height="7" fill="#2e7fd4" />
      <rect x="6" y="12" width="4" height="2" fill="#b6c5d3" />
      <rect x="4" y="14" width="8" height="1.4" fill="#9db0c1" />
      <rect
        x="1"
        y="2"
        width="14"
        height="10"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1"
      />
    </>
  )
}

function Link() {
  return (
    <>
      <circle cx="8" cy="8" r="6.4" fill="#8fd0f5" />
      <path
        d="M8 1.6c2 2 2 10.8 0 12.8M8 1.6c-2 2-2 10.8 0 12.8M1.9 6h12.2M1.9 10h12.2"
        fill="none"
        stroke="#2a6b96"
        strokeWidth="0.9"
      />
      <circle
        cx="8"
        cy="8"
        r="6.4"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1"
      />
    </>
  )
}

function Paint() {
  return (
    <>
      <rect x="1" y="2" width="14" height="11" fill="#fbfdff" />
      <rect x="2.5" y="3.5" width="5" height="4" fill="#e05c4a" />
      <rect x="8" y="3.5" width="5" height="4" fill="#3f8fd0" />
      <rect x="2.5" y="8.2" width="5" height="3.4" fill="#f0c268" />
      <rect x="8" y="8.2" width="5" height="3.4" fill="#5ea36a" />
      <rect
        x="1"
        y="2"
        width="14"
        height="11"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1"
      />
    </>
  )
}

function Music() {
  return (
    <>
      <rect x="1" y="2" width="14" height="12" fill="#2b2f52" />
      <rect x="2.5" y="3.5" width="11" height="4" fill="#8fd0f5" />
      <rect x="3.5" y="9" width="1.6" height="3.4" fill="#6ee08a" />
      <rect x="6" y="10.4" width="1.6" height="2" fill="#6ee08a" />
      <rect x="8.5" y="8.2" width="1.6" height="4.2" fill="#6ee08a" />
      <rect x="11" y="9.8" width="1.6" height="2.6" fill="#6ee08a" />
      <rect
        x="1"
        y="2"
        width="14"
        height="12"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1"
      />
    </>
  )
}

function Trophy() {
  return (
    <>
      <path d="M4 2h8v5a4 4 0 0 1-8 0z" fill="#f0c268" />
      <path d="M4 3H2v2a3 3 0 0 0 3 3M12 3h2v2a3 3 0 0 1-3 3" fill="none" stroke="#d9a13f" strokeWidth="1.2" />
      <rect x="7" y="10.6" width="2" height="2.4" fill="#d9a13f" />
      <rect x="4.5" y="13" width="7" height="1.8" fill="#e0a94a" />
      <path
        d="M4 2h8v5a4 4 0 0 1-8 0z"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1"
      />
    </>
  )
}

function StarmapIcon() {
  return (
    <>
      <rect x="1" y="2" width="14" height="12" fill="#0b1226" />
      <circle cx="4.5" cy="5" r="0.8" fill="#dbe9f5" />
      <circle cx="11" cy="4" r="0.8" fill="#dbe9f5" />
      <circle cx="8" cy="9.5" r="0.8" fill="#dbe9f5" />
      <circle cx="12.5" cy="11" r="0.8" fill="#dbe9f5" />
      <path d="M4.5 5L11 4M11 4L8 9.5M8 9.5L12.5 11" stroke="#5b8fd6" strokeWidth="0.7" fill="none" />
      <path d="M6 12l1.6-2.4L9.2 12z" fill="#ffd166" />
      <rect
        x="1"
        y="2"
        width="14"
        height="12"
        fill="none"
        stroke={OUTLINE}
        strokeWidth="1"
      />
    </>
  )
}

const SHAPES: Record<IconKey, () => React.JSX.Element> = {
  folder: Folder,
  file: Doc,
  terminal: Terminal,
  resume: Doc,
  contact: Mail,
  game: Game,
  link: Link,
  image: Image,
  settings: Settings,
  paint: Paint,
  music: Music,
  trophy: Trophy,
  starmap: StarmapIcon,
}

export function Icon({ name, size = 16 }: { name: IconKey; size?: number }) {
  const Shape = SHAPES[name] ?? Doc
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: "block", flex: "0 0 auto" }}
    >
      <Shape />
    </svg>
  )
}

export function iconKeyFor(node: VNode): IconKey {
  if (node.icon) return node.icon
  switch (node.kind) {
    case "dir":
      return "folder"
    case "file":
      return "file"
    case "link":
      return "link"
    case "app":
      return "terminal"
    case "image":
      return "image"
  }
}

export function NodeIcon({ node, size }: { node: VNode; size?: number }) {
  return <Icon name={iconKeyFor(node)} size={size} />
}
