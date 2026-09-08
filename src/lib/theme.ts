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
    skyTop: string
    skyBottom: string
    groundTop: string
    groundBottom: string
    gridLine: string
    trackEdge: string
    cubeFace: string
    cubeTop: string
    cubeEdge: string
    player: string
    playerDead: string
    court: string
    courtLine: string
    ball: string
  }
> = {
  day: {
    skyTop: "#266cc4",
    skyBottom: "#9ad0f0",
    groundTop: "#a9cf72",
    groundBottom: "#4a9b2f",
    gridLine: "rgba(12,40,20,0.30)",
    trackEdge: "rgba(250,252,255,0.85)",
    cubeFace: "#2f6d43",
    cubeTop: "#4f9a5f",
    cubeEdge: "#0d2b18",
    player: "#1d6fd0",
    playerDead: "#c0392b",
    court: "rgba(244,249,253,0.92)",
    courtLine: "rgba(20,40,60,0.22)",
    ball: "#0d1b26",
  },
  night: {
    skyTop: "#050b1c",
    skyBottom: "#1d3557",
    groundTop: "#1c3a26",
    groundBottom: "#0a1a11",
    gridLine: "rgba(140,190,160,0.22)",
    trackEdge: "rgba(180,215,240,0.55)",
    cubeFace: "#1d4a2c",
    cubeTop: "#2f6d43",
    cubeEdge: "#8fc2a0",
    player: "#6ab7ff",
    playerDead: "#ff6b5b",
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
