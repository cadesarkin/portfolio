"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useWindowKeys } from "@/components/desktop/use-window-keys"
import {
  TUNES,
  noteToFreq,
  stepDuration,
  tuneLength,
  type Channel,
  type Tune,
} from "@/lib/chiptune"

/** How far ahead notes are queued, and how often the queue is topped up. */
const LOOKAHEAD_S = 0.12
const TICK_MS = 25

const BARS = 24
const BAR_ROWS = 8

/**
 * How long a note holds: its own step plus any "." steps that follow it.
 */
function noteLength(steps: string[], i: number): number {
  let n = 1
  while (i + n < steps.length && steps[i + n] === ".") n++
  return n
}

export default function Chiptune({
  winId,
  isMobile,
}: {
  winId: string
  isMobile: boolean
}) {
  const [tuneIdx, setTuneIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [step, setStep] = useState(0)
  const [bars, setBars] = useState<number[]>(() => new Array(BARS).fill(0))

  const ctxRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const noiseRef = useRef<AudioBuffer | null>(null)
  /** Next step index to schedule, and the time it should sound at. */
  const cursor = useRef({ step: 0, time: 0 })
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const raf = useRef(0)

  const tune: Tune = TUNES[tuneIdx]
  const tuneRef = useRef(tune)
  tuneRef.current = tune

  const volumeRef = useRef(volume)
  volumeRef.current = volume

  /** Built on first play: an AudioContext may not be created before a gesture. */
  const ensureAudio = useCallback(() => {
    if (ctxRef.current) return ctxRef.current
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    const ctx = new Ctor()

    const master = ctx.createGain()
    master.gain.value = volumeRef.current
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 128
    master.connect(analyser)
    analyser.connect(ctx.destination)

    // One second of white noise, reused for every percussion hit.
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

    ctxRef.current = ctx
    masterRef.current = master
    analyserRef.current = analyser
    noiseRef.current = buf
    return ctx
  }, [])

  /** Schedules one note on one channel at an absolute context time. */
  const scheduleNote = useCallback(
    (ch: Channel, freq: number | null, at: number, dur: number) => {
      const ctx = ctxRef.current
      const master = masterRef.current
      if (!ctx || !master) return

      const gain = ctx.createGain()
      gain.connect(master)

      // A short attack and an exponential tail: an instant on/off clicks.
      const peak = ch.gain
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur * 0.96)

      if (ch.wave === "noise") {
        const src = ctx.createBufferSource()
        src.buffer = noiseRef.current
        const filter = ctx.createBiquadFilter()
        filter.type = "highpass"
        filter.frequency.value = 1200
        src.connect(filter)
        filter.connect(gain)
        src.start(at)
        src.stop(at + dur)
        src.onended = () => gain.disconnect()
        return
      }

      if (freq === null) return
      const osc = ctx.createOscillator()
      osc.type = ch.wave
      osc.frequency.setValueAtTime(freq, at)
      osc.connect(gain)
      osc.start(at)
      osc.stop(at + dur)
      osc.onended = () => gain.disconnect()
    },
    []
  )

  /**
   * Tops up the note queue.
   *
   * Scheduling ahead of time against the audio clock, rather than firing notes
   * from a timer, is what keeps the rhythm steady — a setInterval alone drifts
   * audibly within a couple of bars.
   */
  const pump = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    const t = tuneRef.current
    const dur = stepDuration(t.bpm)
    const len = tuneLength(t)

    while (cursor.current.time < ctx.currentTime + LOOKAHEAD_S) {
      const i = cursor.current.step % len
      const at = cursor.current.time

      for (const ch of t.channels) {
        const s = ch.steps[i]
        if (!s || s === "-" || s === ".") continue
        const hold = noteLength(ch.steps, i) * dur
        scheduleNote(ch, noteToFreq(s), at, hold)
      }

      // Drive the step readout from the audio clock, not the render loop.
      const showAt = at
      const delay = Math.max(0, (showAt - ctx.currentTime) * 1000)
      setTimeout(() => setStep(i), delay)

      cursor.current.step += 1
      cursor.current.time += dur
    }
  }, [scheduleNote])

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setPlaying(false)
    const ctx = ctxRef.current
    if (ctx) void ctx.suspend()
  }, [])

  const play = useCallback(() => {
    const ctx = ensureAudio()
    void ctx.resume()
    // Start a hair ahead so the first note is not already late.
    cursor.current = { step: cursor.current.step, time: ctx.currentTime + 0.06 }
    pump()
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(pump, TICK_MS)
    setPlaying(true)
  }, [ensureAudio, pump])

  const toggle = useCallback(() => {
    if (playing) stop()
    else play()
  }, [playing, play, stop])

  const selectTune = (i: number) => {
    const wasPlaying = playing
    stop()
    setTuneIdx(i)
    cursor.current = { step: 0, time: 0 }
    setStep(0)
    if (wasPlaying) {
      // Let the state settle so `pump` reads the new tune.
      setTimeout(() => play(), 30)
    }
  }

  useEffect(() => {
    if (masterRef.current && ctxRef.current) {
      masterRef.current.gain.setTargetAtTime(
        volume,
        ctxRef.current.currentTime,
        0.02
      )
    }
  }, [volume])

  // Spectrum readout.
  useEffect(() => {
    if (!playing) {
      setBars(new Array(BARS).fill(0))
      return
    }
    const data = new Uint8Array(BARS)
    const loop = () => {
      raf.current = requestAnimationFrame(loop)
      const a = analyserRef.current
      if (!a) return
      a.getByteFrequencyData(data)
      setBars(Array.from(data, (v) => Math.round((v / 255) * BAR_ROWS)))
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [playing])

  // Never leave audio running behind a closed window.
  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current)
      cancelAnimationFrame(raf.current)
      void ctxRef.current?.close()
      ctxRef.current = null
    }
  }, [])

  useWindowKeys(winId, (e) => {
    if (e.key === " ") {
      e.preventDefault()
      toggle()
    }
  })

  // The spectrum, drawn as characters.
  const rows: string[] = []
  for (let r = BAR_ROWS; r > 0; r--) {
    rows.push(bars.map((h) => (h >= r ? "#" : " ")).join(" "))
  }

  const len = tuneLength(tune)

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
          gap: 6,
          padding: "10px 12px",
          borderBottom: "1px solid var(--win-rule)",
          flexWrap: "wrap",
        }}
      >
        {TUNES.map((t, i) => (
          <button
            key={t.name}
            type="button"
            className="seg"
            data-active={tuneIdx === i ? "" : undefined}
            onClick={() => selectTune(i)}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "grid",
          placeItems: "center",
          padding: 12,
        }}
      >
        <pre
          aria-hidden="true"
          style={{
            margin: 0,
            fontSize: "clamp(9px, 1.6vw, 13px)",
            lineHeight: 1.15,
            letterSpacing: "0.06em",
            color: playing ? "var(--accent)" : "var(--ink-faint)",
            userSelect: "none",
          }}
        >
          {rows.join("\n")}
        </pre>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px",
          borderTop: "1px solid var(--win-rule)",
          fontSize: 13,
        }}
      >
        <button type="button" className="seg" onClick={toggle} style={{ minWidth: 68 }}>
          {playing ? "pause" : "play"}
        </button>

        <span
          style={{
            color: "var(--ink-faint)",
            fontVariantNumeric: "tabular-nums",
            flex: "0 0 auto",
          }}
        >
          {String((step % len) + 1).padStart(2, "0")}/{len}
        </span>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "1 1 auto",
            minWidth: 0,
          }}
        >
          <span style={{ color: "var(--ink-muted)" }}>vol</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
            style={{ flex: "1 1 auto", minWidth: 0, accentColor: "var(--accent)" }}
          />
        </label>
      </div>

      <div
        style={{
          padding: "6px 12px",
          borderTop: "1px solid var(--win-rule)",
          color: "var(--ink-faint)",
          fontSize: 12,
          textAlign: "center",
        }}
      >
        {tune.bpm} bpm · {tune.channels.length} channels · synthesised live
        {!isMobile && " · space plays"}
      </div>
    </div>
  )
}
