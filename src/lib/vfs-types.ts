/**
 * Node types for the virtual filesystem.
 *
 * The VFS is the single source of truth for every piece of content on the
 * site. Desktop icons, folder windows and the terminal all resolve against
 * the same tree, so they cannot drift apart. See docs/superpowers/specs.
 */

export type AppKey =
  | "terminal"
  | "resume"
  | "contact"
  | "display"
  | "cube-runner"
  | "minesweeper"
  | "snake"
  | "pong"
  | "solitaire"

export type IconKey =
  | "folder"
  | "file"
  | "terminal"
  | "resume"
  | "contact"
  | "game"
  | "link"
  | "image"
  | "settings"

export interface VBase {
  /** Path segment, e.g. "vance". Unique among its siblings. */
  name: string
  /** Display name in list views. Defaults to `name`. */
  label?: string
  /** Right-aligned marker in list views, e.g. "[client]". */
  tag?: string
  /** One-line summary shown beside the name. */
  desc?: string
  icon?: IconKey
}

export interface VDir extends VBase {
  kind: "dir"
  children: VNode[]
}

export interface VFile extends VBase {
  kind: "file"
  ext: "txt" | "md"
  body: string
}

/** A screenshot. `src` is a path under /public. */
export interface VImage extends VBase {
  kind: "image"
  src: string
  /** Shown under the image, and used as its alt text. */
  caption: string
}

export interface VApp extends VBase {
  kind: "app"
  app: AppKey
}

export interface VLink extends VBase {
  kind: "link"
  url: string
}

export type VNode = VDir | VFile | VApp | VLink | VImage

export const isDir = (n: VNode): n is VDir => n.kind === "dir"
export const isFile = (n: VNode): n is VFile => n.kind === "file"
export const isApp = (n: VNode): n is VApp => n.kind === "app"
export const isLink = (n: VNode): n is VLink => n.kind === "link"
export const isImage = (n: VNode): n is VImage => n.kind === "image"
