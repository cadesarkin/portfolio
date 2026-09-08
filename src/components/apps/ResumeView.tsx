"use client"

import { SUMMARY, SKILLS, ROLES, EDUCATION, IDENTITY } from "@/lib/resume"

const H: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--ink-muted)",
  margin: "26px 0 10px",
  paddingBottom: 6,
  borderBottom: "1px solid var(--win-rule)",
}

/**
 * The resume as real selectable text.
 *
 * Not an embedded PDF: an iframe viewer cannot be styled to match the rest of
 * the chrome, is unusable on a phone, and its text cannot be selected or found
 * with the browser's own search. The PDF is offered as a download instead.
 */
export default function ResumeView() {
  return (
    <div style={{ padding: "22px 26px", maxWidth: "84ch", fontSize: 14, lineHeight: 1.65 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0, letterSpacing: "0.04em" }}>
          {IDENTITY.name}
        </h1>
        <a href="/resume.pdf" download style={{ fontSize: 13 }}>
          ↓ download resume.pdf
        </a>
      </div>
      <div style={{ color: "var(--ink-muted)", fontSize: 13, marginTop: 6 }}>
        {IDENTITY.location} · {IDENTITY.email} · {IDENTITY.phone}
      </div>

      <h2 style={H}>Summary</h2>
      <p style={{ margin: 0, lineHeight: 1.7 }}>{SUMMARY}</p>

      <h2 style={H}>Skills</h2>
      {SKILLS.map((s) => (
        <div key={s.label} style={{ display: "flex", gap: 14, padding: "4px 0" }}>
          <span style={{ flex: "0 0 148px", color: "var(--ink-muted)" }}>
            {s.label}
          </span>
          <span style={{ flex: "1 1 auto", lineHeight: 1.7 }}>{s.items}</span>
        </div>
      ))}

      <h2 style={H}>Experience</h2>
      {ROLES.map((r, i) => (
        <div key={i} style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <strong style={{ fontWeight: 700, fontSize: 15 }}>{r.company}</strong>
            <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>
              {r.start} — {r.end}
            </span>
          </div>
          <div style={{ color: "var(--ink-muted)", fontSize: 13.5 }}>
            {r.title}
          </div>
          <ul style={{ margin: "10px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
            {r.bullets.map((b, j) => (
              <li key={j} style={{ marginBottom: 8 }}>
                {b}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <h2 style={H}>Education</h2>
      <div>
        <strong>{EDUCATION.school}</strong> · {EDUCATION.location}
      </div>
      <div style={{ color: "var(--ink-muted)" }}>
        {EDUCATION.degree} — {EDUCATION.date}
      </div>
      <div style={{ color: "var(--ink-muted)" }}>{EDUCATION.honors}</div>
    </div>
  )
}
