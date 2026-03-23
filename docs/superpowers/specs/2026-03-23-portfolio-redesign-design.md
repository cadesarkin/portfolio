# Portfolio Redesign — Design Spec
**Date:** 2026-03-23
**Author:** Cade Sarkin
**Status:** Approved

---

## Overview

Redesign the existing portfolio site from a dark glassmorphism aesthetic to a minimal modern terminal style. The site becomes a single scrollable page with modal popups for project details. Work (client) and Projects (personal) are split into separate sections.

---

## Visual Direction

- **Background:** `#eaeff5` — pale blue-white
- **Text:** `#0d0d0d` — near black
- **Accent:** `#2563eb` — muted blue for links and hover states
- **Font:** IBM Plex Mono — weights `300`, `400`, `700` all loaded
- **Style:** Flat, no glassmorphism, no gradients, no fire animation
- **Terminal cues:** `$` / `>` prompt chars on headers, blinking cursor `█` after typewriter sequences, `1px` borders on cards/modals
- **Tags:** rendered as literal `[tag]` text in monospace (e.g. `[client]`, `[in progress]`) — no pill/badge styling
- **Smooth scroll:** `scroll-behavior: smooth` set on the `<html>` element in `layout.tsx`

---

## Architecture

Single scrollable page at `/`.
- `/contact` → redirects to `/#contact` via `next.config.ts`
- `/projects` → redirects to `/#projects` via `next.config.ts`
- `/resume` stays live, unchanged (out of scope)
- `next.config.js` is deleted; `next.config.ts` is the canonical config file

---

## Page Structure (top to bottom)

1. Navbar
2. Hero
3. Work section (`#work`)
4. Projects section (`#projects`)
5. Contact section (`#contact`)

---

## Section Designs

### Navbar
- Flat, fully transparent — no background, no blur, no border
- Left: `cade sarkin` in IBM Plex Mono plain text, links to `/#` (top of page)
- Right: text links `work · projects · contact` as `<a href="#work">` etc. smooth-scroll anchors. **Resume link intentionally omitted** — resume page stays live but is not linked from the main page navbar.
- Mobile: hamburger icon toggles a simple dropdown with `work`, `projects`, `contact` stacked vertically. Closes on any link click or click outside.

### Hero
- Centered layout, approx 40vh from top
- **Line 1 (typewriter):** `> hi, i'm cade sarkin`
  - Speed: 60ms/char
  - Starts immediately on page load
  - Cursor `█` visible and blinking during typing
- **Line 2 (typewriter):** `software engineer. java/spring boot + react/next.js.`
  - Speed: 40ms/char
  - Starts 400ms after line 1 completes
  - Cursor `█` visible and blinking during typing
  - After line 2 finishes, cursor remains blinking at 600ms interval permanently
- Line 1 cursor disappears when line 2 begins (cursor moves to active line)

### Work Section
- Anchor: `id="work"`
- Section header (static, no typewriter): `$ ls ./work`
- Two client cards:

| Name | Description | Tag | Live URL |
|---|---|---|---|
| Vance | clothing brand website | `[client]` | `https://vance-ad.com` |
| Dreamhouse | interior design studio website | `[client]` | `https://dreamhouse.nyc` |

### Projects Section
- Anchor: `id="projects"`
- Section header (static, no typewriter): `$ ls ./projects`
- Two personal project cards:

| Name | Description | Tag | GitHub URL |
|---|---|---|---|
| three.js portfolio | 3d graphics experiments | `[personal]` | `https://github.com/cadesarkin/threejs-learning-portfolio` |
| matchplay | golf scorecard app | `[in progress]` | `https://github.com/cadesarkin/matchplay` |

### Contact Section
- Anchor: `id="contact"`
- Header typewriter: `> let's connect` — speed: 80ms/char, triggers when section scrolls into view (IntersectionObserver, threshold 0.3)
- Plain links below:

| Label | Value | href |
|---|---|---|
| email | sarkincade@gmail.com | `mailto:sarkincade@gmail.com` |
| phone | +1 (479) 684-9353 | `tel:+14796849353` |
| github | github.com/cadesarkin | `https://github.com/cadesarkin` |
| linkedin | linkedin.com/in/cade-sarkin | `https://linkedin.com/in/cade-sarkin-4a2918222/` |

---

## Card Design (`Card.tsx`)

One shared card component used for both Work and Projects sections.

Props: `name`, `description`, `tag`, `onClick`

- Transparent background
- `1px solid #c8d4e0` border
- Padding: `1rem 1.25rem`
- Layout: `name` (font-weight 700) on one line, `description` below in weight 400, `tag` (e.g. `[client]`) below in weight 300, muted color
- Hover state: border color transitions to `#0d0d0d`
- Cursor: pointer
- Click: calls `onClick` to open modal

---

## Modal Design (`ProjectModal.tsx`)

One shared modal component handling both Work and Project types.

Props interface:
```ts
type ModalProps = {
  title: string
  description: string
  type: "work" | "project"
  liveUrl?: string    // work modals
  githubUrl?: string  // project modals
  onClose: () => void
}
```

- **Backdrop:** fixed overlay, `rgba(0,0,0,0.3)`, click to dismiss
- **Modal box:**
  - `max-width: 860px`, `width: 90vw`
  - `max-height: 80vh`, `overflow-y: auto`
  - Background: `#ffffff`
  - Border: `1px solid #0d0d0d`
  - No border-radius
- **Title bar:** `title` text left-aligned (weight 700) + `✕` button right-aligned, separated from body by `1px solid #0d0d0d` border-bottom
- **Body:**
  - Description paragraph
  - If `type === "work"` and `liveUrl` provided: render `<EmbeddedWebsite>` component (existing). Iframe container height: `500px` on desktop (`sm:` breakpoint), `300px` on mobile. The existing EmbeddedWebsite fallback (image + open-in-new-tab button) is acceptable as-is — its dark styling is a known limitation; no reskin in scope.
  - If `type === "project"` and `githubUrl` provided: render a plain text link to GitHub
  - **Matchplay specifically:** body text is `"golf scorecard app. currently in development."` + GitHub link only. No other detail.
- **Dismiss:** `✕` button, backdrop click, or `Escape` key
- **Animation:** fade-in + `scale(0.97) → scale(1)` over 150ms on open

---

## Typewriter Usage

| Location | Typewriter? | Speed | Trigger |
|---|---|---|---|
| Hero line 1 (`> hi, i'm cade sarkin`) | Yes | 60ms/char | Page load |
| Hero line 2 (one-liner) | Yes | 40ms/char | 400ms after line 1 ends |
| Contact header (`> let's connect`) | Yes | 80ms/char | IntersectionObserver (threshold 0.3) |
| Section headers (`$ ls ./work`, etc.) | No | — | — |
| Card text | No | — | — |
| Modal content | No | — | — |

---

## Removed Elements

- `AsciiFireBackground` component
- `LoadingScreen` component
- All glassmorphism styles
- `src/app/contact/page.tsx` (deleted; route redirected)
- `src/app/projects/page.tsx` (deleted; route redirected)
- `next.config.js` (deleted; `next.config.ts` is canonical)

---

## Files to Create / Modify

| File | Action |
|---|---|
| `src/app/page.tsx` | Rewrite — single page with all sections |
| `src/app/layout.tsx` | Update: bg `#eaeff5`, text `#0d0d0d`, load IBM Plex Mono weights 300/400/700, add `scroll-behavior: smooth` to `<html>` |
| `src/components/navbar.tsx` | Rewrite — flat minimal navbar |
| `src/components/loading-screen.tsx` | Delete |
| `src/components/AsciiFireBackground.tsx` | Delete |
| `src/app/contact/page.tsx` | Delete |
| `src/app/projects/page.tsx` | Delete |
| `src/components/Card.tsx` | Create — shared card for work + projects |
| `src/components/ProjectModal.tsx` | Create — terminal-window modal |
| `next.config.ts` | Add redirects: `/contact → /#contact`, `/projects → /#projects` |
| `next.config.js` | Delete |

---

## Out of Scope

- Resume page (`/resume`) — keep as-is
- Reskinning the `EmbeddedWebsite` fallback UI
- Any backend or data changes
