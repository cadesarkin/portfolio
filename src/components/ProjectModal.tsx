"use client"

import { useEffect, useCallback } from "react"
import EmbeddedWebsite from "./EmbeddedWebsite"

interface ProjectModalProps {
  title: string
  description: string
  type: "work" | "project"
  liveUrl?: string
  githubUrl?: string
  onClose: () => void
}

export default function ProjectModal({
  title,
  description,
  type,
  liveUrl,
  githubUrl,
  onClose,
}: ProjectModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
      onClick={onClose}
    >
      <div
        className="w-[90vw] max-w-[860px] max-h-[80vh] overflow-y-auto bg-white border border-[#0d0d0d] flex flex-col"
        style={{ animation: "modalIn 150ms ease forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#0d0d0d] flex-shrink-0">
          <span className="font-bold text-[#0d0d0d] text-sm">{title}</span>
          <button
            onClick={onClose}
            className="text-[#0d0d0d] hover:opacity-40 transition-opacity text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
          <p className="text-[#0d0d0d] text-sm opacity-70">{description}</p>

          {type === "work" && liveUrl && (
            <div className="h-[300px] sm:h-[500px]">
              <EmbeddedWebsite
                url={liveUrl}
                title={title}
                className="w-full h-full"
              />
            </div>
          )}

          {type === "project" && githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2563eb] text-sm hover:underline"
            >
              view on github →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
