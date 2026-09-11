"use client"

import { useSyncExternalStore } from "react"
import {
  getProgress,
  getServerProgress,
  showScene,
  subscribeProgress,
} from "@/lib/defrag/progress"
import { useTheme } from "@/components/desktop/theme-context"
import {
  useWallpaper,
  DEFAULT_SETTINGS,
  type WallpaperSettings,
} from "@/components/desktop/wallpaper-settings"

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}

function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 0",
        fontSize: 13,
      }}
    >
      <span style={{ flex: "0 0 116px", color: "var(--ink-muted)" }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: "1 1 auto", minWidth: 0, accentColor: "var(--accent)" }}
      />
      <span
        style={{
          flex: "0 0 56px",
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {format(value)}
      </span>
    </label>
  )
}

/**
 * The XP Display Properties window, wired to the live renderer.
 *
 * Every control drives the wallpaper as it is running — this is the same
 * shader the desktop sits on, not a preview of one.
 */
export default function DisplayProperties() {
  const { settings, set, reset } = useWallpaper()
  const { theme, setTheme } = useTheme()
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getServerProgress)

  const controls: (SliderProps & { key: keyof WallpaperSettings })[] = [
    {
      key: "cloud",
      label: "cloud cover",
      value: settings.cloud,
      min: 0,
      max: 1,
      step: 0.01,
      format: (v) => `${Math.round(v * 100)}%`,
      onChange: (v) => set("cloud", v),
    },
    {
      key: "wind",
      label: "wind speed",
      value: settings.wind,
      min: 0,
      max: 3,
      step: 0.05,
      format: (v) => `${v.toFixed(2)}x`,
      onChange: (v) => set("wind", v),
    },
    {
      key: "fontSize",
      label: "character size",
      value: settings.fontSize,
      min: 6,
      max: 24,
      step: 1,
      format: (v) => `${v}px`,
      onChange: (v) => set("fontSize", v),
    },
    {
      key: "fps",
      label: "frame rate",
      value: settings.fps,
      min: 5,
      max: 60,
      step: 1,
      format: (v) => `${v}fps`,
      onChange: (v) => set("fps", v),
    },
  ]

  const dirty =
    settings.cloud !== DEFAULT_SETTINGS.cloud ||
    settings.wind !== DEFAULT_SETTINGS.wind ||
    settings.fontSize !== DEFAULT_SETTINGS.fontSize ||
    settings.fps !== DEFAULT_SETTINGS.fps

  return (
    <div
      style={{
        padding: "18px 22px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <p
        style={{
          margin: "0 0 14px",
          color: "var(--ink-muted)",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        The wallpaper is a character-grid renderer running live behind this
        window. These drive it directly.
      </p>

      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 0 14px",
          borderBottom: "1px solid var(--win-rule)",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            flex: "0 0 116px",
            color: "var(--ink-muted)",
            fontSize: 13,
            alignSelf: "center",
          }}
        >
          time of day
        </span>
        {(["day", "night"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            data-active={theme === t ? "" : undefined}
            className="seg"
          >
            {t}
          </button>
        ))}
      </div>

      {/* Only once there is somewhere else to show: after the ship has gone. */}
      {progress.launched && (
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "0 0 14px",
            borderBottom: "1px solid var(--win-rule)",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              flex: "0 0 116px",
              color: "var(--ink-muted)",
              fontSize: 13,
              alignSelf: "center",
            }}
          >
            scene
          </span>
          {(["plains", "space"] as const).map((sc) => (
            <button
              key={sc}
              type="button"
              onClick={() => showScene(sc)}
              data-active={progress.scene === sc ? "" : undefined}
              className="seg"
            >
              {sc}
            </button>
          ))}
        </div>
      )}

      {controls.map(({ key, ...slider }) => (
        <Slider key={key} {...slider} />
      ))}

      <div style={{ marginTop: "auto", paddingTop: 16 }}>
        <button
          type="button"
          onClick={reset}
          disabled={!dirty}
          className="seg"
          style={{ opacity: dirty ? 1 : 0.45 }}
        >
          reset to defaults
        </button>
      </div>
    </div>
  )
}
