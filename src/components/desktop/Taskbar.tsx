"use client"

import { useEffect, useState } from "react"
import { useWindows } from "./window-manager"
import { useTheme } from "./theme-context"

function Clock() {
  const [now, setNow] = useState<string>("")

  useEffect(() => {
    // Rendered empty on the server: a server-rendered time would mismatch the
    // client's on hydration.
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="clock" suppressHydrationWarning>
      {now}
    </span>
  )
}

export default function Taskbar() {
  const { wins, focused, focus, minimize, minimizeAll } = useWindows()
  const { theme, toggle } = useTheme()

  return (
    <div className="taskbar">
      <button type="button" onClick={minimizeAll} title="Show desktop">
        ~
      </button>
      {wins.map((w) => (
        <button
          key={w.id}
          type="button"
          data-active={focused === w.id ? "" : undefined}
          onClick={() => (focused === w.id ? minimize(w.id) : focus(w.id))}
        >
          {w.title}
        </button>
      ))}
      <button
        type="button"
        onClick={toggle}
        // Keeps keyboard focus in whatever window the user was using. Without
        // this, clicking the toggle moves focus to the button, and the next
        // thing typed goes to it — a space then re-triggers the toggle.
        onMouseDown={(e) => e.preventDefault()}
        className="theme-toggle"
        title={theme === "day" ? "Switch to night" : "Switch to day"}
        aria-label={theme === "day" ? "Switch to night" : "Switch to day"}
      >
        {theme === "day" ? "day" : "night"}
      </button>
      <Clock />
    </div>
  )
}
