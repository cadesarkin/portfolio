"use client"

import { SUMMARY, SKILLS, ROLES, EDUCATION, IDENTITY } from "@/lib/resume"

const H: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  margin: "20px 0 8px",
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
    <div style={{ padding: "16px 20px", maxWidth: "80ch", fontSize: 12.5 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: 18, margin: 0, letterSpacing: "0.06em" }}>
          {IDENTITY.name}
        </h1>
        <a href="/resume.pdf" download style={{ fontSize: 12 }}>
          ↓ download resume.pdf
        </a>
      </div>
      <div style={{ color: "var(--ink-muted)", fontSize: 12, marginTop: 4 }}>
        {IDENTITY.location} · {IDENTITY.email} · {IDENTITY.phone}
      </div>

      <h2 style={H}>Summary</h2>
      <p style={{ margin: 0, lineHeight: 1.65 }}>{SUMMARY}</p>

      <h2 style={H}>Skills</h2>
      {SKILLS.map((s) => (
        <div key={s.label} style={{ display: "flex", gap: 10, padding: "2px 0" }}>
          <span style={{ flex: "0 0 132px", color: "var(--ink-muted)" }}>
            {s.label}
          </span>
          <span style={{ flex: "1 1 auto", lineHeight: 1.6 }}>{s.items}</span>
        </div>
      ))}

      <h2 style={H}>Experience</h2>
      {ROLES.map((r, i) => (
        <div key={i} style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <strong style={{ fontWeight: 700 }}>{r.company}</strong>
            <span style={{ color: "var(--ink-faint)", fontSize: 11.5 }}>
              {r.start} — {r.end}
            </span>
          </div>
          <div style={{ color: "var(--ink-muted)", fontSize: 12 }}>
            {r.title}
          </div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
            {r.bullets.map((b, j) => (
              <li key={j} style={{ marginBottom: 4 }}>
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
