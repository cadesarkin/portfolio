/**
 * Pure path operations over the virtual filesystem.
 *
 * No DOM access, no React. Everything here is unit-tested — this is the layer
 * the terminal and the folder windows share, so a bug here shows up in both.
 */

import { root } from "./vfs"
import type { VDir, VNode } from "./vfs-types"
import { isDir } from "./vfs-types"

/**
 * Parent lookup, built once by walking the tree.
 *
 * Deliberately kept outside the nodes: storing parent pointers on the nodes
 * themselves would make vfs.ts cyclic and unpleasant to hand-edit, which is
 * the one thing that file needs to stay good at.
 */
const parents = new WeakMap<VNode, VDir>()

function indexTree(dir: VDir) {
  for (const child of dir.children) {
    parents.set(child, dir)
    if (isDir(child)) indexTree(child)
  }
}
indexTree(root)

/** Splits a path into meaningful segments, dropping empties and `.`. */
function segments(path: string): string[] {
  return path.split("/").filter((s) => s !== "" && s !== ".")
}

/**
 * Resolves `path` against `cwd`.
 *
 * Absolute (`/x`) and home-relative (`~`, `~/x`) paths ignore cwd. `..` walks
 * up and clamps at root rather than escaping it. Returns null if any segment
 * is missing, or if the path tries to descend into a non-directory.
 */
export function resolve(path: string, cwd: string): VNode | null {
  const fromRoot = path.startsWith("/") || path === "~" || path.startsWith("~/")
  const base = fromRoot ? [] : segments(cwd)
  const rest = segments(path.replace(/^~/, ""))

  const stack = [...base]
  for (const seg of rest) {
    if (seg === "..") stack.pop()
    else stack.push(seg)
  }

  let node: VNode = root
  for (const seg of stack) {
    if (!isDir(node)) return null
    const next = node.children.find((c) => c.name === seg)
    if (!next) return null
    node = next
  }
  return node
}

export function list(dir: VDir): VNode[] {
  return dir.children
}

/** Absolute path of a node. Inverse of `resolve`. */
export function pathOf(node: VNode): string {
  if (node === root) return "/"
  const parts: string[] = []
  let cur: VNode | undefined = node
  while (cur && cur !== root) {
    parts.unshift(cur.name)
    cur = parents.get(cur)
  }
  return "/" + parts.join("/")
}

/**
 * Candidate names for tab-completion of `partial`.
 *
 * Splits into a directory part and a leaf prefix, so `/work/va` completes
 * against the children of `/work`. Returns bare names, not full paths — the
 * terminal splices them onto the directory part it already has.
 */
export function complete(partial: string, cwd: string): string[] {
  const slash = partial.lastIndexOf("/")
  const dirPart = slash === -1 ? "" : partial.slice(0, slash + 1)
  const prefix = slash === -1 ? partial : partial.slice(slash + 1)

  const dir = resolve(dirPart === "" ? "." : dirPart, cwd)
  if (!dir || !isDir(dir)) return []

  return dir.children
    .filter((c) => c.name.startsWith(prefix))
    .map((c) => c.name)
}

/** Case-insensitive search across every node's name and label. */
export function search(query: string): VNode[] {
  const q = query.toLowerCase()
  const hits: VNode[] = []
  const walk = (dir: VDir) => {
    for (const child of dir.children) {
      const hay = `${child.name} ${child.label ?? ""}`.toLowerCase()
      if (hay.includes(q)) hits.push(child)
      if (isDir(child)) walk(child)
    }
  }
  walk(root)
  return hits
}

/** The longest prefix shared by every candidate. Used for partial completion. */
export function commonPrefix(names: string[]): string {
  if (names.length === 0) return ""
  let prefix = names[0]
  for (const n of names.slice(1)) {
    while (!n.startsWith(prefix)) prefix = prefix.slice(0, -1)
  }
  return prefix
}
