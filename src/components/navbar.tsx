"use client"

import { useState, useEffect } from "react"

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [time, setTime] = useState("")

  useEffect(() => {
    const update = () => {
      const now = new Date()
      const h = now.getHours().toString().padStart(2, "0")
      const m = now.getMinutes().toString().padStart(2, "0")
      const s = now.getSeconds().toString().padStart(2, "0")
      setTime(`${h}:${m}:${s}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <nav className="fixed top-0 left-0 right-0 z-40">
      <div className="grid grid-cols-3 items-center px-6 py-5">
        {/* Left: clock */}
        <div className="text-xs text-[#0d0d0d] font-light tabular-nums">
          {time}
        </div>

        {/* Center: name */}
        <div className="text-center">
          <a
            href="#"
            className="font-bold text-[#0d0d0d] text-sm hover:opacity-50 transition-opacity"
          >
            cade sarkin
          </a>
        </div>

        {/* Right: desktop links or mobile hamburger */}
        <div className="flex items-center justify-end gap-8">
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
