import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import * as q from '../db/queries.ts'
import { isAuthenticated } from '../auth.ts'
import { emptyGraph, normalizeGraph, type BoardGraph } from '../../shared/boardGraph.ts'
import {
  BOARD_VERSION_LIMIT,
  nextVersion,
  normalizeName,
  normalizeNote,
  normalizeVisibility,
  parseVersion,
  planRestore,
  pruneCutoff,
  resolveSlug,
  slugSeed,
  visibleTo,
} from '../domain/board.ts'

/**
 * Boards the owner builds, over HTTP. Thin by design: read the body, hand it to
 * `shared/boardGraph.ts` or `server/domain/board.ts`, write through
 * `db/queries.ts`, return. Every failure is a `field:code` string, because the
 * server cannot write bilingual prose (rule 11).
 *
 * Visibility is enforced here rather than in `isPublicPath`, which only sees a
 * path: `GET /api/boards/<slug>` is the one shape the allowlist lets through
 * with no session, and a private board answers it exactly as a missing board
 * does — same status, same code — so the list of private slugs cannot be
 * probed. Everything else, history included, stays behind the guard.
 */
export default async function boardRoutes(app: FastifyInstance) {
  const invalid = (reply: FastifyReply, errors: string[]) =>
    reply.code(400).send({ error: 'invalid input', errors })

  const missing = (reply: FastifyReply) =>
    reply.code(404).send({ error: 'not found', errors: ['slug:unknown_board'] })

  const slugOf = (request: FastifyRequest) => (request.params as { slug?: string }).slug ?? ''

  /** The board this request may see, or undefined — private and absent look alike. */
  const readable = (request: FastifyRequest) => {
    const board = q.boardBySlug(slugOf(request))
    if (!board) return undefined
    return visibleTo(board.visibility, isAuthenticated(request)) ? board : undefined
  }

  /** A board and its current graph, in the one shape every answer here uses. */
  const view = (board: q.BoardRow) => {
    const current = q.currentBoardVersion(board.id)
    const graph = current?.graph ?? emptyGraph()
    return { board: q.boardSummary(board, current?.version ?? 0, graph), graph }
  }

  /**
   * Appends a version and trims the tail beyond the retention window. Reading
   * the latest number and writing the next one is one uninterrupted stretch —
   * `node:sqlite` is synchronous and there is no await between them — and the
   * unique index is the backstop if that ever stops being true.
   */
  const save = (board: q.BoardRow, version: number, graph: BoardGraph, note: string | null, from: number | null) => {
    const written = q.addBoardVersion(board.id, version, graph, note, from)
    q.dropBoardVersionsBelow(board.id, pruneCutoff(written.version, BOARD_VERSION_LIMIT))
    return written
  }

  const latestVersion = (board: q.BoardRow): number | null => q.currentBoardVersion(board.id)?.version ?? null

  app.get('/api/boards', async (request) => ({
    boards: q.listBoards(isAuthenticated(request)),
    versionLimit: BOARD_VERSION_LIMIT,
  }))

  app.post('/api/boards', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>

    const name = normalizeName(body.name)
    if (!name.ok) return invalid(reply, name.errors)
    const visibility = normalizeVisibility(body.visibility)
    if (!visibility.ok) return invalid(reply, visibility.errors)

    const slug = resolveSlug(slugSeed(name.value), q.boardSlugTaken)
    if (!slug) return reply.code(409).send({ error: 'slug unavailable', errors: ['slug:unavailable'] })

    // Creating a board names it; the editor's first save is version 1. Until
    // then the board reads as an empty graph at version 0, which is what it is.
    const board = q.createBoard({ slug, name: name.value, visibility: visibility.value })
    return reply.code(201).send(view(board))
  })

  /** The one route a public board answers with no session. */
  app.get('/api/boards/:slug', async (request, reply) => {
    const board = readable(request)
    if (!board) return missing(reply)
    return view(board)
  })

  /** A save is one new version holding the whole graph. */
  app.put('/api/boards/:slug', async (request, reply) => {
    const board = readable(request)
    if (!board) return missing(reply)

    const body = (request.body ?? {}) as Record<string, unknown>
    // The graph may be posted whole or wrapped; unknown keys are dropped either
    // way, so an editor that sends `{ nodes, edges, note }` is understood too.
    const note = normalizeNote(body.note)
    if (!note.ok) return invalid(reply, note.errors)

    const parsed = normalizeGraph(body.graph === undefined ? body : body.graph)
    if (!parsed.ok) return invalid(reply, parsed.errors)

    const written = save(board, nextVersion(latestVersion(board)), parsed.graph, note.value, null)
    return { ...view(q.boardBySlug(board.slug)!), version: written.version }
  })

  /** Rename or change visibility. The slug never moves — links stay valid. */
  app.patch('/api/boards/:slug', async (request, reply) => {
    const board = readable(request)
    if (!board) return missing(reply)

    const body = (request.body ?? {}) as Record<string, unknown>
    if (body.name === undefined && body.visibility === undefined) {
      return invalid(reply, ['board:no_changes'])
    }

    const patch: { name?: { fa: string; en: string }; visibility?: 'private' | 'public' } = {}
    if (body.name !== undefined) {
      const name = normalizeName(body.name)
      if (!name.ok) return invalid(reply, name.errors)
      patch.name = name.value
    }
    if (body.visibility !== undefined) {
      const visibility = normalizeVisibility(body.visibility)
      if (!visibility.ok) return invalid(reply, visibility.errors)
      patch.visibility = visibility.value
    }

    return view(q.updateBoard(board.id, patch))
  })

  app.delete('/api/boards/:slug', async (request, reply) => {
    const board = readable(request)
    if (!board || !q.deleteBoard(board.id)) return missing(reply)
    return { ok: true, slug: board.slug }
  })

  app.get('/api/boards/:slug/versions', async (request, reply) => {
    const board = readable(request)
    if (!board) return missing(reply)
    return { slug: board.slug, versions: q.listBoardVersions(board.id), versionLimit: BOARD_VERSION_LIMIT }
  })

  /** One old graph, so a version can be looked at before it is restored. */
  app.get('/api/boards/:slug/versions/:version', async (request, reply) => {
    const board = readable(request)
    if (!board) return missing(reply)

    const version = parseVersion((request.params as { version?: string }).version)
    if (version === null) return invalid(reply, ['version:not_a_number'])

    const found = q.boardVersion(board.id, version)
    if (!found) return reply.code(404).send({ error: 'not found', errors: ['version:unknown_version'] })
    // Flat, with the graph where a board read keeps it, so the client can draw
    // an old version through exactly the code that draws the current one.
    return { slug: board.slug, ...found }
  })

  /**
   * A restore copies an old graph forward as a new version. Nothing after it is
   * deleted, so restoring the wrong version is undone by restoring again.
   */
  app.post('/api/boards/:slug/restore/:version', async (request, reply) => {
    const board = readable(request)
    if (!board) return missing(reply)

    const version = parseVersion((request.params as { version?: string }).version)
    if (version === null) return invalid(reply, ['version:not_a_number'])

    const body = (request.body ?? {}) as Record<string, unknown>
    const note = normalizeNote(body.note)
    if (!note.ok) return invalid(reply, note.errors)

    const source = q.boardVersion(board.id, version)
    if (!source) return reply.code(404).send({ error: 'not found', errors: ['version:unknown_version'] })

    const plan = planRestore(latestVersion(board) ?? 0, source.version)
    const written = save(board, plan.version, source.graph, note.value, plan.restoredFrom)
    return reply.code(201).send({
      ...view(q.boardBySlug(board.slug)!),
      version: written.version,
      restoredFrom: written.restoredFrom,
    })
  })
}
