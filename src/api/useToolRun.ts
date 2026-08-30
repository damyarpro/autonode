import { useCallback, useEffect, useState } from 'react'
import { ApiError, deleteJson, getJson, postJson } from './client'
import type { Locale } from '../data/types'
import type { ToolRun } from '../../shared/aiToolSpecs'

/**
 * Why a run fails, so the page can pick its own bilingual line for everything
 * except `messages`, which the server writes and the page prints verbatim.
 */
export type ToolRunFailure = {
  kind: 'validation' | 'notFound' | 'offline' | 'server'
  messages: string[]
}

export type ToolRunState = {
  /** Past runs for this tool, newest first; empty while offline. */
  runs: ToolRun[]
  /** The run to show as the answer: this session's run, else the newest stored. */
  latest: ToolRun | null
  loading: boolean
  running: boolean
  online: boolean
  error: ToolRunFailure | null
  run: (inputs: Record<string, string>) => Promise<ToolRun | null>
  remove: (id: number) => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
}

const HISTORY_LIMIT = 10

type RunResponse = { run: ToolRun }
type RunsResponse = { runs: ToolRun[] }

/** Maps a thrown value onto the reason the page reports. */
function failureOf(cause: unknown): ToolRunFailure {
  if (!(cause instanceof ApiError)) return { kind: 'offline', messages: [] }
  const kind = cause.status === 400 ? 'validation' : cause.status === 404 ? 'notFound' : 'server'
  return { kind, messages: cause.messages }
}

/**
 * One tool's history and its run action. When `/api` is unreachable the history
 * stays empty and `online` goes false, so the page renders its empty state
 * instead of throwing.
 */
export function useToolRun(toolId: string, locale: Locale): ToolRunState {
  const [runs, setRuns] = useState<ToolRun[]>([])
  const [fresh, setFresh] = useState<ToolRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [online, setOnline] = useState(true)
  const [error, setError] = useState<ToolRunFailure | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getJson<RunsResponse>(
        `/api/tools/${encodeURIComponent(toolId)}/runs?limit=${HISTORY_LIMIT}`,
      )
      setRuns(data.runs)
      setOnline(true)
    } catch {
      setRuns([])
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [toolId])

  useEffect(() => {
    setRuns([])
    setFresh(null)
    setError(null)
    setLoading(true)
    void refresh()
  }, [refresh])

  const run = useCallback(
    async (inputs: Record<string, string>) => {
      setRunning(true)
      setError(null)
      try {
        const { run: created } = await postJson<RunResponse>(
          `/api/tools/${encodeURIComponent(toolId)}/run`,
          { inputs, locale },
        )
        setOnline(true)
        setFresh(created)
        setRuns((prev) => [created, ...prev.filter((item) => item.id !== created.id)])
        return created
      } catch (cause) {
        const failure = failureOf(cause)
        setError(failure)
        if (failure.kind === 'offline') setOnline(false)
        return null
      } finally {
        setRunning(false)
      }
    },
    [toolId, locale],
  )

  const remove = useCallback(async (id: number) => {
    try {
      await deleteJson(`/api/tools/runs/${id}`)
      setRuns((prev) => prev.filter((item) => item.id !== id))
      setFresh((prev) => (prev && prev.id === id ? null : prev))
      setOnline(true)
    } catch {
      setOnline(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    runs,
    latest: fresh ?? runs[0] ?? null,
    loading,
    running,
    online,
    error,
    run,
    remove,
    refresh,
    clearError,
  }
}
