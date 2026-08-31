import { useCallback, useEffect, useState } from 'react'
import { ApiError, deleteJson, getJson, patchJson, postJson } from './client'
import { useSessionContext } from './SessionProvider'
import { BOARD_FIELD_LABELS, explainCode } from '../i18n/errors'
import type { Bi } from '../data/types'
import type { BoardVisibility } from '../../shared/boardGraph'

/**
 * The boards list: what the owner has built, and the four things that can be
 * done to a board from outside its editor — make one, rename it, change who can
 * read it, destroy it. The graph itself is `useBoard`'s business.
 *
 * The shapes below restate what `GET /api/boards` returns; the app build only
 * sees `src` and `shared`, so nothing here imports from `server/`.
 */

export type { BoardVisibility }

/**
 * One row of the list. The counts and timestamps are nullable on purpose: a
 * server that did not send one is not a reason to render a zero nobody
 * measured (rule 5) — the page shows a dash instead.
 */
export type Board = {
  slug: string
  name: Bi
  visibility: BoardVisibility
  version: number
  nodes: number | null
  edges: number | null
  createdAt: string | null
  updatedAt: string | null
}

/**
 * Why a call did not go through. `messages` are the server's `field:code`
 * strings, which the pages turn into sentences (rule 11).
 */
export type BoardFailure = {
  kind: 'validation' | 'forbidden' | 'missing' | 'offline' | 'server'
  messages: string[]
}

export type BoardsState = {
  boards: Board[]
  loading: boolean
  /** False once a request failed without an answer; the page stays calm (rule 8). */
  online: boolean
  /** True while a create/rename/visibility/delete round-trip is in flight. */
  busy: boolean
  /** False for a visitor with no session on a password-protected deployment. */
  canEdit: boolean
  error: BoardFailure | null
  create: (name: Bi) => Promise<Board | null>
  rename: (slug: string, name: Bi) => Promise<boolean>
  setVisibility: (slug: string, visibility: BoardVisibility) => Promise<boolean>
  remove: (slug: string) => Promise<boolean>
  refresh: () => Promise<void>
  clearError: () => void
}

export function failureOf(cause: unknown): BoardFailure {
  if (!(cause instanceof ApiError)) return { kind: 'offline', messages: [] }
  if (cause.status === 401 || cause.status === 403) return { kind: 'forbidden', messages: cause.messages }
  if (cause.status === 404) return { kind: 'missing', messages: cause.messages }
  if (cause.status === 400 || cause.status === 409 || cause.status === 422)
    return { kind: 'validation', messages: cause.messages }
  return { kind: 'server', messages: cause.messages }
}

/**
 * What each `field:code` field is called on these two pages. It belongs beside
 * the other dictionaries in `src/i18n/errors.ts`; it lives here only because
 * the boards work landed without that file being open to edit, and `explainCode`
 * takes a label override for exactly this case.
 */
/**
 * One server answer as a sentence. The board field names live in
 * `src/i18n/errors.ts` with every other field name, so there is one dictionary
 * rather than one per page.
 */
export const explainBoardCode = (code: string, digits: (value: string) => string): Bi =>
  explainCode(code, BOARD_FIELD_LABELS[code.split(':')[0] ?? ''], digits)

const isBi = (value: unknown): value is Bi => {
  if (!value || typeof value !== 'object') return false
  const bi = value as Record<string, unknown>
  return typeof bi.fa === 'string' && typeof bi.en === 'string'
}

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

/** Reads one row defensively: a field the server did not send stays absent. */
export function toBoard(raw: unknown): Board | null {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (typeof row.slug !== 'string' || !row.slug) return null
  return {
    slug: row.slug,
    name: isBi(row.name) ? row.name : { fa: row.slug, en: row.slug },
    visibility: row.visibility === 'public' ? 'public' : 'private',
    version: count(row.version) ?? 1,
    nodes: count(row.nodes),
    edges: count(row.edges),
    createdAt: text(row.createdAt),
    updatedAt: text(row.updatedAt),
  }
}

/**
 * A board's name is the owner's own writing, not chrome. It is stored in both
 * languages, so the active side is shown — and if that side was left empty, the
 * other one is shown rather than a blank row.
 */
export const boardName = (name: Bi, locale: 'fa' | 'en'): string =>
  name[locale].trim() || name[locale === 'fa' ? 'en' : 'fa'].trim()

/** A stored timestamp in the reader's digits. Dates are data; spacing is chrome. */
export function boardStamp(iso: string | null, digits: (value: string) => string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return digits(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return digits(
    `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
  )
}

/** The address a reader with no session can open, for a public board. */
export const publicBoardUrl = (slug: string): string =>
  `${window.location.origin}${window.location.pathname}#/boards/${slug}`

/**
 * The list's state. An unreachable API leaves an empty list and flips `online`,
 * so the page renders a calm empty screen rather than throwing (rule 8).
 */
export function useBoards(): BoardsState {
  const session = useSessionContext()
  const canEdit = !session.enabled || session.authenticated

  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<BoardFailure | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getJson<{ boards?: unknown[] }>('/api/boards')
      const rows = Array.isArray(data.boards) ? data.boards : []
      setBoards(rows.map(toBoard).filter((board): board is Board => board !== null))
      setOnline(true)
    } catch (cause) {
      if (cause instanceof ApiError) {
        // An answered request is not an outage: an empty list is the answer.
        setBoards([])
        setOnline(true)
      } else {
        setOnline(false)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Every mutation shares one shape: run it, refresh, or record why not. */
  const run = useCallback(
    async <T,>(call: () => Promise<T>): Promise<T | null> => {
      setBusy(true)
      setError(null)
      try {
        const result = await call()
        setOnline(true)
        await refresh()
        return result
      } catch (cause) {
        const failure = failureOf(cause)
        setError(failure)
        if (failure.kind === 'offline') setOnline(false)
        return null
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  const create = useCallback(
    async (name: Bi) => {
      const data = await run(() => postJson<{ board?: unknown }>('/api/boards', { name }))
      return data ? toBoard(data.board) : null
    },
    [run],
  )

  const rename = useCallback(
    async (slug: string, name: Bi) => (await run(() => patchJson<unknown>(`/api/boards/${slug}`, { name }))) !== null,
    [run],
  )

  const setVisibility = useCallback(
    async (slug: string, visibility: BoardVisibility) =>
      (await run(() => patchJson<unknown>(`/api/boards/${slug}`, { visibility }))) !== null,
    [run],
  )

  const remove = useCallback(
    async (slug: string) => {
      setBusy(true)
      setError(null)
      try {
        await deleteJson<unknown>(`/api/boards/${slug}`)
        setOnline(true)
        await refresh()
        return true
      } catch (cause) {
        // A board that is already gone is the outcome the click asked for.
        if (cause instanceof ApiError && cause.status === 404) {
          await refresh()
          return true
        }
        const failure = failureOf(cause)
        setError(failure)
        if (failure.kind === 'offline') setOnline(false)
        return false
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  const clearError = useCallback(() => setError(null), [])

  return { boards, loading, online, busy, canEdit, error, create, rename, setVisibility, remove, refresh, clearError }
}
