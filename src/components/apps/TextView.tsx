"use client"

import type { VFile } from "@/lib/vfs-types"

const URL_RE = /(https?:\/\/[^\s<>"')]+)/g

/**
 * Renders a text file, linkifying bare URLs.
 *
 * No markdown parser: the file bodies in the VFS are written to read well as
 * plain text, and a renderer would only add a dependency and a second style
 * language to keep consistent with the rest of the chrome.
 */
function linkify(line: string, key: number) {
  const parts = line.split(URL_RE)
  return (
    <div key={key}>
      {parts.map((part, i) =>
        URL_RE.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
      {line === "" ? " " : null}
    </div>
  )
}

export default function TextView({ file }: { file: VFile }) {
  const lines = file.body.split("\n")
  return (
    <div
      style={{
        padding: "14px 18px",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        maxWidth: "78ch",
        fontSize: 12.5,
        lineHeight: 1.65,
      }}
    >
      {lines.map((line, i) => linkify(line, i))}
    </div>
  )
}
