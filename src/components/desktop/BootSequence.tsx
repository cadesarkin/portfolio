"use client"

import { useEffect, useRef, useState } from "react"
import { root } from "@/lib/vfs"
import { tenure } from "@/lib/resume"

const POST_MS = 1000
const MOUNT_MS = 1200
const WAKE_MS = 400

/** POST lines. The memory figure is computed, so the joke never goes stale. */
function postLines() {
  return [
    ["cpu", "verified"],
    ["memory", tenure()],
    ["display", "ascii @ 30fps"],
    ["input", "keyboard, pointer"],
  ] as const
}

function mountLines() {
  const dirs = root.children
    .filter((n) => n.kind === "dir")
    .map((n) => `mounting /${n.name}`)
  return [...dirs, "loading bliss.wallpaper", "starting window manager"]
}

interface Props {
  onDone: () => void
}

export default function BootSequence({ onDone }: Props) {
  const [phase, setPhase] = useState<"post" | "mount" | "wake">("post")
  const [postShown, setPostShown] = useState(0)
  const [progress, setProgress] = useState(0)
  const done = useRef(false)

  const post = postLines()
  const mounts = mountLines()

  const finish = useRef(onDone)
  finish.current = onDone

  /**
   * Any input skips the whole sequence — but not the input that started it.
   *
   * `reboot` is submitted with Enter. React mounts this component
   * synchronously while that keydown is still propagating, so a listener
   * attached here immediately receives the very same event and skips before a
   * single frame is drawn. The grace period ignores anything that arrives in
   * the moment the sequence appears, which also stops a stray double-tap from
   * eating it.
   */
  useEffect(() => {
    const armedAt = performance.now() + 300
    const skip = () => {
      if (done.current || performance.now() < armedAt) return
      done.current = true
      finish.current()
    }
    window.addEventListener("keydown", skip)
    window.addEventListener("pointerdown", skip)
    return () => {
      window.removeEventListener("keydown", skip)
      window.removeEventListener("pointerdown", skip)
    }
  }, [])

  // POST lines appear one at a time.
  useEffect(() => {
    if (phase !== "post") return
    const step = POST_MS / post.length
    const id = setInterval(() => {
      setPostShown((n) => {
        if (n + 1 >= post.length) {
          clearInterval(id)
          setTimeout(() => setPhase("mount"), 120)
        }
        return n + 1
      })
    }, step)
    return () => clearInterval(id)
  }, [phase, post.length])

  // Mount bar fills, then the wake wipe runs.
  useEffect(() => {
    if (phase !== "mount") return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min((now - start) / MOUNT_MS, 1)
      setProgress(t)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setPhase("wake")
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  useEffect(() => {
    if (phase !== "wake") return
    const id = setTimeout(() => {
      if (done.current) return
      done.current = true
      finish.current()
    }, WAKE_MS)
    return () => clearTimeout(id)
  }, [phase])

  const mountsShown = Math.floor(progress * mounts.length)

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#04101c",
        color: "#7dd88f",
        fontSize: 13,
        lineHeight: 1.7,
        padding: "clamp(24px, 8vh, 90px) clamp(20px, 8vw, 110px)",
        // The wake beat wipes the overlay away as an expanding scanline.
        clipPath:
          phase === "wake" ? "inset(50% 0 50% 0)" : "inset(0 0 0 0)",
        opacity: phase === "wake" ? 0 : 1,
        transition:
          phase === "wake"
            ? `clip-path ${WAKE_MS}ms ease-in, opacity ${WAKE_MS}ms ease-in`
            : undefined,
      }}
    >
      <div style={{ color: "#d7f7de", marginBottom: 2 }}>SARKIN BIOS v3.2</div>
      <div style={{ color: "#2f6d43" }}>{"-".repeat(34)}</div>

      {post.slice(0, postShown).map(([k, v]) => (
        <div key={k}>
          {k} {".".repeat(Math.max(2, 12 - k.length))} {v}
        </div>
      ))}

      {phase !== "post" && (
        <div style={{ marginTop: 16 }}>
          {mounts.slice(0, mountsShown).map((line) => (
            <div key={line}>
              {line} {".".repeat(Math.max(2, 30 - line.length))} ok
            </div>
          ))}
          <div style={{ marginTop: 12, color: "#2f6d43" }}>
            [{"#".repeat(Math.round(progress * 28))}
            {".".repeat(28 - Math.round(progress * 28))}]{" "}
            {Math.round(progress * 100)}%
          </div>
        </div>
      )}

      <div style={{ marginTop: 22, color: "#2f6d43" }}>
        press any key to continue
      </div>
    </div>
  )
}
