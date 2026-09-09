"use client"

import { useState } from "react"
import { CONTACT } from "@/lib/vfs"

export default function ContactView() {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1400)
    } catch {
      // Clipboard is unavailable over plain http and in some browsers. The
      // value is selectable either way, so this needs no error surface.
    }
  }

  return (
    <div style={{ padding: "14px 18px" }}>
      {CONTACT.map(({ label, value, href }) => (
        <div
          key={label}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            padding: "5px 0",
          }}
        >
          <span
            style={{
              flex: "0 0 76px",
              color: "var(--ink-faint)",
              fontSize: 12,
            }}
          >
            {label}
          </span>
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            style={{ flex: "1 1 auto" }}
          >
            {value}
          </a>
          <button
            type="button"
            onClick={() => copy(label, value)}
            style={{
              font: "inherit",
              fontSize: 11,
              padding: "2px 6px",
              color: "var(--ink-faint)",
              background: "none",
              border: "1px solid var(--win-rule)",
              cursor: "pointer",
            }}
          >
            {copied === label ? "copied" : "copy"}
          </button>
        </div>
      ))}
    </div>
  )
}
