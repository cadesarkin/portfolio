"use client"

/** Shared chrome for the games: a status strip, the board, and a hint line. */
export function GameFrame({
  status,
  hint,
  children,
  controls,
}: {
  status: React.ReactNode
  hint?: string
  children: React.ReactNode
  controls?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "8px 12px",
          borderBottom: "1px solid var(--win-rule)",
          fontSize: 12,
          color: "var(--ink-muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {status}
      </div>

      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 12,
        }}
      >
        {children}
      </div>

      {controls}

      {hint && (
        <div
          style={{
            padding: "6px 12px",
            borderTop: "1px solid var(--win-rule)",
            color: "var(--ink-faint)",
            fontSize: 11,
            textAlign: "center",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

/** On-screen d-pad and buttons for touch devices. */
export function TouchPad({
  buttons,
}: {
  buttons: { label: string; onPress: () => void; onRelease?: () => void }[]
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 8,
        padding: "8px 12px",
        borderTop: "1px solid var(--win-rule)",
      }}
    >
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          aria-label={b.label}
          onPointerDown={(e) => {
            e.preventDefault()
            b.onPress()
          }}
          onPointerUp={() => b.onRelease?.()}
          onPointerLeave={() => b.onRelease?.()}
          onPointerCancel={() => b.onRelease?.()}
          style={{
            font: "inherit",
            fontSize: 16,
            minWidth: 56,
            padding: "10px 0",
            color: "var(--ink)",
            background: "rgba(255,255,255,0.6)",
            border: "1px solid var(--win-border)",
            touchAction: "manipulation",
          }}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}
