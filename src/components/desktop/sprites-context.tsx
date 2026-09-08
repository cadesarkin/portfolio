"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { cropToSprite, MAX_SPRITES, type Sprite } from "@/lib/sprite"
import type { Canvas } from "@/components/apps/paint/engine"

const STORE_KEY = "sarkin.sprites"

interface Api {
  sprites: Sprite[]
  /** Crops a drawing and sets it loose. Returns false if nothing was drawn. */
  release: (canvas: Canvas) => boolean
  recallAll: () => void
  count: number
}

const Ctx = createContext<Api | null>(null)

export function useSprites(): Api {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useSprites must be used inside <SpriteProvider>")
  return ctx
}

export function SpriteProvider({ children }: { children: React.ReactNode }) {
  const [sprites, setSprites] = useState<Sprite[]>([])

  // Released drawings stick around between visits — half the charm is finding
  // one still drifting where you left it.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY)
      if (saved) setSprites(JSON.parse(saved))
    } catch {
      // Corrupt or unavailable storage: start with an empty desktop.
    }
  }, [])

  const persist = useCallback((next: Sprite[]) => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next))
    } catch {
      // Non-fatal; they simply will not survive the reload.
    }
  }, [])

  const release = useCallback(
    (canvas: Canvas) => {
      const bounds = {
        w: typeof window === "undefined" ? 1280 : window.innerWidth,
        h: typeof window === "undefined" ? 800 : window.innerHeight,
      }
      const sprite = cropToSprite(
        canvas,
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        bounds
      )
      if (!sprite) return false

      setSprites((prev) => {
        // Oldest falls off the end rather than letting the desktop fill up.
        const next = [...prev, sprite].slice(-MAX_SPRITES)
        persist(next)
        return next
      })
      return true
    },
    [persist]
  )

  const recallAll = useCallback(() => {
    setSprites([])
    persist([])
  }, [persist])

  const api = useMemo(
    () => ({ sprites, release, recallAll, count: sprites.length }),
    [sprites, release, recallAll]
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
