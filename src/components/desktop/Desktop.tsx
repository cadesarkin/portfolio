"use client"

import { useCallback, useEffect, useState } from "react"
import BlissCanvas from "./BlissCanvas"
import BootSequence from "./BootSequence"
import DesktopIcons from "./DesktopIcons"
import Taskbar from "./Taskbar"
import Screensaver from "./Screensaver"
import Window from "./Window"
import { WindowProvider, useWindows } from "./window-manager"
import { ThemeProvider, useTheme } from "./theme-context"
import { WallpaperProvider, useWallpaper } from "./wallpaper-settings"
import AppHost from "@/components/apps/AppHost"
import { resolve } from "@/lib/vfs-utils"

const MOBILE_BREAKPOINT = 768
const BOOT_FLAG = "sarkin.booted"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  return isMobile
}

function Shell({ booted, onReboot }: { booted: boolean; onReboot: () => void }) {
  const { wins, focused, open, close } = useWindows()
  const { theme } = useTheme()
  const { settings } = useWallpaper()
  const isMobile = useIsMobile()

  // Global shortcuts. Everything else routes through focus-scoped delegation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault()
        const terminal = resolve("/terminal", "/")
        if (terminal) open(terminal)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, close, focused])

  // Nothing visible behind a maximized window, so stop drawing the wallpaper.
  const covered =
    !isMobile && wins.some((w) => w.state === "maximized")
  const sheeted = isMobile && wins.some((w) => w.state !== "minimized")

  // On mobile only the topmost window shows: sheets are modal.
  const visible = isMobile
    ? wins
        .filter((w) => w.state !== "minimized")
        .sort((a, b) => b.z - a.z)
        .slice(0, 1)
    : wins

  return (
    <>
      <BlissCanvas
        paused={covered || sheeted}
        theme={theme}
        settings={settings}
      />
      <DesktopIcons isMobile={isMobile} revealed={booted} />
      {sheeted && (
        <div
          className="sheet-scrim"
          aria-hidden="true"
          onClick={() => visible[0] && close(visible[0].id)}
        />
      )}
      {visible.map((w) => (
        <Window key={w.id} win={w} isMobile={isMobile}>
          <AppHost
            node={w.node}
            winId={w.id}
            isMobile={isMobile}
            onReboot={onReboot}
          />
        </Window>
      ))}
      <Taskbar />
      <Screensaver enabled={booted} />
    </>
  )
}

export default function Desktop() {
  // `null` until we know: rendering the boot overlay and then removing it on
  // mount would flash for returning visitors.
  const [booting, setBooting] = useState<boolean | null>(null)

  useEffect(() => {
    let skip = false
    try {
      skip = localStorage.getItem(BOOT_FLAG) === "1"
    } catch {
      // Storage throws in some privacy modes; boot anyway.
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    setBooting(!skip && !reduced)
  }, [])

  const finishBoot = useCallback(() => {
    try {
      localStorage.setItem(BOOT_FLAG, "1")
    } catch {
      // Non-fatal; the sequence simply replays next visit.
    }
    setBooting(false)
  }, [])

  /** `reboot` in the terminal replays the sequence, flag or no flag. */
  const reboot = useCallback(() => setBooting(true), [])

  return (
    <ThemeProvider>
      <WallpaperProvider>
      <WindowProvider>
        <Shell booted={booting === false} onReboot={reboot} />
        {booting && <BootSequence onDone={finishBoot} />}
      </WindowProvider>
      </WallpaperProvider>
    </ThemeProvider>
  )
}
