import { NextResponse } from "next/server"
import { Ratelimit } from "@upstash/ratelimit"
import { getRedis, redisConfigured } from "@/lib/redis"
import {
  BOARDS,
  TOP_N,
  boardById,
  validateInitials,
  validateScore,
  rank,
  type Board,
  type Entry,
} from "@/lib/leaderboard"

/** Sorted set per board. Members are unique so equal scores can coexist. */
const key = (board: Board) => `lb:${board.id}`

/**
 * Members encode the initials and the timestamp, since a sorted set cannot
 * hold duplicates — two players scoring 500 with the same initials must both
 * be able to appear.
 */
function encode(initials: string, at: number): string {
  return `${initials}:${at}:${Math.random().toString(36).slice(2, 8)}`
}

function decode(member: string, score: number): Entry {
  const [initials, at] = member.split(":")
  return { initials, score, at: Number(at) || 0 }
}

async function readBoard(board: Board): Promise<Entry[]> {
  const redis = getRedis()
  // Read a little more than we display, so trimming lag cannot leave the list
  // short after a burst of submissions.
  const raw = (await redis.zrange(key(board), 0, TOP_N * 2 - 1, {
    rev: board.direction === "high",
    withScores: true,
  })) as (string | number)[]

  const entries: Entry[] = []
  for (let i = 0; i < raw.length; i += 2) {
    entries.push(decode(String(raw[i]), Number(raw[i + 1])))
  }
  return rank(board, entries)
}

export async function GET() {
  if (!redisConfigured()) {
    // Local checkouts without env vars get empty boards rather than an error.
    return NextResponse.json({
      boards: BOARDS.map((b) => ({ ...b, entries: [] })),
      configured: false,
    })
  }

  try {
    const boards = await Promise.all(
      BOARDS.map(async (b) => ({ ...b, entries: await readBoard(b) }))
    )
    return NextResponse.json({ boards, configured: true })
  } catch {
    return NextResponse.json(
      { error: "leaderboard unavailable" },
      { status: 503 }
    )
  }
}

export async function POST(req: Request) {
  if (!redisConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 })
  }

  const redis = getRedis()

  // Scores are forgeable by design; this only stops a script from flooding the
  // board faster than a person could play.
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(8, "60 s"),
    prefix: "lb:rl",
  })
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"
  const { success } = await limiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: "slow down" }, { status: 429 })
  }

  let body: { board?: string; initials?: string; score?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 })
  }

  const board = boardById(String(body.board ?? ""))
  if (!board) {
    return NextResponse.json({ error: "unknown board" }, { status: 400 })
  }

  const initials = validateInitials(String(body.initials ?? ""))
  if (!initials.ok) {
    return NextResponse.json({ error: initials.error }, { status: 400 })
  }

  const score = validateScore(board, body.score)
  if (!score.ok) {
    return NextResponse.json({ error: score.error }, { status: 400 })
  }

  try {
    const at = Date.now()
    await redis.zadd(key(board), {
      score: score.value!,
      member: encode(initials.value!, at),
    })

    // Keep only the top N. On a "high" board the losers are the lowest ranks;
    // on a "low" board they are the highest.
    const size = await redis.zcard(key(board))
    if (size > TOP_N) {
      if (board.direction === "high") {
        await redis.zremrangebyrank(key(board), 0, size - TOP_N - 1)
      } else {
        await redis.zremrangebyrank(key(board), TOP_N, -1)
      }
    }

    return NextResponse.json({ ok: true, entries: await readBoard(board) })
  } catch {
    return NextResponse.json({ error: "could not save" }, { status: 503 })
  }
}

/** Admin delete, for anything the blocklist did not catch. */
export async function DELETE(req: Request) {
  const token = process.env.LEADERBOARD_ADMIN_TOKEN
  const provided = req.headers.get("x-admin-token")
  // Fails closed: with no token configured, nothing can be deleted remotely.
  if (!token || provided !== token) {
    return NextResponse.json({ error: "not authorised" }, { status: 401 })
  }
  if (!redisConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 })
  }

  const url = new URL(req.url)
  const boardId = url.searchParams.get("board")
  const initials = url.searchParams.get("initials")
  const board = boardById(String(boardId ?? ""))
  if (!board || !initials) {
    return NextResponse.json({ error: "board and initials required" }, { status: 400 })
  }

  const redis = getRedis()
  const members = (await redis.zrange(key(board), 0, -1)) as string[]
  const doomed = members.filter((m) => m.startsWith(`${initials.toUpperCase()}:`))
  if (doomed.length > 0) await redis.zrem(key(board), ...doomed)

  return NextResponse.json({ ok: true, removed: doomed.length })
}
