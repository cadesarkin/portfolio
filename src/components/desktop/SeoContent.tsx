import { root, CONTACT } from "@/lib/vfs"
import { IDENTITY, SUMMARY, SKILLS, ROLES, EDUCATION } from "@/lib/resume"
import { isDir, type VDir, type VNode } from "@/lib/vfs-types"

/**
 * The real document, for screen readers and crawlers.
 *
 * The desktop is a canvas app rendered on the client, so without this the page
 * is effectively empty to Google and unusable with a screen reader — and this
 * is the whole portfolio now, not a decorative extra. Generated from the same
 * VFS the desktop draws, so it cannot fall out of date.
 */

function links(node: VDir): { name: string; url: string }[] {
  return node.children
    .filter((c): c is Extract<VNode, { kind: "link" }> => c.kind === "link")
    .map((c) => ({ name: c.name, url: c.url }))
}

function readme(node: VDir): string {
  const file = node.children.find((c) => c.kind === "file")
  return file && file.kind === "file" ? file.body : ""
}

function Section({ dir }: { dir: VDir }) {
  const entries = dir.children.filter(isDir)
  if (entries.length === 0) return null
  return (
    <section>
      <h2>{dir.label ?? dir.name}</h2>
      {entries.map((entry) => (
        <article key={entry.name}>
          <h3>{entry.label ?? entry.name}</h3>
          {entry.desc && <p>{entry.desc}</p>}
          <p>{readme(entry)}</p>
          <ul>
            {links(entry).map((l) => (
              <li key={l.url}>
                <a href={l.url}>{l.name}</a>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  )
}

export default function SeoContent() {
  const work = root.children.find((n) => n.name === "work")
  const projects = root.children.find((n) => n.name === "projects")

  return (
    <div className="sr-only">
      <h1>
        {IDENTITY.name} — {IDENTITY.role}
      </h1>
      <p>{SUMMARY}</p>
      <p>
        {IDENTITY.location}. Contact:{" "}
        {CONTACT.map((c) => (
          <a key={c.label} href={c.href}>
            {c.value}{" "}
          </a>
        ))}
      </p>

      {work && isDir(work) && <Section dir={work} />}
      {projects && isDir(projects) && <Section dir={projects} />}

      <section>
        <h2>Experience</h2>
        {ROLES.map((r, i) => (
          <article key={i}>
            <h3>
              {r.title} — {r.company}
            </h3>
            <p>
              {r.start} to {r.end}
            </p>
            <ul>
              {r.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section>
        <h2>Skills</h2>
        <ul>
          {SKILLS.map((s) => (
            <li key={s.label}>
              {s.label}: {s.items}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Education</h2>
        <p>
          {EDUCATION.degree}, {EDUCATION.school}, {EDUCATION.location},{" "}
          {EDUCATION.date}. {EDUCATION.honors}
        </p>
      </section>

      <p>
        <a href="/resume.pdf">Download resume (PDF)</a>
      </p>
    </div>
  )
}
