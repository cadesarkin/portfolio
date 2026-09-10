/**
 * Day and night palettes.
 *
 * The two are the same shape so the wallpaper can interpolate between them
 * rather than cutting. `ink` is the multiplier applied to the scene colour to
 * get the glyph colour: below 1 it darkens (ink on paper, for daylight), above
 * 1 it brightens (light on a dark field, for night).
 */

export type Theme = "day" | "night"
export type RGB = readonly [number, number, number]

export interface WallpaperPalette {
  base: string
  skyTop: RGB
  skyHorizon: RGB
  hillDark: RGB
  hillLight: RGB
  /** Glyph brightness relative to the colour behind it. */
  ink: number
  /** Cloud whiteness target. Clouds are moonlit rather than sunlit at night. */
  cloud: RGB
}

export const WALLPAPER: Record<Theme, WallpaperPalette> = {
  day: {
    base: "#0d2137",
    skyTop: [38, 108, 196],
    skyHorizon: [154, 208, 240],
    hillDark: [74, 155, 47],
    hillLight: [205, 234, 107],
    ink: 0.58,
    cloud: [255, 255, 255],
  },
  night: {
    base: "#04080f",
    skyTop: [8, 16, 38],
    skyHorizon: [34, 62, 104],
    hillDark: [7, 22, 16],
    hillLight: [38, 84, 52],
    // Clouds catch moonlight, not sun — cool, and far dimmer than white. At
    // 1.95 the multiplier clipped pale cells to pure white, which turned the
    // cloud banks into hard blocks instead of haze.
    ink: 1.62,
    cloud: [96, 124, 162],
  },
}

/** Canvas colours for the games, which cannot read CSS custom properties. */
export const GAME_COLORS: Record<
  Theme,
  {
    player: string
    opponent: string
    court: string
    courtLine: string
    ball: string
  }
> = {
  day: {
    player: "#1d6fd0",
    opponent: "#4f9a5f",
    court: "rgba(244,249,253,0.92)",
    courtLine: "rgba(20,40,60,0.22)",
    ball: "#0d1b26",
  },
  night: {
    player: "#6ab7ff",
    opponent: "#2f6d43",
    court: "rgba(12,22,34,0.92)",
    courtLine: "rgba(160,200,230,0.22)",
    ball: "#dbe9f5",
  },
}

export const THEME_KEY = "sarkin.theme"

/** The theme to start on: an explicit choice, else the OS preference. */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === "day" || saved === "night") return saved
  } catch {
    // Storage unavailable; fall through to the media query.
  }
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "night"
  }
  return "day"
}
