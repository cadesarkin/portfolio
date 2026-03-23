# Portfolio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the portfolio from dark glassmorphism to a minimal light terminal aesthetic as a single scrollable page with modal popups for project details.

**Architecture:** All page content moves into a single `src/app/page.tsx`. New `Card.tsx` and `ProjectModal.tsx` components handle project display. The existing `Typewriter` component gains an `onComplete` callback to sequence the two-line hero animation. Old pages (`/contact`, `/projects`) are deleted and redirected to `/` via `next.config.ts`.

**Tech Stack:** Next.js (App Router), IBM Plex Mono (weights 300/400/700), Tailwind CSS, TypeScript

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `next.config.ts` | Modify | Add redirects + carry over all settings from next.config.js |
| `next.config.js` | Delete | Consolidated into next.config.ts |
| `src/app/globals.css` | Modify | Add modal animation keyframe, remove unused shine/glassmorphism keyframes, add html scroll-behavior |
| `src/app/layout.tsx` | Modify | Set bg `#eaeff5`, text `#0d0d0d`, load IBM Plex Mono 300/400/700 |
| `src/components/typewriter.tsx` | Modify | Add `onComplete` callback prop (fires once when typing finishes) |
| `src/components/Card.tsx` | Create | Shared minimal card for Work + Projects sections |
| `src/components/ProjectModal.tsx` | Create | Terminal-window modal — handles work (iframe) and project (GitHub link) types |
| `src/components/navbar.tsx` | Rewrite | Flat transparent navbar with smooth-scroll anchors + mobile dropdown |
| `src/app/page.tsx` | Rewrite | Single scrollable page: Hero → Work → Projects → Contact |
| `src/app/contact/page.tsx` | Delete | Content moved to main page |
| `src/app/projects/page.tsx` | Delete | Content moved to main page |
| `src/components/loading-screen.tsx` | Delete | Removed from design |
| `src/components/AsciiFireBackground.tsx` | Delete | Removed from design |

**Do not delete:** `src/components/EmbeddedWebsite.tsx` — still used by ProjectModal.

---

## Task 1: Update next.config.ts and delete next.config.js

**Files:**
- Modify: `next.config.ts`
- Delete: `next.config.js`

- [ ] **Step 1: Rewrite next.config.ts** with all settings from next.config.js plus redirects.

```ts
// next.config.ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: false,
    remotePatterns: [],
  },
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/contact", destination: "/", permanent: false },
      { source: "/projects", destination: "/", permanent: false },
    ]
  },
}

export default nextConfig
```

> Note: Next.js does not support hash fragments in redirect destinations, so `/contact` and `/projects` redirect to `/` (not `/#contact`). This is correct behavior.

- [ ] **Step 2: Delete next.config.js**

```bash
rm "D:\Cursor Projects\portfolio\next.config.js"
```

- [ ] **Step 3: Commit**

```bash
cd "D:\Cursor Projects\portfolio" && git add next.config.ts next.config.js && git commit -m "chore: consolidate next.config into ts, add redirects"
```

---

## Task 2: Update layout.tsx

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Rewrite layout.tsx**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next"
import { IBM_Plex_Mono } from "next/font/google"
import "./globals.css"

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
})

export const metadata: Metadata = {
  title: "Cade Sarkin",
  description: "Portfolio website for Cade Sarkin",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" style={{ scrollBehavior: "smooth" }}>
      <body
        className={ibmPlexMono.className}
        style={{ backgroundColor: "#eaeff5", color: "#0d0d0d", minHeight: "100vh" }}
      >
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "D:\Cursor Projects\portfolio" && git add src/app/layout.tsx && git commit -m "chore: update layout - light bg, IBM Plex Mono 300/400/700, smooth scroll"
```

---

## Task 3: Update globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add `html { scroll-behavior: smooth }` and `@keyframes modalIn` to globals.css** — do NOT remove existing keyframes (`shine`, `shine-slow`, `bg-radial-gradient`) because `src/app/resume/page.tsx` still uses them.

Append these two blocks to the end of the existing `globals.css`:

```css
/* Add after existing content in globals.css */
html {
  scroll-behavior: smooth;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "D:\Cursor Projects\portfolio" && git add src/app/globals.css && git commit -m "chore: clean up globals.css, add modal animation keyframe"
```

---

## Task 4: Update Typewriter component

**Files:**
- Modify: `src/components/typewriter.tsx`

The `onComplete` callback must fire exactly once when typing finishes. Use a ref to guard against double-firing in React strict mode.

- [ ] **Step 1: Update typewriter.tsx**

```tsx
// src/components/typewriter.tsx
"use client"

import { useState, useEffect, useRef } from "react"

interface TypewriterProps {
  text: string
  speed?: number
  show?: boolean
  showMobile?: boolean
  onComplete?: () => void
}

export default function Typewriter({
  text,
  speed,
  show,
  showMobile = true,
  onComplete,
}: TypewriterProps) {
  const [displayedText, setDisplayedText] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showCursor, setShowCursor] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }, speed ?? 100)
      return () => clearTimeout(timeout)
    } else if (onComplete && !completedRef.current) {
      completedRef.current = true
      onComplete()
    }
  }, [currentIndex, text, speed, onComplete])

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 500)
    return () => clearInterval(cursorInterval)
  }, [])

  return (
    <span>
      {displayedText}
      {show && (
        <span
          className={`${showCursor ? "opacity-100" : "opacity-0"} transition-opacity duration-100 ${
            !showMobile ? "hidden sm:inline" : ""
          }`}
        >
          █
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "D:\Cursor Projects\portfolio" && git add src/components/typewriter.tsx && git commit -m "feat: add onComplete callback to Typewriter component"
```

---

## Task 5: Create Card component

**Files:**
- Create: `src/components/Card.tsx`

Shared card used in both Work and Projects sections. Purely presentational — all click logic delegated to parent via `onClick`.

- [ ] **Step 1: Create Card.tsx**

```tsx
// src/components/Card.tsx
interface CardProps {
  name: string
  description: string
  tag: string
  onClick: () => void
}

export default function Card({ name, description, tag, onClick }: CardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-5 py-4 border border-[#c8d4e0] hover:border-[#0d0d0d] transition-colors duration-150 bg-transparent cursor-pointer"
    >
      <div className="font-bold text-[#0d0d0d] text-sm">{name}</div>
      <div className="text-[#0d0d0d] text-xs mt-1 opacity-60">{description}</div>
      <div className="text-[#0d0d0d] text-xs mt-2 opacity-35 font-light">{tag}</div>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "D:\Cursor Projects\portfolio" && git add src/components/Card.tsx && git commit -m "feat: add Card component"
```

---

## Task 6: Create ProjectModal component

**Files:**
- Create: `src/components/ProjectModal.tsx`

One modal handles both work (iframe via EmbeddedWebsite) and project (GitHub link) types. Dismisses on ✕, backdrop click, or Escape key.

- [ ] **Step 1: Create ProjectModal.tsx**

```tsx
// src/components/ProjectModal.tsx
"use client"

import { useEffect, useCallback } from "react"
import EmbeddedWebsite from "./EmbeddedWebsite"

interface ProjectModalProps {
  title: string
  description: string
  type: "work" | "project"
  liveUrl?: string
  githubUrl?: string
  onClose: () => void
}

export default function ProjectModal({
  title,
  description,
  type,
  liveUrl,
  githubUrl,
  onClose,
}: ProjectModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
      onClick={onClose}
    >
      <div
        className="w-[90vw] max-w-[860px] max-h-[80vh] overflow-y-auto bg-white border border-[#0d0d0d] flex flex-col"
        style={{ animation: "modalIn 150ms ease forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#0d0d0d] flex-shrink-0">
          <span className="font-bold text-[#0d0d0d] text-sm">{title}</span>
          <button
            onClick={onClose}
            className="text-[#0d0d0d] hover:opacity-40 transition-opacity text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
          <p className="text-[#0d0d0d] text-sm opacity-70">{description}</p>

          {type === "work" && liveUrl && (
            <div className="h-[300px] sm:h-[500px]">
              <EmbeddedWebsite
                url={liveUrl}
                title={title}
                className="w-full h-full"
              />
            </div>
          )}

          {type === "project" && githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2563eb] text-sm hover:underline"
            >
              view on github →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "D:\Cursor Projects\portfolio" && git add src/components/ProjectModal.tsx && git commit -m "feat: add ProjectModal component"
```

---

## Task 7: Rewrite navbar.tsx

**Files:**
- Modify: `src/components/navbar.tsx`

Flat transparent bar. Desktop: logo left, anchor links right. Mobile: hamburger toggles a dropdown below the bar. All glassmorphism removed.

- [ ] **Step 1: Rewrite navbar.tsx**

```tsx
// src/components/navbar.tsx
"use client"

import { useState } from "react"

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-40">
      <div className="flex items-center justify-between px-6 py-5">
        <a
          href="#"
          className="font-bold text-[#0d0d0d] text-sm hover:opacity-50 transition-opacity"
        >
          cade sarkin
        </a>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-8">
          <a href="#work" className="text-[#0d0d0d] text-sm hover:text-[#2563eb] transition-colors">
            work
          </a>
          <a href="#projects" className="text-[#0d0d0d] text-sm hover:text-[#2563eb] transition-colors">
            projects
          </a>
          <a href="#contact" className="text-[#0d0d0d] text-sm hover:text-[#2563eb] transition-colors">
            contact
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden flex flex-col gap-1.5 p-1"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          <span className="block w-5 h-px bg-[#0d0d0d]" />
          <span className="block w-5 h-px bg-[#0d0d0d]" />
          <span className="block w-5 h-px bg-[#0d0d0d]" />
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="sm:hidden bg-[#eaeff5] border-b border-[#c8d4e0] px-6 pb-5 flex flex-col gap-4"
          onClick={() => setMenuOpen(false)}
        >
          <a href="#work" className="text-[#0d0d0d] text-sm hover:text-[#2563eb] transition-colors">
            work
          </a>
          <a href="#projects" className="text-[#0d0d0d] text-sm hover:text-[#2563eb] transition-colors">
            projects
          </a>
          <a href="#contact" className="text-[#0d0d0d] text-sm hover:text-[#2563eb] transition-colors">
            contact
          </a>
        </div>
      )}
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "D:\Cursor Projects\portfolio" && git add src/components/navbar.tsx && git commit -m "feat: rewrite navbar - flat minimal terminal style"
```

---

## Task 8: Rewrite page.tsx

**Files:**
- Modify: `src/app/page.tsx`

The main single-page layout. Manages modal state, hero typewriter sequencing, and contact section IntersectionObserver trigger.

Hero animation sequence:
1. Line 1 starts typing immediately — cursor shows on line 1
2. `onComplete` fires → `setLine1Done(true)` → 400ms later `setShowLine2(true)` → cursor moves to line 2
3. Line 2 cursor stays blinking permanently

- [ ] **Step 1: Rewrite page.tsx**

```tsx
// src/app/page.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import Navbar from "@/components/navbar"
import Typewriter from "@/components/typewriter"
import Card from "@/components/Card"
import ProjectModal from "@/components/ProjectModal"

interface ModalData {
  title: string
  description: string
  type: "work" | "project"
  liveUrl?: string
  githubUrl?: string
}

const workItems: (ModalData & { tag: string; cardDescription: string })[] = [
  {
    title: "vance",
    cardDescription: "clothing brand website",
    tag: "[client]",
    type: "work",
    liveUrl: "https://vance-ad.com",
    description:
      "Website for Vance, a designer clothing brand. Built with custom JavaScript, CSS, and HTML. New site under construction with React/Next.js and Stripe.",
  },
  {
    title: "dreamhouse",
    cardDescription: "interior design studio website",
    tag: "[client]",
    type: "work",
    liveUrl: "https://dreamhouse.nyc",
    description: "Website for Dreamhouse, an interior design studio based in New York City.",
  },
]

const projectItems: (ModalData & { tag: string; cardDescription: string })[] = [
  {
    title: "three.js portfolio",
    cardDescription: "3d graphics experiments",
    tag: "[personal]",
    type: "project",
    githubUrl: "https://github.com/cadesarkin/threejs-learning-portfolio",
    description:
      "A collection of 3D graphics experiments built while learning Three.js. Explores lighting, geometry, animation, and shader techniques.",
  },
  {
    title: "matchplay",
    cardDescription: "golf scorecard app",
    tag: "[in progress]",
    type: "project",
    githubUrl: "https://github.com/cadesarkin/matchplay",
    description: "golf scorecard app. currently in development.",
  },
]

export default function Home() {
  // Hero typewriter sequencing
  const [line1Done, setLine1Done] = useState(false)
  const [showLine2, setShowLine2] = useState(false)

  useEffect(() => {
    if (line1Done) {
      const t = setTimeout(() => setShowLine2(true), 400)
      return () => clearTimeout(t)
    }
  }, [line1Done])

  // Contact section IntersectionObserver
  const contactRef = useRef<HTMLDivElement>(null)
  const [contactStarted, setContactStarted] = useState(false)

  useEffect(() => {
    const el = contactRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setContactStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Modal state
  const [modal, setModal] = useState<ModalData | null>(null)

  return (
    <>
      <Navbar />

      <main className="max-w-2xl mx-auto px-6">
        {/* ─── Hero ─────────────────────────────────────────────── */}
        <section className="min-h-screen flex flex-col justify-center py-32">
          <div className="text-lg sm:text-2xl leading-relaxed">
            <div>
              <Typewriter
                text="> hi, i'm cade sarkin"
                speed={60}
                show={!line1Done}
                onComplete={() => setLine1Done(true)}
              />
            </div>
            {showLine2 && (
              <div className="mt-2 text-base sm:text-lg opacity-60">
                <Typewriter
                  text="software engineer. java/spring boot + react/next.js."
                  speed={40}
                  show={true}
                />
              </div>
            )}
          </div>
        </section>

        {/* ─── Work ─────────────────────────────────────────────── */}
        <section id="work" className="py-20">
          <div className="text-xs text-[#0d0d0d] opacity-40 mb-6 font-light">$ ls ./work</div>
          <div className="flex flex-col gap-3">
            {workItems.map((item) => (
              <Card
                key={item.title}
                name={item.title}
                description={item.cardDescription}
                tag={item.tag}
                onClick={() =>
                  setModal({
                    title: item.title,
                    description: item.description,
                    type: item.type,
                    liveUrl: item.liveUrl,
                    githubUrl: item.githubUrl,
                  })
                }
              />
            ))}
          </div>
        </section>

        {/* ─── Projects ─────────────────────────────────────────── */}
        <section id="projects" className="py-20">
          <div className="text-xs text-[#0d0d0d] opacity-40 mb-6 font-light">$ ls ./projects</div>
          <div className="flex flex-col gap-3">
            {projectItems.map((item) => (
              <Card
                key={item.title}
                name={item.title}
                description={item.cardDescription}
                tag={item.tag}
                onClick={() =>
                  setModal({
                    title: item.title,
                    description: item.description,
                    type: item.type,
                    liveUrl: item.liveUrl,
                    githubUrl: item.githubUrl,
                  })
                }
              />
            ))}
          </div>
        </section>

        {/* ─── Contact ──────────────────────────────────────────── */}
        <section id="contact" className="py-20 pb-32" ref={contactRef}>
          <div className="text-lg sm:text-xl mb-8">
            {contactStarted ? (
              <Typewriter text="> let's connect" speed={80} show={false} />
            ) : (
              <span className="opacity-0">placeholder</span>
            )}
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <a
              href="mailto:sarkincade@gmail.com"
              className="text-[#0d0d0d] hover:text-[#2563eb] transition-colors opacity-70 hover:opacity-100"
            >
              sarkincade@gmail.com
            </a>
            <a
              href="tel:+14796849353"
              className="text-[#0d0d0d] hover:text-[#2563eb] transition-colors opacity-70 hover:opacity-100"
            >
              +1 (479) 684-9353
            </a>
            <a
              href="https://github.com/cadesarkin"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0d0d0d] hover:text-[#2563eb] transition-colors opacity-70 hover:opacity-100"
            >
              github.com/cadesarkin
            </a>
            <a
              href="https://linkedin.com/in/cade-sarkin-4a2918222/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0d0d0d] hover:text-[#2563eb] transition-colors opacity-70 hover:opacity-100"
            >
              linkedin.com/in/cade-sarkin
            </a>
          </div>
        </section>
      </main>

      {/* ─── Modal ────────────────────────────────────────────── */}
      {modal && (
        <ProjectModal
          title={modal.title}
          description={modal.description}
          type={modal.type}
          liveUrl={modal.liveUrl}
          githubUrl={modal.githubUrl}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "D:\Cursor Projects\portfolio" && git add src/app/page.tsx && git commit -m "feat: rewrite page.tsx - single page terminal layout"
```

---

## Task 9: Delete old files (must come after Task 8 completes)

> **Important:** Only run this after Task 8 is fully committed. The current `page.tsx` imports `loading-screen.tsx` and `AsciiFireBackground.tsx` — deleting them before Task 8 rewrites `page.tsx` will break the build.

**Files:**
- Delete: `src/app/contact/page.tsx`
- Delete: `src/app/projects/page.tsx`
- Delete: `src/components/loading-screen.tsx`
- Delete: `src/components/AsciiFireBackground.tsx`

- [ ] **Step 1: Delete old page and component files**

```bash
cd "D:\Cursor Projects\portfolio" && rm src/app/contact/page.tsx src/app/projects/page.tsx src/components/loading-screen.tsx src/components/AsciiFireBackground.tsx
```

- [ ] **Step 2: Commit**

```bash
cd "D:\Cursor Projects\portfolio" && git add -A && git commit -m "chore: remove old pages and unused components"
```

---

## Task 10: Final verification

- [ ] **Step 1: Start dev server and verify the site loads**

```bash
cd "D:\Cursor Projects\portfolio" && npm run dev
```

Expected: Server starts on `http://localhost:3000` with no errors.

- [ ] **Step 2: Verify each section**

Check in browser:
- [ ] Page background is pale blue-white (`#eaeff5`), text is near-black
- [ ] Hero: line 1 types out with cursor, line 2 starts after a beat, cursor stays after line 2
- [ ] Navbar: flat, no background, links visible — clicking `work` / `projects` / `contact` smooth-scrolls
- [ ] Work section: Vance and Dreamhouse cards visible, clicking opens modal with iframe
- [ ] Projects section: three.js portfolio and matchplay cards visible, clicking opens modal with GitHub link
- [ ] Contact section: typewriter fires when scrolled into view, all links present
- [ ] Modal: closes on ✕, backdrop click, and Escape key
- [ ] Mobile: hamburger works, dropdown closes on link click

- [ ] **Step 3: Final commit**

```bash
cd "D:\Cursor Projects\portfolio" && git add -A && git commit -m "feat: portfolio redesign complete - terminal minimal aesthetic"
```
