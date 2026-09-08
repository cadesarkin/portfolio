/**
 * The content tree.
 *
 * This is the only file you edit to add work, projects or files. The desktop
 * icons, folder windows, terminal `ls`/`cat`, tab-completion and the
 * screen-reader content block all read from here.
 */

import type { VDir, VNode } from "./vfs-types"
import { ROLES, SKILLS, EDUCATION, SUMMARY, IDENTITY } from "./resume"

/** experience.txt is generated from the resume so the two cannot disagree. */
function experienceBody(): string {
  const head = [SUMMARY, "", "─".repeat(64), ""]
  const roles = ROLES.flatMap((r) => [
    `${r.company}`,
    `${r.title}`,
    `${r.start} — ${r.end}`,
    "",
    ...r.bullets.map((b) => `  • ${b}`),
    "",
  ])
  const edu = [
    "─".repeat(64),
    "",
    EDUCATION.school,
    `${EDUCATION.degree} — ${EDUCATION.date}`,
    EDUCATION.honors,
    "",
  ]
  return [...head, ...roles, ...edu].join("\n")
}

function skillsBody(): string {
  return SKILLS.map((s) => `${s.label}\n  ${s.items}`).join("\n\n")
}

export const root: VDir = {
  kind: "dir",
  name: "",
  label: "~",
  children: [
    {
      kind: "dir",
      name: "work",
      icon: "folder",
      desc: "client sites and brands",
      children: [
        {
          kind: "dir",
          name: "vance",
          label: "vance",
          icon: "folder",
          tag: "[client]",
          desc: "designer clothing brand — co-owner & sole developer",
          children: [
            {
              kind: "file",
              name: "README.md",
              ext: "md",
              desc: "2021 — present",
              body: [
                "AD VANCE",
                "designer clothing brand · co-owner & sole developer · 2021 — present",
                "",
                "Built and own the full-stack e-commerce platform behind the brand.",
                "React and Next.js on Vercel, with a custom Stripe preorder checkout —",
                "payment holds, order queuing and fulfillment tracking — plus a",
                "PostgreSQL admin dashboard and CI/CD.",
                "",
                "Adborne is the same operation under a new identity: a themed drop site",
                "built on top of the platform, with a retro-arcade interface — press",
                "start, character select, HUD — wrapped around a real storefront.",
                "",
                "Two sites, one commerce backend.",
              ].join("\n"),
            },
            {
              kind: "link",
              name: "vance-ad.com",
              icon: "link",
              desc: "the store",
              url: "https://vance-ad.com",
            },
            {
              kind: "link",
              name: "adborne.com",
              icon: "link",
              desc: "drop site — retro-arcade rebrand",
              url: "https://adborne.com",
            },
          ],
        },
        {
          kind: "dir",
          name: "lore",
          icon: "folder",
          tag: "[client]",
          desc: "worldbuilding-driven clothing brand",
          children: [
            {
              kind: "file",
              name: "README.md",
              ext: "md",
              desc: "lore.nyc",
              body: [
                "LORE",
                "clothing brand · new york city",
                "",
                "A label that builds worlds first and clothes second. Each collection",
                "is a place with its own story — FW25 The Silver Plains, SS26 The Red",
                "Desert — with a Metallurgy line running through them.",
                "",
                "The storefront is built around that: collections read as chapters",
                "rather than product categories, so the narrative survives the",
                "transition from lookbook to checkout.",
              ].join("\n"),
            },
            {
              kind: "link",
              name: "lore.nyc",
              icon: "link",
              desc: "live",
              url: "https://lore.nyc",
            },
          ],
        },
        {
          kind: "dir",
          name: "dreamhouse",
          icon: "folder",
          tag: "[client]",
          desc: "creative design studio, nyc",
          children: [
            {
              kind: "file",
              name: "README.md",
              ext: "md",
              desc: "dreamhouse.nyc",
              body: [
                "DREAMHOUSE",
                "creative design studio · new york city",
                "",
                "Site for a NYC design studio — portfolio presentation for a team whose",
                "work is the selling point, so the interface stays out of the way of it.",
              ].join("\n"),
            },
            {
              kind: "link",
              name: "dreamhouse.nyc",
              icon: "link",
              desc: "live",
              url: "https://dreamhouse.nyc",
            },
          ],
        },
        {
          kind: "dir",
          name: "coming-soon",
          icon: "folder",
          tag: "[tbd]",
          desc: "next client — announcement pending",
          children: [
            {
              kind: "file",
              name: "README.md",
              ext: "md",
              body: [
                "Something is being built here.",
                "",
                "Not announced yet. Check back.",
              ].join("\n"),
            },
          ],
        },
      ],
    },
    {
      kind: "dir",
      name: "projects",
      icon: "folder",
      desc: "things built for their own sake",
      children: [
        {
          kind: "dir",
          name: "mozaiq",
          icon: "folder",
          tag: "[in progress]",
          desc: "drag-and-drop dashboard builder with AI generation",
          children: [
            {
              kind: "file",
              name: "README.md",
              ext: "md",
              body: [
                "MOZAIQ",
                "drag-and-drop dashboard builder · open source + hosted",
                "",
                "Point it at a CSV and describe what you want to see; it generates the",
                "dashboard. Then drag, drop and resize the pieces until it is right.",
                "No code required at any step.",
                "",
                "Open source for local hosting, with a hosted version at zaiq.app.",
              ].join("\n"),
            },
            {
              kind: "link",
              name: "zaiq.app",
              icon: "link",
              desc: "hosted",
              url: "https://zaiq.app",
            },
            {
              kind: "link",
              name: "github",
              icon: "link",
              desc: "zaiqapp/mozaiq",
              url: "https://github.com/zaiqapp/mozaiq",
            },
          ],
        },
        {
          kind: "dir",
          name: "threejs-portfolio",
          icon: "folder",
          tag: "[personal]",
          desc: "3d graphics experiments",
          children: [
            {
              kind: "file",
              name: "README.md",
              ext: "md",
              body: [
                "THREE.JS PORTFOLIO",
                "",
                "A collection of 3D graphics experiments built while learning Three.js —",
                "lighting, geometry, animation and shader techniques, each one small",
                "enough to isolate a single idea.",
              ].join("\n"),
            },
            {
              kind: "link",
              name: "live",
              icon: "link",
              url: "https://threejs-learning-portfolio.vercel.app",
            },
            {
              kind: "link",
              name: "github",
              icon: "link",
              desc: "cadesarkin/threejs-learning-portfolio",
              url: "https://github.com/cadesarkin/threejs-learning-portfolio",
            },
          ],
        },
        {
          kind: "dir",
          name: "surveyai",
          icon: "folder",
          tag: "[personal]",
          desc: "land survey workflow app",
          children: [
            {
              kind: "file",
              name: "README.md",
              ext: "md",
              body: [
                "SURVEYAI",
                "land survey workflow app · React/Next.js + Python",
                "",
                "Takes the paperwork-heavy parts of a land survey workflow and moves",
                "them into one place — a Next.js front end over a Python service doing",
                "the parsing and document work.",
              ].join("\n"),
            },
          ],
        },
      ],
    },
    {
      kind: "dir",
      name: "about",
      icon: "folder",
      desc: "who i am and what i've shipped",
      children: [
        {
          kind: "app",
          name: "resume.pdf",
          app: "resume",
          icon: "resume",
          desc: "the whole thing, downloadable",
        },
        {
          kind: "file",
          name: "experience.txt",
          ext: "txt",
          desc: "roles and what shipped in them",
          body: experienceBody(),
        },
        {
          kind: "file",
          name: "skills.txt",
          ext: "txt",
          desc: "languages, frameworks, infrastructure",
          body: skillsBody(),
        },
      ],
    },
    {
      kind: "app",
      name: "contact",
      app: "contact",
      icon: "contact",
      desc: "email, phone, github, linkedin",
    },
    {
      kind: "dir",
      name: "games",
      icon: "folder",
      desc: "take a break",
      children: [
        {
          kind: "app",
          name: "cube-runner",
          app: "cube-runner",
          icon: "game",
          desc: "dodge the cubes, go faster",
        },
        {
          kind: "app",
          name: "minesweeper",
          app: "minesweeper",
          icon: "game",
          desc: "9x9, ten mines",
        },
        {
          kind: "app",
          name: "snake",
          app: "snake",
          icon: "game",
          desc: "rendered in glyphs",
        },
        {
          kind: "app",
          name: "pong",
          app: "pong",
          icon: "game",
          desc: "first to five",
        },
      ],
    },
    {
      kind: "app",
      name: "terminal",
      app: "terminal",
      icon: "terminal",
      desc: "a real shell over this filesystem",
    },
  ],
}

/** Contact rows, read by ContactView and SeoContent. */
export const CONTACT: { label: string; value: string; href: string }[] = [
  { label: "email", value: IDENTITY.email, href: `mailto:${IDENTITY.email}` },
  {
    label: "phone",
    value: IDENTITY.phone,
    href: `tel:${IDENTITY.phone.replace(/[^+\d]/g, "")}`,
  },
  { label: "github", value: "github.com/cadesarkin", href: IDENTITY.github },
  {
    label: "linkedin",
    value: "linkedin.com/in/cade-sarkin",
    href: IDENTITY.linkedin,
  },
]

export type { VNode }
