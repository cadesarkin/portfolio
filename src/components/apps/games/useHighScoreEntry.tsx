"use client"

import { useCallback, useRef, useState } from "react"
import { boardById, qualifies, type Entry } from "@/lib/leaderboard"
import HighScorePrompt from "./HighScorePrompt"

/**
 * Offers the initials prompt when a run earns a place on a board.
 *
 * The board is fetched at the moment a game ends rather than kept in state:
 * a stale top ten would either prompt for a run that will not appear, or skip
 * one that would have.
 */
export function useHighScoreEntry(boardId: string) {
  const [pending, setPending] = useState<number | null>(null)
  /** Guards against a game's end-state effect firing more than once. */
  const offered = useRef<number | null>(null)

  const offer = useCallback(
    async (score: number) => {
      const board = boardById(boardId)
      if (!board) return
      if (offered.current === score) return
      offered.current = score

      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        // Nothing is stored locally, so with no backend there is simply no
        // prompt — the game itself is unaffected.
        if (!data.configured) return
        const mine = (data.boards ?? []).find(
          (b: { id: string }) => b.id === boardId
        )
        const entries: Entry[] = mine?.entries ?? []
        if (qualifies(board, score, entries)) setPending(score)
      } catch {
        // Offline or blocked: skip the prompt rather than interrupting play.
      }
    },
    [boardId]
  )

  /** Call when a game restarts, so the next run can qualify again. */
  const reset = useCallback(() => {
    offered.current = null
    setPending(null)
  }, [])

  const prompt =
    pending === null ? null : (
      <HighScorePrompt
        boardId={boardId}
        score={pending}
        onDone={() => setPending(null)}
      />
    )

  return { offer, reset, prompt, pending }
}
