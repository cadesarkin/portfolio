/**
 * The command table.
 *
 * Every command is pure: it takes arguments and a cwd and returns lines plus
 * optional side-effect requests. Nothing here touches the DOM or React, so the
 * whole shell is testable without rendering a terminal.
 */

import { resolve, pathOf, complete, search, commonPrefix } from "@/lib/vfs-utils"
import { root } from "@/lib/vfs"
import { isDir, type VDir, type VNode } from "@/lib/vfs-types"
import { IDENTITY, SKILLS, ROLES, tenure } from "@/lib/resume"
import { tokenize, nearest } from "./parse"
import { killProcess, processes } from "@/lib/defrag/store"

export type Tone = "out" | "err" | "dim" | "accent" | "prompt"

export interface Line {
  text: string
  tone?: Tone
  /**
   * Renders `text` in a fixed-width left column with `right` beside it.
   *
   * Used where two columns must line up but the left one contains block
   * glyphs. Those fall back to a font with different metrics than the space
   * character, so padding by character count does not align them — only real
   * layout does.
   */
  right?: string
}

export interface CmdResult {
  lines?: Line[]
  /** New working directory, if the command changed it. */
  cwd?: string
  /** VFS path of a window to open. */
  open?: string
  clear?: boolean
  reboot?: boolean
  closeWin?: boolean
  /** "toggle" flips it; a named theme sets it outright. */
  theme?: "day" | "night" | "toggle"
}

interface Cmd {
  help: string
  run: (args: string[], cwd: string) => CmdResult
}

/**
 * Processes that are always there. They cannot be killed; the ones that can
 * belong to defrag, and appear only while a level of it is running.
 */
const SYSTEM_PROCS: { pid: number; name: string }[] = [
  { pid: 88, name: "desktop" },
  { pid: 204, name: "wallpaper" },
  { pid: 311, name: "terminal" },
]

const out = (...text: string[]): Line[] => text.map((t) => ({ text: t }))
const err = (text: string): Line[] => [{ text, tone: "err" }]
const dim = (...text: string[]): Line[] =>
  text.map((t) => ({ text: t, tone: "dim" }))

function label(node: VNode): string {
  return node.name + (node.kind === "dir" ? "/" : "")
}

export const COMMANDS: Record<string, Cmd> = {
  help: {
    help: "list available commands",
    run: () => {
      const width = Math.max(...Object.keys(COMMANDS).map((k) => k.length))
      return {
        lines: [
          ...dim("available commands:"),
          ...Object.entries(COMMANDS).map(([name, cmd]) => ({
            text: `  ${name.padEnd(width + 2)}${cmd.help}`,
          })),
          { text: "" },
          { text: "tab completes · ↑ ↓ history · ctrl+l clears", tone: "dim" },
        ],
      }
    },
  },

  ls: {
    help: "list directory contents",
    run: (args, cwd) => {
      const long = args.includes("-l")
      const target = args.find((a) => !a.startsWith("-")) ?? "."
      const node = resolve(target, cwd)
      if (!node) return { lines: err(`ls: ${target}: no such file or directory`) }
      if (!isDir(node)) return { lines: out(node.name) }

      if (!long) {
        return { lines: out(node.children.map(label).join("  ")) }
      }

      const width = Math.max(...node.children.map((c) => label(c).length), 1)
      return {
        lines: node.children.map((c) => ({
          text: `  ${label(c).padEnd(width + 2)}${c.desc ?? ""}${
            c.tag ? `  ${c.tag}` : ""
          }`,
        })),
      }
    },
  },

  cd: {
    help: "change directory",
    run: (args, cwd) => {
      const target = args[0] ?? "~"
      const node = resolve(target, cwd)
      if (!node) return { lines: err(`cd: ${target}: no such file or directory`) }
      if (!isDir(node)) return { lines: err(`cd: ${target}: not a directory`) }
      return { cwd: pathOf(node) }
    },
  },

  pwd: {
    help: "print working directory",
    run: (_args, cwd) => ({ lines: out(cwd) }),
  },

  cat: {
    help: "print a file",
    run: (args, cwd) => {
      if (args.length === 0) return { lines: err("usage: cat <file>") }
      const node = resolve(args[0], cwd)
      if (!node) return { lines: err(`cat: ${args[0]}: no such file or directory`) }
      if (isDir(node)) return { lines: err(`cat: ${args[0]}: is a directory`) }
      if (node.kind === "link") return { lines: out(node.url) }
      if (node.kind === "app")
        return {
          lines: dim(`${node.name} is an application — try: open ${node.name}`),
        }
      if (node.kind === "image")
        return {
          lines: dim(`${node.name}: ${node.caption} — try: open ${node.name}`),
        }
      return {
        lines: node.body.split("\n").map((text: string) => ({ text })),
      }
    },
  },

  tree: {
    help: "print a directory tree",
    run: (args, cwd) => {
      const start = resolve(args[0] ?? ".", cwd)
      if (!start) return { lines: err(`tree: ${args[0]}: no such file or directory`) }
      if (!isDir(start)) return { lines: out(start.name) }

      const lines: Line[] = [{ text: label(start), tone: "accent" }]
      const walk = (dir: VDir, prefix: string) => {
        dir.children.forEach((child, i) => {
          const last = i === dir.children.length - 1
          lines.push({ text: `${prefix}${last ? "`-- " : "|-- "}${label(child)}` })
          if (isDir(child)) walk(child, prefix + (last ? "    " : "|   "))
        })
      }
      walk(start, "")
      return { lines }
    },
  },

  find: {
    help: "search the filesystem by name",
    run: (args) => {
      if (args.length === 0) return { lines: err("usage: find <query>") }
      const hits = search(args[0])
      if (hits.length === 0) return { lines: dim(`no matches for '${args[0]}'`) }
      return { lines: hits.map((n) => ({ text: pathOf(n) })) }
    },
  },

  open: {
    help: "open a folder, file or app in a window",
    run: (args, cwd) => {
      if (args.length === 0) return { lines: err("usage: open <name>") }
      const direct = resolve(args[0], cwd)
      const node = direct ?? search(args[0])[0]
      if (!node) return { lines: err(`cannot open '${args[0]}': not found`) }
      if (node.kind === "link")
        return { lines: dim(`${node.name} → ${node.url}`), open: pathOf(node) }
      return { lines: dim(`opening ${node.name}...`), open: pathOf(node) }
    },
  },

  whoami: {
    help: "who is this",
    run: () => ({
      lines: [
        { text: IDENTITY.name, tone: "accent" },
        ...out(
          `${IDENTITY.role} · ${IDENTITY.location}`,
          `${tenure()} shipping production code.`,
          "",
          "Currently at Fern, building SDK generators, agent automations",
          "and CLI features for enterprise API companies.",
          "",
        ),
        ...dim("try: experience · skills · resume · open work"),
      ],
    }),
  },

  resume: {
    help: "open the resume",
    run: () => ({ lines: dim("opening resume..."), open: "/about/resume.pdf" }),
  },

  skills: {
    help: "list technical skills",
    run: () => ({
      lines: SKILLS.flatMap((s) => [
        { text: s.label, tone: "accent" as Tone },
        { text: `  ${s.items}` },
      ]),
    }),
  },

  experience: {
    help: "list roles",
    run: () => ({
      lines: ROLES.flatMap((r) => [
        { text: `${r.company}`, tone: "accent" as Tone },
        { text: `  ${r.title}` },
        { text: `  ${r.start} — ${r.end}`, tone: "dim" as Tone },
        { text: "" },
      ]),
    }),
  },

  email: {
    help: "print contact details",
    run: () => ({
      lines: out(
        IDENTITY.email,
        IDENTITY.phone,
        IDENTITY.github,
        IDENTITY.linkedin
      ),
    }),
  },

  neofetch: {
    help: "system information",
    run: () => {
      const work = resolve("/work", "/")
      const projects = resolve("/projects", "/")
      const clients = work && isDir(work) ? work.children.length : 0
      const projs = projects && isDir(projects) ? projects.children.length : 0

      // Pure ASCII. Next's `latin` font subset strips box-drawing and block
      // glyphs from IBM Plex Mono, so every one of them falls back to a system
      // font with a different advance width and tears the art apart. Only
      // ASCII is guaranteed to share the grid.
      const art = [
        " ________________ ",
        "|  ____________  |",
        "| |            | |",
        "| | ~/cade     | |",
        "| | $ whoami_  | |",
        "| |____________| |",
        "|________________|",
        "      |______|    ",
      ]
      const info = [
        `${IDENTITY.name.toLowerCase().replace(" ", "@")}`,
        "---------------------",
        `os        bliss.ascii`,
        `shell     sarkin-sh`,
        `uptime    ${tenure()}`,
        `role      ${IDENTITY.role}`,
        `clients   ${clients}`,
        `projects  ${projs}`,
        `stack     typescript, java, python, go`,
        `contact   ${IDENTITY.email}`,
      ]

      const rows = Math.max(art.length, info.length)
      const lines: Line[] = []
      for (let i = 0; i < rows; i++) {
        lines.push({
          text: art[i] ?? "",
          right: info[i] ?? "",
          tone: i === 0 ? "accent" : undefined,
        })
      }
      return { lines }
    },
  },

  echo: {
    help: "print arguments",
    run: (args) => ({ lines: out(args.join(" ")) }),
  },

  date: {
    help: "print the current date",
    run: () => ({ lines: out(new Date().toString()) }),
  },

  uptime: {
    help: "time since first commit to production",
    run: () => ({
      lines: out(`up ${tenure()}, 1 user, load average: caffeinated`),
    }),
  },

  theme: {
    help: "switch between day and night",
    run: (args) => {
      const arg = (args[0] ?? "toggle").toLowerCase()
      if (arg === "day" || arg === "night")
        return { lines: dim(`theme -> ${arg}`), theme: arg }
      if (arg === "toggle") return { theme: "toggle" }
      return { lines: err("usage: theme [day|night|toggle]") }
    },
  },

  ps: {
    help: "list running processes",
    run: () => {
      const game = processes()
      const rows = [...SYSTEM_PROCS, ...game.map((p) => ({ ...p, pid: p.known ? p.pid : null }))]
      return {
        lines: [
          ...dim("  PID  NAME"),
          ...rows.map((p) => ({
            text: `${(p.pid === null ? "????" : String(p.pid)).padStart(5)}  ${p.name}`,
            tone: p.pid === null ? ("accent" as const) : undefined,
          })),
          ...(game.some((p) => !p.known)
            ? dim("", "???? — a pid you have not found written down yet.")
            : []),
        ],
      }
    },
  },

  kill: {
    help: "stop a process by its pid",
    run: (args) => {
      const target = args.find((a) => !a.startsWith("-"))
      const pid = Number(target)
      if (!target || !Number.isInteger(pid) || pid < 0) return { lines: err("usage: kill <pid>") }
      if (SYSTEM_PROCS.some((p) => p.pid === pid)) {
        return { lines: err(`kill: (${pid}) - operation not permitted`) }
      }
      const r = killProcess(pid)
      return { lines: r.ok ? out(r.message) : err(r.message) }
    },
  },

  clear: {
    help: "clear the screen",
    run: () => ({ clear: true }),
  },

  reboot: {
    help: "replay the boot sequence",
    run: () => ({ lines: dim("rebooting..."), reboot: true }),
  },

  exit: {
    help: "close the terminal",
    run: () => ({ closeWin: true }),
  },

  sudo: {
    help: "elevate privileges",
    run: () => ({
      lines: err(
        `${IDENTITY.name.split(" ")[0].toLowerCase()} is not in the sudoers file. This incident has been reported.`
      ),
    }),
  },

  matrix: {
    help: "wake up",
    run: () => {
      const chars = "01" + "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ"
      const lines: Line[] = []
      for (let i = 0; i < 10; i++) {
        let row = ""
        for (let j = 0; j < 56; j++) {
          row += Math.random() < 0.42 ? chars[(Math.random() * chars.length) | 0] : " "
        }
        lines.push({ text: row, tone: "accent" })
      }
      lines.push({ text: "" }, { text: "wake up, cade...", tone: "dim" })
      return { lines }
    },
  },

  cowsay: {
    help: "a cow says something",
    run: (args) => {
      const msg = args.join(" ") || "moo"
      const bar = "_".repeat(msg.length + 2)
      return {
        lines: out(
          `  ${bar}`,
          ` < ${msg} >`,
          `  ${"-".repeat(msg.length + 2)}`,
          "        \\   ^__^",
          "         \\  (oo)\\_______",
          "            (__)\\       )\\/\\",
          "                ||----w |",
          "                ||     ||"
        ),
      }
    },
  },
}

/** Runs one command line against a cwd. */
export function run(input: string, cwd: string): CmdResult {
  const parts = tokenize(input)
  if (parts.length === 0) return { lines: [] }

  const [name, ...args] = parts
  const cmd = COMMANDS[name]
  if (cmd) return cmd.run(args, cwd)

  const guess = nearest(name, Object.keys(COMMANDS))
  return {
    lines: err(
      `${name}: command not found.${guess ? ` did you mean '${guess}'?` : ""}`
    ),
  }
}

export interface Completion {
  /** The line after completion — unchanged if nothing matched. */
  value: string
  /** Candidates to display when the prefix is ambiguous. */
  candidates: string[]
}

/**
 * Tab-completion for a whole input line.
 *
 * Position 0 completes command names; everything after completes VFS paths.
 * An ambiguous prefix advances to the longest common prefix and returns the
 * candidates for display, which is what makes completion feel like a shell
 * rather than a lookup.
 */
export function completeInput(input: string, cwd: string): Completion {
  const endsInSpace = /\s$/.test(input)
  const parts = tokenize(input)

  // Completing a fresh argument after a trailing space.
  const completingCommand = parts.length === 0 || (parts.length === 1 && !endsInSpace)
  const partial = endsInSpace ? "" : (parts[parts.length - 1] ?? "")

  const candidates = completingCommand
    ? Object.keys(COMMANDS).filter((c) => c.startsWith(partial))
    : complete(partial, cwd)

  if (candidates.length === 0) return { value: input, candidates: [] }

  const prefix = commonPrefix(candidates)
  const head = endsInSpace ? parts : parts.slice(0, -1)

  // Keep the directory portion the user already typed.
  const slash = partial.lastIndexOf("/")
  const dirPart = completingCommand || slash === -1 ? "" : partial.slice(0, slash + 1)

  const completed = [...head, dirPart + prefix].join(" ")
  return { value: completed, candidates: candidates.length > 1 ? candidates : [] }
}

export { root }
