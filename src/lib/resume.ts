/**
 * Structured resume data.
 *
 * Single source for the resume window, the `experience.txt` and `skills.txt`
 * VFS files, the `neofetch` stats, and the screen-reader content block. Kept
 * in sync with public/resume.pdf by hand when the PDF is regenerated.
 */

export interface Role {
  company: string
  title: string
  start: string
  end: string
  bullets: string[]
}

export const IDENTITY = {
  name: "Cade Sarkin",
  role: "Software Engineer",
  location: "Brooklyn, NY",
  email: "sarkincade@gmail.com",
  phone: "+1 (479) 684-9353",
  site: "cadesarkin.com",
  github: "https://github.com/cadesarkin",
  linkedin: "https://linkedin.com/in/cade-sarkin-4a2918222/",
  /** Start of professional experience. Drives the computed tenure. */
  careerStart: new Date(2023, 5, 1),
} as const

export const SUMMARY =
  "Engineer with 3+ years shipping production TypeScript, Java and Python " +
  "across high-traffic applications and developer tooling. Currently building " +
  "SDK generators, agent automations, CLI features and API docs infrastructure " +
  "at Fern for enterprise API companies. Owns features end to end, from " +
  "customer conversation to shipped release."

export const SKILLS: { label: string; items: string }[] = [
  {
    label: "Languages",
    items: "TypeScript, JavaScript, Java, Python, Go, C#, C++, SQL",
  },
  {
    label: "SDK Codegen",
    items:
      "Idiomatic client generation across TypeScript, Python, Go, Java, C#, PHP, Ruby, Swift, Rust",
  },
  {
    label: "Frameworks",
    items:
      "React, Next.js, Node.js, Angular, Spring Boot, GraphQL, REST APIs, Three.js",
  },
  {
    label: "Infrastructure",
    items:
      "AWS, Cloudflare, Vercel, Docker, PostgreSQL, MongoDB, PostHog, CI/CD, Git/GitHub",
  },
  {
    label: "Developer Tooling",
    items:
      "OpenAPI/Swagger, CLI development, webhooks, OAuth, MCP, npm/PyPI/Maven publishing",
  },
]

export const ROLES: Role[] = [
  {
    company: "Fern",
    title: "Engineer — SDKs, CLI & Platform",
    start: "Jun 2026",
    end: "Present",
    bullets: [
      "Built Fern Agent Automations, giving 100+ enterprise customers automated analysis and maintenance of their docs — one prompt plus a cron expression schedules recurring agent runs, and a one-time OAuth consent means every edit and PR carries the user's own permissions, not a bot's.",
      "Ran automation doc edits as durable background jobs that wake the agent when they land, so it reports the resulting PR and notifies the user over email or Slack.",
      "Ship features across Fern's SDK generators for nine languages — auto-generated idempotency keys, user-agent headers, webhook signature verification — raising the security and reliability baseline of every generated SDK.",
      "Extended the Fern CLI with dual authorization and package identity customization, giving customers control over registry credentials and published package naming.",
      "Shipped org-scoped data retention in the dashboard — deletion policies and on-demand purging for search queries, Ask AI conversations, preview sites and MCP data previously kept indefinitely — unblocking enterprise compliance.",
      "Led enterprise migrations onto Fern — Sigma's 1,500-page move off ReadMe, and Mailchimp's full docs, SDK and CLI migration across nine languages.",
      "Own bug triage across the SDK generators, CLI and dashboard — reproducing customer-reported issues, identifying root cause, and shipping fixes into the affected language generators.",
    ],
  },
  {
    company: "J.B. Hunt Transport Services",
    title: "Software Engineer II — Full-Stack",
    start: "Sep 2024",
    end: "Mar 2026",
    bullets: [
      "Architected and deployed microservices for the customer booking workflow in TypeScript and Java, enabling guest checkout and card payments for the first time and increasing booking conversion 35%.",
      "Spearheaded conversion from session storage to GraphQL, eliminating cross-tab session bugs, updating 1,000+ tests, and improving data fetch speeds by approximately 50%.",
      "Led Angular v12 to v18 modernization, restoring full test coverage and cutting page load times by 2.5 seconds.",
    ],
  },
  {
    company: "J.B. Hunt Transport Services",
    title: "Software Engineer I — Java/Full-Stack",
    start: "Jun 2023",
    end: "Sep 2024",
    bullets: [
      "Developed and maintained customer-facing microservices handling 100,000+ daily requests for booking, tracking and payment of shipments across North America using Java and Spring Boot.",
      "Mitigated 300+ CVEs and upgraded 20+ microservices to Spring Boot 3.x, hardening enterprise security posture.",
    ],
  },
  {
    company: "J.B. Hunt Transport Services",
    title: "Engineering Intern, Team Lead",
    start: "Summer 2021",
    end: "2022",
    bullets: [
      "Led a team of engineers in Agile sprints and presented to 200+ attendees including the CIO; delivered 4x expected output on data-grid conversions.",
    ],
  },
]

export const EDUCATION = {
  school: "The University of Kansas",
  location: "Lawrence, KS",
  date: "May 2023",
  degree: "B.S. Computer Science and Engineering",
  honors: "SELF Engineering Leadership Fellow (1 of 27 from 500)",
} as const

/** Years and months since `IDENTITY.careerStart`. Used by boot + neofetch. */
export function tenure(now: Date = new Date()): string {
  const from = IDENTITY.careerStart
  const months =
    (now.getFullYear() - from.getFullYear()) * 12 +
    (now.getMonth() - from.getMonth())
  const y = Math.floor(months / 12)
  const m = months % 12
  return `${y} year${y === 1 ? "" : "s"}, ${m} month${m === 1 ? "" : "s"}`
}
