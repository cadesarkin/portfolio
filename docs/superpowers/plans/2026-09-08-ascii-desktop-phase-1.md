# ASCII Desktop Portfolio — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scrolling portfolio at `/` with a working ASCII-Bliss desktop — boot sequence, wallpaper, draggable windows, folders, resume, contact — that is complete and shippable without the terminal or games.

**Architecture:** A single read-only virtual filesystem (`src/lib/vfs.ts`) is the source of truth for all content. Desktop icons, folder windows, and (in Phase 2) the terminal all resolve against it, so the surfaces cannot drift. Window state is a `useReducer` + context keyed by VFS path, which makes open-dedupe free. Pure logic (path resolution, the window reducer) is unit-tested; canvas and pointer behaviour is verified by running the app.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind 3, IBM Plex Mono. Vitest added for unit tests. No runtime dependencies added.

**Spec:** `docs/superpowers/specs/2026-09-08-ascii-desktop-portfolio-design.md`

## Global Constraints

- **No new runtime dependencies.** Canvas and DOM by hand. Vitest is `devDependencies` only.
- **All content lives in `src/lib/vfs.ts`.** No component hardcodes a project name, URL, or description. Adding a client must be one object literal.
- **Window `id` is always the VFS path.** This is what guarantees open-dedupe; never generate a random id.
- **Never attach a bare `window.addEventListener('keydown')` in an app component.** All app-level keys route through `useWindowKeys` (Task 4). Global shortcuts are the single exception and live in `Desktop.tsx`.
- **Palette (exact values):** sky `#2e7fd4` → `#d6efff`, hill `#4a9b2f` → `#cdea6b`, base `#0d2137`, window fill `rgba(250,252,255,0.82)`, window border `rgba(20,40,60,0.35)`, text `#0d1b26`, accent `#1d6fd0`.
- **`prefers-reduced-motion`** suppresses the boot sequence, the wallpaper animation (one static frame instead), and all window transitions.
- **Client components only where needed.** `layout.tsx` stays a server component so metadata and JSON-LD are server-rendered.
- **Commit after every task.**

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/vfs-types.ts` | `VNode` union, `AppKey`, `IconKey`. No data. |
| `src/lib/vfs.ts` | The content tree. The only file edited to add work. |
| `src/lib/vfs-utils.ts` | Pure path ops: `resolve`, `list`, `pathOf`, `complete`, `search`. |
| `src/lib/bliss-palette.ts` | Palette constants, shared by canvas and CSS. |
| `src/components/desktop/window-manager.tsx` | Reducer, context, `useWindows()`. |
| `src/components/desktop/window-reducer.ts` | Pure reducer + `Win` type. Tested. |
| `src/components/desktop/use-window-keys.ts` | Focus-scoped keyboard subscription. |
| `src/components/desktop/BlissCanvas.tsx` | Ported ASCII wallpaper renderer. |
| `src/components/desktop/Window.tsx` | Chrome, drag, resize, focus. |
| `src/components/desktop/DesktopIcons.tsx` | Root icon grid, arrow-key navigation. |
| `src/components/desktop/Taskbar.tsx` | Open-window buttons, clock. |
| `src/components/desktop/BootSequence.tsx` | Three-beat intro. |
| `src/components/desktop/SeoContent.tsx` | Screen-reader/crawler content. |
| `src/components/desktop/Desktop.tsx` | Composition root, global shortcuts. |
| `src/components/apps/AppHost.tsx` | Maps a `VNode` to its view component. |
| `src/components/apps/FolderView.tsx` | Lists a `VDir`. |
| `src/components/apps/TextView.tsx` | Renders a `VFile`. |
| `src/components/apps/ContactView.tsx` | Contact links. |
| `src/components/apps/ResumeView.tsx` | Structured resume + PDF download. |
| `src/app/page.tsx` | Renders `<Desktop />`. |
| `src/app/layout.tsx` | Metadata, JSON-LD, font. |

---

## Task 1: Test infrastructure and the VFS

**Files:**
- Create: `src/lib/vfs-types.ts`, `src/lib/vfs.ts`, `src/lib/vfs-utils.ts`
- Create: `src/lib/vfs-utils.test.ts`, `vitest.config.ts`
- Modify: `package.json` (add vitest, `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `VNode`, `VDir`, `VFile`, `VApp`, `VLink`, `AppKey`, `IconKey` from `vfs-types`; `root: VDir` from `vfs`; `resolve(path, cwd)`, `list(dir)`, `pathOf(node)`, `complete(partial, cwd)`, `search(query)` from `vfs-utils`.

- [ ] **Step 1: Install vitest and add the test script**

```bash
npm i -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

- [ ] **Step 2: Define the node types**

`src/lib/vfs-types.ts`:

```ts
export type AppKey =
  | 'terminal' | 'resume' | 'contact'
  | 'cube-runner' | 'minesweeper' | 'snake' | 'pong'

export type IconKey =
  | 'folder' | 'file' | 'terminal' | 'resume' | 'contact' | 'game' | 'link'

export interface VBase {
  name: string
  label?: string
  tag?: string
  desc?: string
  icon?: IconKey
}

export interface VDir  extends VBase { kind: 'dir';  children: VNode[] }
export interface VFile extends VBase { kind: 'file'; ext: 'txt' | 'md'; body: string }
export interface VApp  extends VBase { kind: 'app';  app: AppKey }
export interface VLink extends VBase { kind: 'link'; url: string }

export type VNode = VDir | VFile | VApp | VLink

export const isDir = (n: VNode): n is VDir => n.kind === 'dir'
```

- [ ] **Step 3: Write the failing tests for path resolution**

`src/lib/vfs-utils.test.ts`. These cover the cases that actually break: `..` past root, `~`, trailing slashes, missing nodes, and completion prefixes.

```ts
import { describe, it, expect } from 'vitest'
import { resolve, pathOf, complete, search } from './vfs-utils'
import { root } from './vfs'

describe('resolve', () => {
  it('returns root for ~ and /', () => {
    expect(resolve('~', '/')).toBe(root)
    expect(resolve('/', '/')).toBe(root)
  })

  it('resolves an absolute path', () => {
    expect(resolve('/work', '/')?.name).toBe('work')
  })

  it('resolves a relative path from cwd', () => {
    expect(resolve('vance', '/work')?.name).toBe('vance')
  })

  it('ignores a trailing slash', () => {
    expect(resolve('/work/', '/')?.name).toBe('work')
  })

  it('handles . and ..', () => {
    expect(resolve('./vance', '/work')?.name).toBe('vance')
    expect(resolve('..', '/work/vance')?.name).toBe('work')
  })

  it('clamps .. at root instead of escaping', () => {
    expect(resolve('../../../..', '/work')).toBe(root)
  })

  it('returns null for a missing node', () => {
    expect(resolve('/nope', '/')).toBeNull()
  })

  it('returns null when descending into a non-directory', () => {
    expect(resolve('/about/skills.txt/deeper', '/')).toBeNull()
  })
})

describe('pathOf', () => {
  it('round-trips with resolve', () => {
    const n = resolve('/work/vance', '/')!
    expect(resolve(pathOf(n), '/')).toBe(n)
  })

  it('returns / for root', () => {
    expect(pathOf(root)).toBe('/')
  })
})

describe('complete', () => {
  it('completes a unique prefix to the full name', () => {
    expect(complete('/wo', '/')).toEqual(['work'])
  })

  it('lists all children for an empty partial', () => {
    expect(complete('', '/').length).toBeGreaterThan(3)
  })

  it('returns every candidate when ambiguous', () => {
    const hits = complete('/work/', '/')
    expect(hits).toContain('vance')
    expect(hits).toContain('lore')
  })

  it('returns nothing for an unmatchable prefix', () => {
    expect(complete('/zzz', '/')).toEqual([])
  })
})

describe('search', () => {
  it('finds a node by partial name', () => {
    expect(search('moz').map(n => n.name)).toContain('mozaiq')
  })

  it('is case-insensitive', () => {
    expect(search('MOZ').map(n => n.name)).toContain('mozaiq')
  })
})
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `npm test`
Expected: FAIL — `vfs-utils` and `vfs` do not exist.

- [ ] **Step 5: Write the content tree**

`src/lib/vfs.ts`. Content is transcribed from spec section 5, the current `src/app/page.tsx` arrays, and `Cade-Sarkin-Resume.docx`. Every `desc` is one line; `body` fields use real prose, never lorem.

Structure to build (`root: VDir`, `name: ''`):

- `work/` (icon `folder`)
  - `vance/` tag `[client]` desc `designer clothing brand — co-owner & sole developer`
    - `README.md` — co-owner since 2021; full-stack e-commerce on React/Next.js/Vercel, custom Stripe preorder checkout with payment holds, order queuing and fulfillment tracking, Postgres admin dashboard, CI/CD.
    - `vance-ad.com` link `https://vance-ad.com` desc `the store`
    - `adborne.com` link `https://adborne.com` desc `drop site — retro-arcade rebrand`
  - `lore/` tag `[client]` desc `worldbuilding-driven clothing brand`
    - `README.md` — NYC label building narrative collections (FW25 The Silver Plains, SS26 The Red Desert, Metallurgy); storefront and collection architecture.
    - `lore.nyc` link `https://lore.nyc`
  - `dreamhouse/` tag `[client]` desc `creative design studio, NYC`
    - `README.md`, `dreamhouse.nyc` link `https://dreamhouse.nyc`
  - `coming-soon/` tag `[tbd]` desc `next client — announcement pending`
    - `README.md` body: a short "something is being built here" note.
- `projects/`
  - `mozaiq/` tag `[in progress]` desc `drag-and-drop dashboard builder with AI generation`
    - `README.md`, link `https://zaiq.app`, link `https://github.com/zaiqapp/mozaiq`
  - `threejs-portfolio/` tag `[personal]` desc `3d graphics experiments`
    - `README.md`, link to the live site and the GitHub repo
  - `surveyai/` tag `[personal]` desc `land survey workflow app (Next.js + Python)`
    - `README.md`
- `about/`
  - `resume.pdf` — `{ kind: 'app', app: 'resume', icon: 'resume' }`
  - `experience.txt` — Fern (Jun 2026–present), J.B. Hunt II (Sep 2024–Mar 2026), J.B. Hunt I (Jun 2023–Sep 2024), intern/team lead (2021, 2022), KU BSCS 2023. Bullets lifted from the resume.
  - `skills.txt` — the resume's five skill lines (Languages, SDK Codegen, Frameworks, Infrastructure, Developer Tooling).
- `contact/` — `{ kind: 'app', app: 'contact', icon: 'contact' }`
- `games/` — four `VApp` children (`cube-runner`, `minesweeper`, `snake`, `pong`), each with a `desc`. Phase 3 implements them; Phase 1 ships the folder with a "not yet installed" placeholder view so the folder is never empty or broken.
- `terminal` — `{ kind: 'app', app: 'terminal', icon: 'terminal' }`. Phase 2 implements it; Phase 1 shows the same placeholder.

- [ ] **Step 6: Implement the path utilities**

`src/lib/vfs-utils.ts`. Notes that matter:

- Build a parent map once at module load by walking `root`; `pathOf` uses it. Do not store parent pointers on the nodes themselves — that makes `vfs.ts` cyclic and unpleasant to edit.
- `resolve` splits on `/`, drops empty segments and `.`, pops on `..` (clamping at root, never below), and returns `null` the moment a segment names a child that does not exist *or* descends into a non-`dir`.
- `complete` splits `partial` into a directory part and a leaf prefix, resolves the directory part, and filters its children by `startsWith`.
- `search` walks the whole tree case-insensitively on `name` and `label`.

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS, all cases green.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib
git commit -m "feat: virtual filesystem as single source of truth for site content"
```

---

## Task 2: Bliss wallpaper canvas

**Files:**
- Create: `src/lib/bliss-palette.ts`, `src/components/desktop/BlissCanvas.tsx`
- Reference: `C:/Users/Cade Sarkin/Downloads/bliss-ascii (1).html`

**Interfaces:**
- Consumes: nothing.
- Produces: `<BlissCanvas paused?: boolean />`; `PALETTE` from `bliss-palette`.

- [ ] **Step 1: Extract the palette**

`src/lib/bliss-palette.ts` exports the exact values from Global Constraints, plus the sky/hill gradient endpoints as RGB triples for the shader.

- [ ] **Step 2: Port the renderer**

Copy the IIFE from the source HTML into a `useEffect` in a `'use client'` component. Preserve verbatim: `hash`, `vnoise`, `fbm`, `ss`, `lerp`, `hillY`, the run-length batching in `draw`, and the resize/DPR handling. These are why it holds 30fps — do not "clean them up".

Changes to make:

1. **Palette** — swap the `shade` colour ramps to the bright daylight values. Sky lerps `#2e7fd4 → #d6efff`, hill `#4a9b2f → #cdea6b`, base `#0d2137`. Raise `bgMix` to ~0.35 so blank cells read as bright sky rather than near-black.
2. **Lifecycle** — cancel the rAF on unmount, debounce resize as the original does, and store mutable state in refs, never React state.
3. **Pause** — halt the loop when `document.hidden` or the `paused` prop is true. `paused` is driven by a maximized window covering the viewport.
4. **Reduced motion** — render exactly one frame at `T = 12` and never start the loop.
5. **Mobile** — 20fps and `fontSize` 9 below 600px (the source already steps font size; add the fps step).
6. `aria-hidden="true"` on the canvas, `position: fixed; inset: 0; z-index: 0`.

- [ ] **Step 3: Verify visually**

Run `npm run dev`, open `/` with the canvas temporarily mounted from `page.tsx`. Confirm: recognisable hill and sky, clouds drifting left-to-right, grass rippling, no seams on resize, and that it holds 30fps in devtools. Toggle OS reduced-motion and confirm it renders one static frame.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bliss-palette.ts src/components/desktop/BlissCanvas.tsx
git commit -m "feat: ASCII bliss wallpaper canvas in daylight palette"
```

---

## Task 3: Window reducer

**Files:**
- Create: `src/components/desktop/window-reducer.ts`, `src/components/desktop/window-reducer.test.ts`

**Interfaces:**
- Consumes: `VNode`, `pathOf` from Task 1.
- Produces: `Win`, `Rect`, `WindowState`, `WindowAction`, `windowReducer(state, action)`, `initialWindowState`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { windowReducer as r, initialWindowState as init } from './window-reducer'
import { resolve } from '@/lib/vfs-utils'

const work = resolve('/work', '/')!
const projects = resolve('/projects', '/')!
const open = (s: typeof init, n = work) => r(s, { type: 'OPEN', node: n })

describe('windowReducer', () => {
  it('opens a window keyed by vfs path', () => {
    const s = open(init)
    expect(s.wins).toHaveLength(1)
    expect(s.wins[0].id).toBe('/work')
    expect(s.focused).toBe('/work')
  })

  it('does not duplicate an already-open window', () => {
    const s = open(open(init))
    expect(s.wins).toHaveLength(1)
  })

  it('focuses and restores an open, minimized window instead of duplicating', () => {
    let s = open(init)
    s = r(s, { type: 'MINIMIZE', id: '/work' })
    s = open(s)
    expect(s.wins).toHaveLength(1)
    expect(s.wins[0].state).toBe('normal')
    expect(s.focused).toBe('/work')
  })

  it('raises z on focus so the focused window is always topmost', () => {
    let s = open(init)
    s = open(s, projects)
    s = r(s, { type: 'FOCUS', id: '/work' })
    const top = [...s.wins].sort((a, b) => b.z - a.z)[0]
    expect(top.id).toBe('/work')
    expect(s.focused).toBe('/work')
  })

  it('cascades new windows so they do not stack exactly', () => {
    let s = open(init)
    s = open(s, projects)
    expect(s.wins[1].rect.x).not.toBe(s.wins[0].rect.x)
  })

  it('restores to the pre-maximize rect', () => {
    let s = open(init)
    const before = s.wins[0].rect
    s = r(s, { type: 'MAXIMIZE', id: '/work' })
    expect(s.wins[0].state).toBe('maximized')
    s = r(s, { type: 'RESTORE', id: '/work' })
    expect(s.wins[0].rect).toEqual(before)
  })

  it('focuses the next-highest window when the focused one closes', () => {
    let s = open(init)
    s = open(s, projects)
    s = r(s, { type: 'CLOSE', id: '/projects' })
    expect(s.focused).toBe('/work')
  })

  it('clears focus when the last window closes', () => {
    let s = open(init)
    s = r(s, { type: 'CLOSE', id: '/work' })
    expect(s.wins).toHaveLength(0)
    expect(s.focused).toBeNull()
  })

  it('ignores actions targeting an unknown id', () => {
    const s = r(open(init), { type: 'CLOSE', id: '/nope' })
    expect(s.wins).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm test src/components/desktop/window-reducer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the reducer**

Pure, no DOM reads. `WindowState` is `{ wins: Win[], focused: string | null, zTop: number }`. Default rects come from a per-`AppKey` size table (terminal 720x420, resume 760x600, folders 620x400, games sized per game) with a cascade offset of 28px that wraps every 8 windows. Link nodes never open a window — `OPEN` on a `VLink` is a no-op at this layer; `AppHost` handles the navigation.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/desktop/window-reducer.ts src/components/desktop/window-reducer.test.ts
git commit -m "feat: window manager reducer with path-keyed dedupe and z-ordering"
```

---

## Task 4: Window manager context and focus-scoped keys

**Files:**
- Create: `src/components/desktop/window-manager.tsx`, `src/components/desktop/use-window-keys.ts`

**Interfaces:**
- Consumes: everything from Task 3.
- Produces: `<WindowProvider>`, `useWindows(): { wins, focused, open(node), close(id), focus(id), move(id, rect), resize(id, rect), minimize(id), maximize(id), restore(id) }`, and `useWindowKeys(winId, handler)`.

- [ ] **Step 1: Build the provider**

`'use client'`. `useReducer(windowReducer, initialWindowState)`, wrapped in a context. Action creators are memoised with `useCallback` so window components do not re-render on every dispatch identity change.

- [ ] **Step 2: Build focus-scoped key delegation**

This is the piece that prevents the terminal and Snake from fighting over arrow keys.

- The provider keeps a `Map<string, (e: KeyboardEvent) => void>` in a ref.
- `useWindowKeys(winId, handler)` registers on mount, unregisters on unmount, and keeps the handler in a ref so callers need not memoise it.
- One `keydown` listener on `document`, installed by the provider, looks up `focused` and invokes only that window's handler.
- If the event target is an `input` or `textarea` inside a *different* window, do nothing.

- [ ] **Step 3: Verify manually**

Temporarily render two windows that each log their key events; confirm only the focused one logs.

- [ ] **Step 4: Commit**

```bash
git add src/components/desktop/window-manager.tsx src/components/desktop/use-window-keys.ts
git commit -m "feat: window context and focus-scoped keyboard delegation"
```

---

## Task 5: Window chrome — drag, resize, focus

**Files:**
- Create: `src/components/desktop/Window.tsx`
- Modify: `src/app/globals.css` (window tokens, `.sr-only`)

**Interfaces:**
- Consumes: `useWindows` from Task 4.
- Produces: `<Window win={win}>{children}</Window>`.

- [ ] **Step 1: Build the chrome**

Per spec section 9: `rgba(250,252,255,0.82)` fill, `backdrop-filter: blur(10px)`, 1px `rgba(20,40,60,0.35)` border, no radius, one soft shadow. 28px title bar, label left, `[-][□][x]` as monospace text buttons right. Unfocused windows drop to 70% opacity and a lighter border.

- [ ] **Step 2: Implement drag**

Pointer events on the title bar with `setPointerCapture`. During the gesture write directly to `el.style.transform` via a ref — do **not** dispatch on every `pointermove`, or all windows re-render 60 times a second. Commit the final rect with `move()` on `pointerup`. Clamp so at least 80px of title bar stays on screen. Double-clicking the title bar toggles maximize.

- [ ] **Step 3: Implement resize**

A 12px bottom-right grip using the same ref-write-then-commit pattern. Minimum 320x200.

- [ ] **Step 4: Wire accessibility**

`role="dialog"`, `aria-labelledby` pointing at the title element, `tabIndex={-1}`. Focus the window body on open; return focus to the originating icon on close (the manager stores the opener's element id). Escape closes the focused window — registered through `useWindowKeys`, not a bare listener.

- [ ] **Step 5: Verify manually**

Open several windows. Confirm: dragging is smooth with no jitter, clicking any part of a window raises it, maximize/restore round-trips to the same rect, Escape closes only the focused window, and windows cannot be dragged fully off-screen.

- [ ] **Step 6: Commit**

```bash
git add src/components/desktop/Window.tsx src/app/globals.css
git commit -m "feat: draggable resizable window chrome in ASCII-native style"
```

---

## Task 6: App views

**Files:**
- Create: `src/components/apps/AppHost.tsx`, `FolderView.tsx`, `TextView.tsx`, `ContactView.tsx`, `ResumeView.tsx`, `PlaceholderView.tsx`

**Interfaces:**
- Consumes: `VNode` (Task 1), `useWindows` (Task 4).
- Produces: `<AppHost node={node} />`.

- [ ] **Step 1: Build AppHost**

Switch on `node.kind`, then on `node.app` for `VApp`. `dir → FolderView`, `file → TextView`, `app: 'contact' → ContactView`, `app: 'resume' → ResumeView`, and `terminal`/game keys → `PlaceholderView` until Phases 2–3 land. A `VLink` never reaches here.

- [ ] **Step 2: Build FolderView**

Lists `node.children` as rows: icon glyph, name (directories get a trailing `/`), `desc` in muted text, `tag` right-aligned. Single click selects, double click opens (single tap opens on touch). `VLink` children open in a new tab with `rel="noopener noreferrer"` and carry a `↗` affordance. Footer shows `N items`. Keyboard: up/down move selection, Enter opens, via `useWindowKeys`.

- [ ] **Step 3: Build TextView**

Monospace, preserved whitespace, ~72ch measure, scrollable. Renders `body` as plain text — no markdown parser (YAGNI; the bodies are written to read well as plain text). Bare URLs are linkified with a small regex.

- [ ] **Step 4: Build ContactView**

Four rows — email (`mailto:`), phone (`tel:`), GitHub, LinkedIn — as a terminal-style key/value list. A copy button per row using `navigator.clipboard` with a transient `copied` state. Values come from the VFS node, not hardcoded.

- [ ] **Step 5: Build ResumeView**

Renders the structured resume from `vfs.ts` (summary, skills, experience, education) as selectable styled text, with a prominent `download resume.pdf` link to `/resume.pdf`. Not an iframe — an embedded PDF viewer is unstyleable, breaks on mobile, and is not selectable.

- [ ] **Step 6: Build PlaceholderView**

For nodes whose app is not yet implemented: shows the node's `desc` plus `not yet installed — coming in a later build`. This keeps the games folder honest rather than broken in Phase 1.

- [ ] **Step 7: Verify manually**

Open every folder and file in the tree. Confirm no view crashes, external links open in a new tab, and copy-to-clipboard works.

- [ ] **Step 8: Commit**

```bash
git add src/components/apps
git commit -m "feat: folder, text, contact, and resume window views"
```

---

## Task 7: Desktop shell — icons and taskbar

**Files:**
- Create: `src/components/desktop/DesktopIcons.tsx`, `Taskbar.tsx`, `Desktop.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: `<Desktop />`.

- [ ] **Step 1: Build DesktopIcons**

Renders `root.children` as a left-aligned column of icon buttons (grid on mobile). Each is a real `<button>` with an ASCII/box-drawing glyph above its label, a text shadow so labels stay readable against bright sky, and a visible focus ring in the accent colour. Double click (or single tap) opens. Arrow keys move between icons, Enter opens.

- [ ] **Step 2: Build Taskbar**

Fixed bottom bar, 32px, same frosted treatment as windows. Left: a `~` home button that minimizes everything. Middle: one button per open window, showing its title, depressed when focused, click to focus or minimize. Right: a live clock (`HH:MM`) updated on a one-second interval that is cleared on unmount.

- [ ] **Step 3: Build Desktop**

Composition root, `'use client'`. Layers: `BlissCanvas` (z 0), `SeoContent`, `DesktopIcons` (z 10), windows sorted by `z` (z 20+), `Taskbar` (z 100), `BootSequence` (z 1000). Wraps everything in `WindowProvider`. Owns the two global shortcuts: Escape closes the focused window, Ctrl+backtick opens the terminal. Computes the `paused` prop for `BlissCanvas` when a maximized window is present.

- [ ] **Step 4: Replace the page**

`src/app/page.tsx` becomes `export default function Page() { return <Desktop /> }`. Delete the old scrolling markup and the `workItems`/`projectItems` arrays — that content now lives in `vfs.ts`.

- [ ] **Step 5: Verify manually**

Open, focus, minimize, maximize, restore, and close windows from both the icons and the taskbar. Confirm the taskbar reflects state accurately and the clock ticks.

- [ ] **Step 6: Commit**

```bash
git add src/components/desktop src/app/page.tsx
git commit -m "feat: desktop shell with icons, taskbar, and window layering"
```

---

## Task 8: Boot sequence

**Files:**
- Create: `src/lib/boot-script.ts`, `src/components/desktop/BootSequence.tsx`
- Modify: `src/components/desktop/Desktop.tsx`

**Interfaces:**
- Consumes: `root` (Task 1).
- Produces: `<BootSequence onDone={() => void} />`.

- [ ] **Step 1: Write the boot script**

`boot-script.ts` exports the POST lines. The memory line is computed, not hardcoded:

```ts
export function tenure(from = new Date(2023, 5, 1), now = new Date()) {
  const months = (now.getFullYear() - from.getFullYear()) * 12
    + (now.getMonth() - from.getMonth())
  const y = Math.floor(months / 12), m = months % 12
  return `${y} year${y === 1 ? '' : 's'}, ${m} month${m === 1 ? '' : 's'}`
}
```

Mount lines are derived from `root.children`, so adding a top-level folder adds a boot line automatically.

- [ ] **Step 2: Build the three beats**

Full-screen black overlay, accent-green monospace text. POST lines type out (reuse the existing `components/typewriter.tsx`) at ~1.0s total; the mount bar fills over ~1.2s; then a ~0.4s wake where the overlay wipes via an expanding `clip-path` scanline while icons fade in staggered by 40ms each and the taskbar slides up.

- [ ] **Step 3: Wire skip and persistence**

Any keydown, click, or touch skips to done. On completion set `localStorage['booted'] = '1'`; on mount, skip entirely if that flag is set or if `prefers-reduced-motion` matches. Guard `localStorage` in a try/catch — it throws in some privacy modes. Expose a `reboot()` that clears the flag and replays, for the Phase 2 terminal command.

- [ ] **Step 4: Verify manually**

Hard-reload with `localStorage` cleared and confirm the full sequence. Reload again and confirm it is skipped. Confirm any key skips mid-sequence, and that reduced motion bypasses it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/boot-script.ts src/components/desktop/BootSequence.tsx src/components/desktop/Desktop.tsx
git commit -m "feat: three-beat boot sequence with skip and once-per-visitor persistence"
```

---

## Task 9: SEO, accessibility, and cleanup

**Files:**
- Create: `src/components/desktop/SeoContent.tsx`
- Modify: `src/app/layout.tsx`
- Delete: `src/app/resume/page.tsx`, `src/components/navbar.tsx`, `src/components/Card.tsx`, `src/components/ProjectModal.tsx`, `src/components/EmbeddedWebsite.tsx`

**Interfaces:**
- Consumes: `root` (Task 1).
- Produces: `<SeoContent />`.

- [ ] **Step 1: Build SeoContent**

Walks the VFS and emits a real semantic document — `h1` name and role, a section per top-level folder, every project with its live and repo links as real `<a>` elements, the full experience list, and contact details. Wrapped in `.sr-only` (clipped, **not** `display: none`, which would hide it from assistive tech and risk being treated as cloaking). Because it is generated from the VFS, it cannot go stale.

- [ ] **Step 2: Update metadata and add JSON-LD**

In `layout.tsx` (kept a server component): a real `description`, `openGraph` and `twitter` cards, `metadataBase`, and a `Person` JSON-LD script with `name`, `jobTitle`, `email`, `url`, and `sameAs` for GitHub and LinkedIn. Set `<html>` background to the wallpaper base `#0d2137` so there is no white flash before the canvas paints.

- [ ] **Step 3: Delete the old site**

Remove the five files listed above and `src/app/resume/`. Keep `typewriter.tsx` — the boot sequence uses it.

- [ ] **Step 4: Audit public assets**

Grep `public/` filenames against `src/`. Delete logo PNGs no longer referenced. Keep `resume.pdf`, `profile.jpeg`, and `favicon.ico`.

- [ ] **Step 5: Verify the build**

```bash
npm run build && npm run lint && npm test
```
Expected: clean build, no lint errors, all tests pass. Confirm no dangling imports from deleted files.

- [ ] **Step 6: Check the rendered HTML contains real content**

```bash
npm run build && npm start
curl -s localhost:3000 | grep -i "Cade Sarkin"
```
Expected: name, role, and project links present in the server-rendered HTML.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: SEO content block, JSON-LD, and removal of the old scrolling site"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| 3.1 VFS as source of truth | 1 |
| 3.2 Module layout | 1–9 |
| 3.3 Window manager | 3, 4 |
| 3.4 Keyboard ownership | 4 |
| 4 Boot sequence | 8 |
| 5 Content tree | 1 |
| 6 Terminal | Phase 2 — placeholder in 6 |
| 7 Games | Phase 3 — placeholder in 6 |
| 8 Mobile | Phase 4 — responsive basics in 5, 7 |
| 9 Visual system | 2, 5, 7 |
| 10 A11y and SEO | 5, 7, 9 |
| 11 Performance | 2, 5 |
| 12 Testing | 1, 3 |
| 13 Migration | 9 |

**Type consistency:** `VNode`/`VDir`/`VFile`/`VApp`/`VLink` and `AppKey` are defined once in Task 1 and used unchanged throughout. `Win`, `Rect`, `WindowAction` are defined in Task 3 and consumed in 4, 5 and 7. `useWindows()`'s returned method names (`open`, `close`, `focus`, `move`, `resize`, `minimize`, `maximize`, `restore`) match the `WindowAction` types in Task 3.

**Deferred by design:** terminal (Phase 2), games (Phase 3), mobile sheets and on-screen controls (Phase 4). Each is called out in Task 6 with a `PlaceholderView` so Phase 1 ships without dead ends.
