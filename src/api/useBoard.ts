import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, getJson, patchJson, postJson, putJson } from './client'
import { useSessionContext } from './SessionProvider'
import { failureOf, toBoard, type Board, type BoardFailure } from './useBoards'
import { emptyGraph, type BoardGraph, type BoardVisibility } from '../../shared/boardGraph'
import type { Bi } from '../data/types'

/**
 * One board: the saved graph, the working copy the canvas edits, and the
 * version history beside it. Saving is explicit — nothing here autosaves,
 * because a person dragging nodes around decides when a version is worth
 * keeping, and every save the server accepts becomes a version forever.
 */

export type BoardVersion = {
  version: number
  note: string | null
  at: string | null
  nodes: number | null
  edges: number | null
}

export type BoardState = {
  board: Board | null
  /** The working copy: what the canvas draws and what a save would send. */
  graph: BoardGraph
  /** True when the working copy differs from the last graph the server stored. */
  dirty: boolean
  loading: boolean
  saving: boolean
  online: boolean
  /** The slug answered 404 — a wrong link, or a private board with no session. */
  notFound: boolean
  /** No session on a guarded deployment: the canvas is drawn, not edited. */
  readOnly: boolean
  error: BoardFailure | null
  versions: BoardVersion[]
  versionsLoading: boolean
  /** The version being restored right now, so its row can say so. */
  restoring: number | null
  /** An old version being read. The canvas shows it instead of the working copy. */
  viewing: { version: number; graph: BoardGraph } | null
  setGraph: (next: BoardGraph) => void
  save: (note?: string) => Promise<boolean>
  /** Throws the working copy away and goes back to the last saved graph. */
  revert: () => void
  rename: (name: Bi) => Promise<boolean>
  setVisibility: (visibility: BoardVisibility) => Promise<boolean>
  viewVersion: (version: number) => Promise<void>
  closeVersion: () => void
  restore: (version: number) => Promise<boolean>
  refresh: () => Promise<void>
  clearError: () => void
}

type LoadResponse = { board?: unknown; graph?: unknown }

const asGraph = (raw: unknown): BoardGraph => {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    nodes: Array.isArray(body.nodes) ? (body.nodes as BoardGraph['nodes']) : [],
    edges: Array.isArray(body.edges) ? (body.edges as BoardGraph['edges']) : [],
    groups: Array.isArray(body.groups) ? (body.groups as BoardGraph['groups']) : [],
  }
}

const toVersion = (raw: unknown): BoardVersion | null => {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (typeof row.version !== 'number' || !Number.isFinite(row.version)) return null
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
  return {
    version: row.version,
    note: typeof row.note === 'string' && row.note ? row.note : null,
    at: typeof row.at === 'string' && row.at ? row.at : null,
    nodes: num(row.nodes),
    edges: num(row.edges),
  }
}

/**
 * A key-order-independent reading of a graph, so the copy the server sent and
 * the copy the canvas handed back compare equal until something really moved.
 * Plain `JSON.stringify` would call a board dirty the moment it loaded.
 */
function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, item]) => `${key}:${fingerprint(item)}`).join(',')}}`
  }
  return JSON.stringify(value ?? null) ?? 'null'
}

export function useBoard(slug: string): BoardState {
  const session = useSessionContext()
  const readOnly = session.enabled && !session.authenticated

  const [board, setBoard] = useState<Board | null>(null)
  const [graph, setGraphState] = useState<BoardGraph>(emptyGraph)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [online, setOnline] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<BoardFailure | null>(null)
  const [versions, setVersions] = useState<BoardVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [viewing, setViewing] = useState<{ version: number; graph: BoardGraph } | null>(null)

  /** The graph the server last confirmed it holds, for the dirty test and revert. */
  const [saved, setSaved] = useState<BoardGraph>(emptyGraph)

  const loadVersions = useCallback(async () => {
    setVersionsLoading(true)
    try {
      const data = await getJson<{ versions?: unknown[] }>(`/api/boards/${slug}/versions`)
      const rows = Array.isArray(data.versions) ? data.versions : []
      setVersions(rows.map(toVersion).filter((row): row is BoardVersion => row !== null))
    } catch {
      // History is a panel beside the board, never a reason to lose the board.
      setVersions([])
    } finally {
      setVersionsLoading(false)
    }
  }, [slug])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getJson<LoadResponse>(`/api/boards/${slug}`)
      const next = asGraph(data.graph)
      // A row the server shaped differently still names a real board; the slug
      // in the address is enough to keep the editor on screen.
      setBoard(toBoard(data.board) ?? { slug, name: { fa: slug, en: slug }, visibility: 'private', version: 1, nodes: null, edges: null, createdAt: null, updatedAt: null })
      setGraphState(next)
      setSaved(next)
      setNotFound(false)
      setOnline(true)
      await loadVersions()
    } catch (cause) {
      if (cause instanceof ApiError) {
        setOnline(true)
        setNotFound(cause.status === 404 || cause.status === 401 || cause.status === 403)
        if (cause.status !== 404) setError(failureOf(cause))
      } else {
        setOnline(false)
      }
    } finally {
      setLoading(false)
    }
  }, [slug, loadVersions])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setGraph = useCallback((next: BoardGraph) => setGraphState(next), [])

  const revert = useCallback(() => setGraphState(saved), [saved])

  const savedPrint = useMemo(() => fingerprint(saved), [saved])
  const dirty = useMemo(() => fingerprint(graph) !== savedPrint, [graph, savedPrint])

  const save = useCallback(
    async (note?: string) => {
      if (readOnly) return false
      setSaving(true)
      setError(null)
      try {
        const body: { graph: BoardGraph; note?: string } = { graph }
        if (note && note.trim()) body.note = note.trim()
        const data = await putJson<{ board?: unknown; graph?: unknown }>(`/api/boards/${slug}`, body)

        // The server normalises what it stored; adopt its copy so the next
        // comparison is against what really sits in the database.
        const stored = data.graph === undefined ? graph : asGraph(data.graph)
        setGraphState(stored)
        setSaved(stored)
        const row = toBoard(data.board)
        if (row) setBoard(row)
        setOnline(true)
        await loadVersions()
        return true
      } catch (cause) {
        const failure = failureOf(cause)
        setError(failure)
        if (failure.kind === 'offline') setOnline(false)
        return false
      } finally {
        setSaving(false)
      }
    },
    [graph, slug, readOnly, loadVersions],
  )

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setError(null)
      try {
        const data = await patchJson<{ board?: unknown }>(`/api/boards/${slug}`, body)
        const next = toBoard(data.board)
        if (next) setBoard(next)
        setOnline(true)
        return true
      } catch (cause) {
        const failure = failureOf(cause)
        setError(failure)
        if (failure.kind === 'offline') setOnline(false)
        return false
      }
    },
    [slug],
  )

  const rename = useCallback((name: Bi) => patch({ name }), [patch])
  const setVisibility = useCallback((visibility: BoardVisibility) => patch({ visibility }), [patch])

  const viewVersion = useCallback(
    async (version: number) => {
      setError(null)
      try {
        const data = await getJson<LoadResponse>(`/api/boards/${slug}/versions/${version}`)
        setViewing({ version, graph: asGraph(data.graph ?? data) })
      } catch (cause) {
        const failure = failureOf(cause)
        setError(failure)
        if (failure.kind === 'offline') setOnline(false)
      }
    },
    [slug],
  )

  const closeVersion = useCallback(() => setViewing(null), [])

  const restore = useCallback(
    async (version: number) => {
      if (readOnly) return false
      setRestoring(version)
      setError(null)
      try {
        await postJson<unknown>(`/api/boards/${slug}/restore/${version}`)
        setViewing(null)
        setOnline(true)
        await refresh()
        return true
      } catch (cause) {
        const failure = failureOf(cause)
        setError(failure)
        if (failure.kind === 'offline') setOnline(false)
        return false
      } finally {
        setRestoring(null)
      }
    },
    [slug, readOnly, refresh],
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    board,
    graph,
    dirty,
    loading,
    saving,
    online,
    notFound,
    readOnly,
    error,
    versions,
    versionsLoading,
    restoring,
    viewing,
    setGraph,
    save,
    revert,
    rename,
    setVisibility,
    viewVersion,
    closeVersion,
    restore,
    refresh,
    clearError,
  }
}
