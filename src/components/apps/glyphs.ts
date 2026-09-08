import type { IconKey, VNode } from "@/lib/vfs-types"

/**
 * Box-drawing and symbol glyphs standing in for icons.
 *
 * Deliberately text rather than images: the whole interface is monospace, and
 * a glyph lines up on the character grid where a raster icon would not.
 */
export const GLYPHS: Record<IconKey, string> = {
  folder: "▸",
  file: "≡",
  terminal: "▮",
  resume: "▤",
  contact: "✉",
  game: "◈",
  link: "↗",
}

/**
 * Larger variants for the desktop icon grid.
 *
 * Solid geometric shapes rather than the outline document glyphs (🗀, 🗎):
 * those render as hairlines at this size and disappear against a bright sky.
 * Folders all share one shape, as they do on any real desktop — the label is
 * what distinguishes them.
 */
export const BIG_GLYPHS: Record<IconKey, string> = {
  folder: "▣",
  file: "▤",
  terminal: "▮",
  resume: "▤",
  contact: "✉",
  game: "◈",
  link: "↗",
}

function iconKey(node: VNode): IconKey {
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
  }
}

export const glyphFor = (node: VNode) => GLYPHS[iconKey(node)]
export const bigGlyphFor = (node: VNode) => BIG_GLYPHS[iconKey(node)]
