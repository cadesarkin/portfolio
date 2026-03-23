"use client"

import { useState } from "react"

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-40">
      <div className="flex items-center justify-between px-6 py-5">
        <a
          href="#"
          className="font-bold text-[#0d0d0d] text-sm hover:opacity-50 transition-opacity"
        >
          cade sarkin
        </a>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-8">
          <a href="#work" className="text-[#0d0d0d] text-sm hover:text-[#2563eb] transition-colors">
            work
          </a>
          <a href="#projects" className="text-[#0d0d0d] text-sm hover:text-[#2563eb] transition-colors">
            projects
          </a>
          <a href="#contact" className="text-[#0d0d0d] text-sm hover:text-[#2563eb] transition-colors">
            contact
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden flex flex-col gap-1.5 p-1"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          <span className="block w-5 h-px bg-[#0d0d0d]" />
          <span className="block w-5 h-px bg-[#0d0d0d]" />
          <span className="block w-5 h-px bg-[#0d0d0d]" />
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="sm:hidden bg-[#eaeff5] border-b border-[#c8d4e0] px-6 pb-5 flex flex-col gap-4"
          onClick={() => setMenuOpen(false)}
        >
          <a href="#work" className="text-[#0d0d0d] text-sm hover:text-[#2563eb] transition-colors">
            work
          </a>
          <a href="#projects" className="text-[#0d0d0d] text-sm hover:text-[#2563eb] transition-colors">
            projects
          </a>
          <a href="#contact" className="text-[#0d0d0d] text-sm hover:text-[#2563eb] transition-colors">
            contact
          </a>
        </div>
      )}
    </nav>
  )
}
