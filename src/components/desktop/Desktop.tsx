"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import BlissCanvas from "./BlissCanvas"
import BootSequence from "./BootSequence"
import DesktopIcons from "./DesktopIcons"
import Taskbar from "./Taskbar"
import Screensaver from "./Screensaver"
import DesktopSprites from "./DesktopSprites"
import CrashSite from "./CrashSite"
import SpaceCanvas from "./SpaceCanvas"
import SpaceShip from "./SpaceShip"
import { SpriteProvider } from "./sprites-context"
import Window from "./Window"
import { WindowProvider, useWindows } from "./window-manager"
import { ThemeProvider, useTheme } from "./theme-context"
import { WallpaperProvider, useWallpaper } from "./wallpaper-settings"
import AppHost from "@/components/apps/AppHost"
import { resolve } from "@/lib/vfs-utils"
import { isRoomWindow } from "@/lib/defrag/levels"
import {
  getProgress,
  getServerProgress,
  subscribeProgress,
  type Scene,
} from "@/lib/defrag/progress"
import { FULL_FIRE, type FireMix } from "@/lib/embers"

/** How long the wallpaper takes to fade from one scene to the other. */
const FADE_MS = 2600

/**
 * Which wallpapers are mounted, and whether space is showing.
 *
 * Space fades in over the plains and out again; the one underneath stays
 * mounted only as long as the fade needs it. A scene already chosen when the
 * page loads is simply there, with no fade.
 */
function useScenes(scene: Scene) {
  const born = useRef(0)
  const [plains, setPlains] = useState(scene === "plains")
  const [space, setSpace] = useState(scene === "space")
  const [spaceShown, setSpaceShown] = useState(scene === "space")

  useEffect(() => {
    if (!born.current) born.current = performance.now()
    const instant = performance.now() - born.current < 800
    if (scene === "space") {
      setSpace(true)
      if (instant) {
        setSpaceShown(true)
        setPlains(false)
        return
      }
      // Mounted invisible first, so the fade has somewhere to start from.
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setSpaceShown(true)))
      const t = setTimeout(() => setPlains(false), FADE_MS)
      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(t)
      }
    }
    setPlains(true)
    setSpaceShown(false)
    if (instant) {
      setSpace(false)
      return
    }
    const t = setTimeout(() => setSpace(false), FADE_MS)
    return () => clearTimeout(t)
  }, [scene])

  return { plains, space, spaceShown }
}

const MOBILE_BREAKPOINT = 768

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
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getServerProgress)
  const scenes = useScenes(progress.scene)
  /** Written by the crash site, read by the wallpaper's fire. */
  const fireMix = useRef<FireMix>(FULL_FIRE)
  const playing = wins.some((w) => isRoomWindow(w.id))

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
      {scenes.plains && (
        <BlissCanvas
          paused={covered || sheeted}
          theme={theme}
          settings={settings}
          fireMix={fireMix}
        />
      )}
      {scenes.space && (
        <SpaceCanvas paused={covered || sheeted} visible={scenes.spaceShown} settings={settings} />
      )}
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
      <DesktopSprites />
      {progress.scene === "plains" && (
        <CrashSite isMobile={isMobile} busy={playing} fire={fireMix} />
      )}
      {progress.scene === "space" && <SpaceShip isMobile={isMobile} />}
      <Taskbar />
      <Screensaver enabled={booted && !playing} />
    </>
  )
}

export default function Desktop() {
  // `null` until we know: rendering the boot overlay and then removing it on
  // mount would flash for returning visitors.
  const [booting, setBooting] = useState<boolean | null>(null)

  useEffect(() => {
    // Plays on every load rather than once per visitor. It is the first
    // impression the site makes, it lasts under three seconds, and any key
    // skips it instantly — a flag meant most people never saw it twice, and
    // the owner never saw it again at all.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    setBooting(!reduced)
  }, [])

  const finishBoot = useCallback(() => setBooting(false), [])

  /** `reboot` in the terminal replays the sequence, flag or no flag. */
  const reboot = useCallback(() => setBooting(true), [])

  return (
    <ThemeProvider>
      <WallpaperProvider>
      <SpriteProvider>
      <WindowProvider>
        <Shell booted={booting === false} onReboot={reboot} />
        {booting && <BootSequence onDone={finishBoot} />}
      </WindowProvider>
      </SpriteProvider>
      </WallpaperProvider>
    </ThemeProvider>
  )
}
