import { useCallback, useEffect, useState } from 'react'
import { ApiError, deleteJson, getJson, postJson } from './client'

/**
 * The content factory's client half: produce a batch, list what is scheduled,
 * publish what is due, drop a piece. The shapes below restate the server's
 * `ContentRecord` and its request contract — the app build only sees `src` and
 * `shared`, so nothing here imports from `server/`. When one of them changes
 * over there, it changes here in the same commit.
 */

export const CONTENT_CHANNELS = ['instagram', 'telegram', 'linkedin', 'youtube', 'website'] as const
export type ContentChannel = (typeof CONTENT_CHANNELS)[number]

export const CONTENT_STATUSES = ['pending', 'sent', 'simulated', 'failed'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const CONTENT_KINDS = ['voice', 'video', 'copy'] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

/** The caps the route clamps to, so the form can stop before the server does. */
export const CONTENT_LIMITS = { count: 24, perDay: 24 } as const
export const CONTENT_DEFAULTS = { count: 6, perDay: 2 } as const

/** One stored piece, exactly as `GET /api/content` returns it. */
export type ContentPiece = {
  id: number
  kind: ContentKind
  channel: ContentChannel
  title: string
  body: string
  locale: string
  angle: string | null
  target: string | null
  status: ContentStatus
  dueAt: string
  publishedAt: string | null
  /** 'claude' when the model wrote it, 'template' when the offline copy did. */
  producedBy: string
  note: string | null
  createdAt: string
}

export type ProduceInput = {
  count: number
  channels: ContentChannel[]
  perDay: number
  locale: 'fa' | 'en'
}

/**
 * Why a call failed. `messages` are the server's `field:code` strings, which the
 * page turns into sentences — the server writes no user-facing prose (rule 11).
 * `incomplete` is the 409: the business profile has nothing to write about yet.
 */
export type ContentFailure = {
  kind: 'incomplete' | 'validation' | 'offline' | 'server'
  messages: string[]
}

/** What the last accepted batch was, so the page never invents a number. */
export type ProduceResult = { count: number; producedBy: string; locale: string }
export type PublishResult = { published: number; pending: number }

export type ContentFilter = { status: ContentStatus | ''; channel: ContentChannel | '' }

/** Whether each channel really delivers, read from `/api/health`, not assumed. */
export type Delivery = Partial<Record<ContentChannel, 'live' | 'simulated'>>

export type ContentState = {
  pieces: ContentPiece[]
  /** How many pieces are still waiting for their hour, as the server counts. */
  pending: number
  statuses: readonly ContentStatus[]
  delivery: Delivery
  filter: ContentFilter
  loading: boolean
  producing: boolean
  publishing: boolean
  online: boolean
  error: ContentFailure | null
  lastProduced: ProduceResult | null
  lastPublished: PublishResult | null
  setFilter: (next: Partial<ContentFilter>) => void
  produce: (input: ProduceInput) => Promise<boolean>
  publishNow: () => Promise<boolean>
  remove: (id: number) => Promise<boolean>
  refresh: () => Promise<void>
  clearError: () => void
}

type ListResponse = { pieces: ContentPiece[]; pending: number; statuses: ContentStatus[] }
type ProduceResponse = { pieces: ContentPiece[]; producedBy: string; locale: string }

function failureOf(cause: unknown): ContentFailure {
  if (!(cause instanceof ApiError)) return { kind: 'offline', messages: [] }
  if (cause.status === 409) return { kind: 'incomplete', messages: cause.messages }
  if (cause.status === 400) return { kind: 'validation', messages: cause.messages }
  return { kind: 'server', messages: cause.messages }
}

const LIST_LIMIT = 60

/**
 * The factory's state. An unreachable API leaves an empty list behind and flips
 * `online`, so the page renders calmly instead of throwing (rule 8).
 */
export function useContent(): ContentState {
  const [pieces, setPieces] = useState<ContentPiece[]>([])
  const [pending, setPending] = useState(0)
  const [statuses, setStatuses] = useState<readonly ContentStatus[]>(CONTENT_STATUSES)
  const [delivery, setDelivery] = useState<Delivery>({})
  const [filter, setFilterState] = useState<ContentFilter>({ status: '', channel: '' })
  const [loading, setLoading] = useState(true)
  const [producing, setProducing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [online, setOnline] = useState(true)
  const [error, setError] = useState<ContentFailure | null>(null)
  const [lastProduced, setLastProduced] = useState<ProduceResult | null>(null)
  const [lastPublished, setLastPublished] = useState<PublishResult | null>(null)

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(LIST_LIMIT) })
    if (filter.status) params.set('status', filter.status)
    if (filter.channel) params.set('channel', filter.channel)

    try {
      const data = await getJson<ListResponse>(`/api/content?${params}`)
      setPieces(data.pieces)
      setPending(data.pending)
      if (data.statuses?.length) setStatuses(data.statuses)
      setOnline(true)
    } catch {
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [filter.status, filter.channel])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Which channels deliver and which only record is a fact of the deployment,
  // not of this page, so it is read rather than stated.
  useEffect(() => {
    void getJson<{ adapters?: { channels?: Delivery } }>('/api/health')
      .then((data) => setDelivery(data.adapters?.channels ?? {}))
      .catch(() => setDelivery({}))
  }, [])

  const setFilter = useCallback((next: Partial<ContentFilter>) => {
    setFilterState((prev) => ({ ...prev, ...next }))
  }, [])

  const produce = useCallback(
    async (input: ProduceInput) => {
      setProducing(true)
      setError(null)
      try {
        const data = await postJson<ProduceResponse>('/api/content/produce', input)
        setLastProduced({ count: data.pieces.length, producedBy: data.producedBy, locale: data.locale })
        setOnline(true)
        await refresh()
        return true
      } catch (cause) {
        const failure = failureOf(cause)
        setError(failure)
        if (failure.kind === 'offline') setOnline(false)
        return false
      } finally {
        setProducing(false)
      }
    },
    [refresh],
  )

  const publishNow = useCallback(async () => {
    setPublishing(true)
    setError(null)
    try {
      const data = await postJson<PublishResult>('/api/content/publish')
      setLastPublished(data)
      setPending(data.pending)
      setOnline(true)
      await refresh()
      return true
    } catch (cause) {
      const failure = failureOf(cause)
      setError(failure)
      if (failure.kind === 'offline') setOnline(false)
      return false
    } finally {
      setPublishing(false)
    }
  }, [refresh])

  const remove = useCallback(
    async (id: number) => {
      setError(null)
      try {
        await deleteJson<{ ok: true }>(`/api/content/${id}`)
        await refresh()
        return true
      } catch (cause) {
        // A piece that is already gone is the outcome the click asked for.
        if (cause instanceof ApiError && cause.status === 404) {
          await refresh()
          return true
        }
        const failure = failureOf(cause)
        setError(failure)
        if (failure.kind === 'offline') setOnline(false)
        return false
      }
    },
    [refresh],
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    pieces,
    pending,
    statuses,
    delivery,
    filter,
    loading,
    producing,
    publishing,
    online,
    error,
    lastProduced,
    lastPublished,
    setFilter,
    produce,
    publishNow,
    remove,
    refresh,
    clearError,
  }
}
