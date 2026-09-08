"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { THEME_KEY, initialTheme, type Theme } from "@/lib/theme"

interface ThemeApi {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeApi | null>(null)

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>")
  return ctx
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Starts on "day" so server and client markup agree; the real preference is
  // read after mount, where localStorage and matchMedia exist.
  const [theme, setThemeState] = useState<Theme>("day")

  useEffect(() => {
    setThemeState(initialTheme())
  }, [])

  // The attribute drives every CSS token, so chrome and canvas stay in step.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem(THEME_KEY, t)
    } catch {
      // Non-fatal; the choice simply will not persist.
    }
  }, [])

  const toggle = useCallback(
    () => setTheme(theme === "day" ? "night" : "day"),
    [theme, setTheme]
  )

  const api = useMemo(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle]
  )

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>
}
