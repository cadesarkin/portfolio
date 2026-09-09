/**
 * Palette for the ASCII Bliss wallpaper and the desktop chrome that sits on it.
 *
 * The wallpaper is rendered per-character on a canvas, so the sky and hill are
 * RGB triples the shader lerps between rather than CSS strings.
 */

export type RGB = [number, number, number]

export const PALETTE = {
  /** Deep base behind everything. Also the <html> background, to avoid a flash. */
  base: "#0d2137",

  /**
   * Sky gradient, horizon-ward. Zenith first, horizon second.
   *
   * The horizon stays a real blue rather than running to white — white clouds
   * need something to contrast against, and a near-white horizon erases them.
   */
  skyTop: [38, 108, 196] as RGB, // #266cc4
  skyHorizon: [154, 208, 240] as RGB, // #9ad0f0

  /** Hill gradient, dark shadow to sunlit crest. */
  hillDark: [74, 155, 47] as RGB, // #4a9b2f
  hillLight: [205, 234, 107] as RGB, // #cdea6b

  /** Window chrome. */
  windowFill: "rgba(250, 252, 255, 0.82)",
  windowFillFocused: "rgba(252, 253, 255, 0.9)",
  windowBorder: "rgba(20, 40, 60, 0.35)",
  windowBorderFocused: "rgba(20, 40, 60, 0.55)",

  text: "#0d1b26",
  textMuted: "rgba(13, 27, 38, 0.55)",
  accent: "#1d6fd0",
} as const

/** Character ramps, darkest to brightest. */
export const SKY_RAMP = " .:-=+*#%@"
export const GRASS_RAMP = " .,:ivwWM#"
