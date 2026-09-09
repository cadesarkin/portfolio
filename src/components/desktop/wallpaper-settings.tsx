"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

/**
 * Live wallpaper parameters.
 *
 * Held here rather than inside BlissCanvas so `display.properties` can drive
 * the running renderer. The canvas reads these through a ref every frame, so
 * changing one never remounts or restarts the animation.
 */
export interface WallpaperSettings {
  /** Cloud coverage, 0 = clear sky, 1 = overcast. */
  cloud: number
  /** Multiplier on the wind that moves the grass and clouds. */
  wind: number
  /** Character cell size in px. */
  fontSize: number
  /** Frames per second. */
  fps: number
}

export const DEFAULT_SETTINGS: WallpaperSettings = {
  cloud: 0.5,
  wind: 1,
  fontSize: 12,
  fps: 30,
}

interface Api {
  settings: WallpaperSettings
  set: <K extends keyof WallpaperSettings>(
    key: K,
    value: WallpaperSettings[K]
  ) => void
  reset: () => void
}

const Ctx = createContext<Api | null>(null)

export function useWallpaper(): Api {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useWallpaper must be used inside <WallpaperProvider>")
  return ctx
}

export function WallpaperProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<WallpaperSettings>(DEFAULT_SETTINGS)

  const set = useCallback(
    <K extends keyof WallpaperSettings>(key: K, value: WallpaperSettings[K]) =>
      setSettings((s) => ({ ...s, [key]: value })),
    []
  )

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), [])

  const api = useMemo(() => ({ settings, set, reset }), [settings, set, reset])
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
