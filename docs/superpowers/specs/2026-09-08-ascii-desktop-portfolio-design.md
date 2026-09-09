# ASCII Desktop Portfolio — Design

**Date:** 2026-09-08
**Status:** Approved
**Supersedes:** the current single-page scrolling portfolio

---

## 1. Purpose

Replace the current scrolling portfolio with a desktop-metaphor interface: an
animated ASCII rendering of the Windows XP *Bliss* wallpaper, over which the
visitor opens folders, reads files, runs a working shell, and plays games.

The goal is not novelty for its own sake. The site is a hiring artifact for an
engineer who builds developer tooling, SDK generators and CLIs. A portfolio that
*is* a small operating system argues the point better than a page that describes
it. Every piece of content that exists today survives the move — it is
reorganised, not discarded.

### Success criteria

1. A visitor who never opens the terminal still finds every piece of content
   through folders alone.
2. A recruiter reaches the resume in at most two interactions from first paint.
3. Adding a client is a single object literal in one file, and updates the
   desktop, the folder view, the terminal's `ls`, and tab-completion together.
4. The page is fully indexable and screen-reader navigable despite being a
   client-rendered canvas app.
5. Phase 1 alone is a complete, shippable site.

### Non-goals

- Multi-window productivity fidelity (no snapping, tiling, or virtual desktops).
- Persisting a writable filesystem. The VFS is read-only; `touch` and `rm` are
  absent rather than faked.
- Emulating XP visually. The chrome is ASCII/terminal-native. See section 9.

---

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | Full replacement of `/`; delete `/resume` | One experience, no dead code |
| Chrome | ASCII-native — monospace, hairline borders, box-drawing | Coheres with the ASCII wallpaper; reads as engineering, not costume |
| Palette | Bright Bliss daylight; windows dark-on-frosted-light | Recognisably *the* wallpaper |
| Mobile | Real desktop, adapted — icon grid plus fullscreen sheets | The metaphor must survive on phones |
| Terminal | Full toy shell — VFS nav, completion, history, eggs | Completion and history separate a shell from a gimmick |
| Games | Cube Runner, Minesweeper, Snake, Pong | |
| Intro | Three-beat boot sequence, skippable, once per visitor | |
| State | `useReducer` plus context | About eight windows; a state library would be dead weight |
| Dependencies | None added at runtime | Canvas and DOM by hand |

---

## 3. Architecture

### 3.1 The virtual filesystem is the single source of truth

The central decision. One tree in `src/lib/vfs.ts` backs three surfaces —
desktop icons, folder windows, and the terminal — so they cannot drift apart.

```ts
type VNode = VDir | VFile | VApp | VLink

interface VBase {
  name: string          // path segment, e.g. "vance"
  label?: string        // display name, defaults to name
  tag?: string          // "[client]", "[in progress]"
  desc?: string         // one-line summary in list views
  icon?: IconKey
}

interface VDir  extends VBase { kind: 'dir';  children: VNode[] }
interface VFile extends VBase { kind: 'file'; ext: 'txt' | 'md' | 'json'; body: string }
interface VApp  extends VBase { kind: 'app';  app: AppKey }
interface VLink extends VBase { kind: 'link'; url: string }

type AppKey =
  | 'terminal' | 'resume' | 'contact'
  | 'cube-runner' | 'minesweeper' | 'snake' | 'pong'
```

`src/lib/vfs-utils.ts` holds the pure operations, and is the most heavily tested
module in the project:

```ts
resolve(path: string, cwd: string): VNode | null   // handles . .. ~ absolute relative
list(dir: VDir): VNode[]
pathOf(node: VNode): string
complete(partial: string, cwd: string): string[]   // powers tab-completion
search(query: string): VNode[]                     // powers `find`
```

Consequence: `open lore` in the terminal and double-clicking the Lore folder
dispatch the identical `OPEN` action against the identical node. There is no
second copy of the content and no synchronisation code.

### 3.2 Module layout

```
src/
  app/
    layout.tsx              fonts, metadata, JSON-LD
    page.tsx                <Desktop />
    globals.css
  lib/
    vfs.ts                  all content lives here
    vfs-utils.ts            pure path operations
    boot-script.ts          boot sequence lines
    use-window-keys.ts      focus-scoped keyboard subscription
  components/
    desktop/
      Desktop.tsx           composition root
      BlissCanvas.tsx       ported ASCII renderer
      BootSequence.tsx
      DesktopIcons.tsx
      Taskbar.tsx
      Window.tsx            chrome, drag, resize
      window-manager.tsx    context and reducer
      SeoContent.tsx        screen-reader-visible real content
    apps/
      FolderView.tsx
      TextView.tsx
      ResumeView.tsx
      ContactView.tsx
      Terminal.tsx
      terminal/
        commands.ts         command table, pure
        parse.ts            tokeniser, pure
      games/
        CubeRunner.tsx  Minesweeper.tsx  Snake.tsx  Pong.tsx
        engine/           pure game logic, tested separately
```

Rule: canvas and DOM effects live in components; rules and state transitions live
in plain modules beside them. Minesweeper's flood-fill and Snake's collision
logic are pure functions tested without rendering anything.

### 3.3 Window manager

```ts
interface Win {
  id: string          // === vfs path; guarantees dedupe
  node: VNode
  title: string
  rect: { x: number; y: number; w: number; h: number }
  z: number
  state: 'normal' | 'minimized' | 'maximized'
  prevRect?: Rect     // restore target
}
```

Actions: `OPEN | CLOSE | FOCUS | MOVE | RESIZE | MINIMIZE | MAXIMIZE | RESTORE`.

- `OPEN` on an existing id focuses and un-minimizes rather than duplicating.
- New windows cascade from a base offset, wrapping so they never march
  off-screen.
- `z` is a monotonic counter; focus assigns `++zTop`. Simple and sufficient.
- Drag and resize use pointer events with capture, writing to a ref during the
  gesture and committing to reducer state on release. This holds 60fps without
  re-rendering every window on every pointermove.

### 3.4 Keyboard ownership

Terminal, Snake, Cube Runner and Pong all want arrow keys. If each attaches its
own `window` listener, typing in the terminal steers the snake.

`useWindowKeys(winId, handler)` subscribes through the manager and fires only
when `winId` is the focused window. A single top-level `keydown` listener
dispatches to the focused subscriber. Global shortcuts (Escape to close,
Ctrl+backtick to open the terminal) are handled ahead of delegation.

---

## 4. Boot sequence

Three beats, about 2.6 seconds, any key skips. A `localStorage` flag sends
returning visitors straight to the desktop; `reboot` in the terminal replays it.
Skipped entirely under `prefers-reduced-motion`.

1. **POST** (~1.0s) — BIOS lines type out with `verified` / `ok` results. The
   "memory" line is computed from a start date of June 2023, so the joke stays
   accurate without maintenance.
2. **Mount** (~1.2s) — a progress bar fills while each top-level VFS directory
   mounts. Honest: this is when the app hydrates.
3. **Wake** (~0.4s) — the wallpaper renders in from a single expanding scanline,
   icons fade in staggered, the taskbar slides up.

```
  SARKIN BIOS v3.2
  -----------------------------
  cpu ....... verified
  memory .... 3 years, 3 months
  display ... ascii @ 30fps
  mounting /work ............ ok
  mounting /projects ........ ok
  loading bliss.wallpaper ... ok
  starting window manager ... ok
```

---

## 5. Content tree

```
~/
  work/
    vance/                  [client - 2021 to present]
      README.md             co-owner and sole developer
      vance-ad.com          store - Next.js, custom Stripe preorder
                            checkout, Postgres admin dashboard, CI/CD
      adborne.com           drop site - retro-arcade rebrand
    lore/                   [client] lore.nyc - worldbuilding-driven
                            clothing brand; narrative collections
    dreamhouse/             [client] dreamhouse.nyc - NYC design studio
    coming-soon/            [tbd]
  projects/
    mozaiq/                 zaiq.app - drag-and-drop dashboard builder
                            with AI generation; open source
    threejs-portfolio/      3D graphics experiments
    surveyai/               land survey workflow app (Next.js + Python)
  about/
    resume.pdf              opens ResumeView
    experience.txt          Fern, J.B. Hunt II/I/intern, KU
    skills.txt
  contact/                  email, phone, github, linkedin
  games/                    cube-runner, minesweeper, snake, pong
  terminal
```

Six desktop icons: `work`, `projects`, `about`, `contact`, `games`, `terminal`.

`about/` carries the Fern and J.B. Hunt history — the majority of the actual
professional experience, which has no client folder of its own and is invisible
on the current site outside the resume PDF.

The resume PDF is regenerated from `Cade-Sarkin-Resume.docx` via Word COM
automation and replaces the stale `public/resume.pdf` (dated Sep 2025).
`ResumeView` renders structured data — selectable, searchable, styled to match —
with the PDF offered as a download rather than embedded in an iframe.

---

## 6. Terminal

Prompt: `cade@portfolio:~$`

- **Navigation** — `ls [-l] [path]`, `cd <path>`, `pwd`, `cat <file>`, `tree`,
  `find <query>`
- **Windows** — `open <name>`, `close`, `clear`, `reboot`, `exit`
- **Content** — `whoami`, `resume`, `skills`, `experience`, `email`, `neofetch`
- **Shell** — `help`, `history`, `echo`, `date`, `theme <day|night>`
- **Eggs** — `sudo`, `matrix`, `cowsay`, `uptime`

Behaviour:

- **Tab completion** on command names in position 0 and VFS paths after, via
  `complete()`. Common-prefix completion; ambiguous matches list candidates.
- **History** with up/down arrows, persisted to `localStorage` across sessions.
- **Ctrl+C** abandons the line, **Ctrl+L** clears, **Ctrl+backtick** toggles the
  window.
- Unknown commands suggest the nearest match by edit distance
  (`lz: command not found. did you mean 'ls'?`).
- `neofetch` prints an ASCII portrait beside real stats pulled from the VFS
  (folder counts, years of experience, stack) — self-updating, not hardcoded.

`parse.ts` and `commands.ts` are pure: a command receives `(args, cwd, vfs)` and
returns `{ lines, cwd?, dispatch? }`. No DOM access, so the whole command set is
unit-testable without rendering a terminal.

---

## 7. Games

All four pause on window blur and on `document.hidden`, scope their keyboard via
`useWindowKeys`, keep a high score in `localStorage`, and restart without
reopening the window. Logic lives in `engine/` as pure reducers; components own
only canvas and input.

**Cube Runner** — perspective-projected wireframe plane, obstacles approaching
from the horizon, left/right to dodge, speed ramping with distance. Rendered in
wireframe and ASCII so it belongs to the wallpaper rather than sitting on top of
it.

**Minesweeper** — 9x9 with 10 mines. Right-click flags, chording on satisfied
numbers, timer and mine counter. First click is always safe, with mines placed
after it. Iterative flood-fill, not recursive, to avoid stack depth on large
opens.

**Snake** — rendered as glyphs on a character grid, so it reads as terminal
output. Fixed-tick loop decoupled from rAF; input queued per tick so a fast
double-tap cannot reverse the snake into itself.

**Pong** — mouse or left/right paddle against an AI with deliberately capped
tracking speed so it is beatable. First to 5.

---

## 8. Mobile

Below 768px the metaphor is preserved, not replaced.

- **Icons** — three-column grid, single tap to open, larger hit targets.
- **Windows** — become sheets: full width, about 88vh, sliding up from the
  bottom, with a back chevron and title bar. No drag, no resize, no z-stack; the
  sheet is modal and the taskbar lists what is open behind it.
- **Terminal** — a real focusable input drives the native keyboard; a compact key
  strip above it offers Tab, up, down and Ctrl+C, which are otherwise
  unreachable on a phone.
- **Games** — on-screen controls: a two-button pad for Cube Runner and Pong, a
  d-pad for Snake, tap and long-press for Minesweeper reveal and flag.
- **Wallpaper** — larger character cells and 20fps to keep the canvas cheap.

---

## 9. Visual system

ASCII-native chrome over the bright daylight wallpaper.

- **Type** — IBM Plex Mono throughout, already the site's font. 13px base in
  windows, 12px in the terminal.
- **Windows** — `rgba(250,252,255,0.82)` with `backdrop-filter: blur(10px)`, a
  1px `rgba(20,40,60,0.35)` border, no radius, and a single soft drop shadow to
  lift them off the hill. Dark text (`#0d1b26`) for contrast against bright sky.
- **Title bars** — 28px, hairline bottom rule, name at left, `[-][□][x]` as text
  glyphs at right. Focused windows take a stronger border and shadow; unfocused
  drop to 70% opacity.
- **Wallpaper palette** — sky `#2e7fd4` to `#d6efff`, hill `#4a9b2f` to
  `#cdea6b`, base `#0d2137`. A vignette keeps screen edges readable under
  windows.
- **Accent** — a single blue (`#1d6fd0`) for links, focus rings and selection.
- **Motion** — 120ms ease-out for open, close and focus. Everything suppressed
  under `prefers-reduced-motion`, including the wallpaper animation, which falls
  back to one static rendered frame.

---

## 10. Accessibility and SEO

Replacing the entire site with a client-rendered canvas app makes these
load-bearing rather than optional.

- `SeoContent.tsx` renders a real, semantic, screen-reader-visible document
  behind the desktop: `h1` name, role, every project with its links, the full
  experience list, and contact details. Visually hidden, never `display: none`.
  This is what Google indexes and what a screen reader reads.
- `Person` JSON-LD in `layout.tsx` with `sameAs` links.
- The canvas is `aria-hidden`.
- Icons are real buttons with labels; arrow keys move between them, Enter opens.
- Windows are `role="dialog"` with `aria-labelledby` on their title. Escape
  closes the focused window. Focus moves into a window on open and returns to its
  originating icon on close.
- Boot is skippable by any key and bypassed entirely under reduced motion.
- Games are explicitly out of scope for keyboard-free access; each carries a
  short text description of what it is so the folder still makes sense.

---

## 11. Performance

- The wallpaper is the only continuous cost: 30fps desktop, 20fps mobile.
- The rAF loop pauses on `document.hidden` and when a maximized window fully
  covers the viewport — nothing visible, nothing drawn.
- The existing renderer's run-length batching of fills and glyph draws is kept
  as-is; it is already the reason it holds 30fps.
- Drag and resize write to refs during the gesture and commit on release.
- Games render only while their window is focused and un-minimized.

---

## 12. Testing

The repository currently has no test infrastructure. Adding a full UI harness
would be disproportionate. Vitest is added for pure logic only — which is where
the bugs actually are:

- `vfs-utils` — path resolution across `.`, `..`, `~`, absolute, relative,
  trailing slashes and missing nodes; completion candidates and common prefixes.
- `terminal/parse` — tokenising, quoting, flags, empty input.
- `terminal/commands` — each command's output and cwd transitions against a
  fixture tree.
- `games/engine` — Minesweeper first-click safety, flood-fill boundaries, win
  detection; Snake self-collision, growth, input queueing.

Canvas rendering, drag behaviour and mobile sheets are verified by running the
dev server and exercising them directly.

---

## 13. Migration

**Removed:** `src/app/resume/page.tsx`, `components/navbar.tsx`,
`components/Card.tsx`, `components/ProjectModal.tsx`,
`components/EmbeddedWebsite.tsx` (already unimported), and the scrolling body of
`page.tsx`. `components/typewriter.tsx` is kept and reused by the boot sequence.

**Preserved:** every work and project entry, all four contact links, and the
resume (regenerated). Nothing on the current site is lost — it moves into the
tree in section 5.

**Assets:** unused logo PNGs in `public/` are audited and removed once the new
tree is in place.

---

## 14. Phasing

Each phase leaves the site in a shippable state.

| Phase | Contents | Outcome |
|---|---|---|
| **1** | Bliss canvas, VFS, window manager, folders, text/resume/contact views, taskbar, boot, SEO block | Complete site, live |
| **2** | Terminal — parse, commands, completion, history, eggs | |
| **3** | Cube Runner, Minesweeper, Snake, Pong | |
| **4** | Mobile sheets, on-screen controls, a11y pass, asset cleanup | |

---

## 15. Risks

| Risk | Mitigation |
|---|---|
| Recruiters bounce off the metaphor | Resume reachable in two clicks; SEO block carries everything in plain text |
| Wallpaper drains battery on mobile | 20fps, larger cells, pause when hidden, static under reduced motion |
| Keyboard conflicts between apps | Focus-scoped delegation (3.4), designed in rather than patched |
| Scope creep across four games | Pure engines; phase 3 is independently droppable |
| Client-rendered content invisible to crawlers | `SeoContent` plus JSON-LD, built in phase 1, not deferred |
