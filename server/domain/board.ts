/**
 * The pure half of user-built boards: what a board is called, which slug it
 * gets, how versions are numbered, how many are kept, and what a restore means.
 *
 * `shared/boardGraph.ts` owns the graph itself — its shape, its caps and its
 * `field:code` answers. Nothing here re-reads a node; this file only decides
 * the things around the graph, so every rule below is testable with no I/O.
 */
import {
  BOARD_LIMITS,
  VISIBILITIES,
  slugify,
  type Bi,
  type BoardGraph,
  type BoardVisibility,
} from '../../shared/boardGraph.ts'

/** Failures are machine-readable; the client writes the sentence (rule 11). */
export type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] }

const ok = <T>(value: T): Checked<T> => ({ ok: true, value })
const bad = <T>(...errors: string[]): Checked<T> => ({ ok: false, errors })

/**
 * How many versions a board keeps. A 200-node board serialises to roughly
 * 60–80 KB of bilingual JSON, so 50 snapshots is about 4 MB in the worst case —
 * affordable on the single writable path a deployment has, and far deeper than
 * the undo any editing session actually reaches for. Older snapshots are
 * dropped from the bottom; the newest 50, including whatever is current, stay.
 */
export const BOARD_VERSION_LIMIT = 50

/** A version note is a label on a save, not a document. */
export const VERSION_NOTE_LENGTH = 200

/** The slug a board falls back to when its name transliterates to nothing. */
export const FALLBACK_SLUG = 'board'

/** Slugs live in a URL and in a unique index; keep them short. */
const SLUG_LENGTH = 48

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/**
 * A board's name in both languages (rule 2). A name given in one language only
 * is mirrored into the other rather than stored blank: the owner typed one
 * name, and a board with an empty English title would render as nothing at all.
 */
export function normalizeName(raw: unknown): Checked<Bi> {
  const asBi = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const fa = typeof raw === 'string' ? text(raw) : text(asBi.fa)
  const en = typeof raw === 'string' ? text(raw) : text(asBi.en)

  if (!fa && !en) return bad('name:required')
  if (fa.length > BOARD_LIMITS.nameLength || en.length > BOARD_LIMITS.nameLength) {
    return bad(`name:too_long:${BOARD_LIMITS.nameLength}`)
  }
  return ok({ fa: fa || en, en: en || fa })
}

export function normalizeVisibility(raw: unknown): Checked<BoardVisibility> {
  if (raw === undefined || raw === null) return ok('private')
  const found = VISIBILITIES.find((option) => option === raw)
  return found ? ok(found) : bad('visibility:not_an_option')
}

export function normalizeNote(raw: unknown): Checked<string | null> {
  if (raw === undefined || raw === null) return ok(null)
  if (typeof raw !== 'string') return bad('note:not_text')
  const note = raw.trim()
  if (note.length > VERSION_NOTE_LENGTH) return bad(`note:too_long:${VERSION_NOTE_LENGTH}`)
  return ok(note.length > 0 ? note : null)
}

/**
 * The slug a name wants. English first, because `slugify` keeps Latin letters
 * and turns everything else — Persian included — into separators; a Persian
 * name therefore yields '' and the caller falls back to `FALLBACK_SLUG`.
 */
export const slugSeed = (name: Bi): string => slugify(name.en) || slugify(name.fa)

/** Trims a base so `base-n` still fits, without leaving a trailing separator. */
const fit = (base: string, suffix: string): string =>
  `${base.slice(0, Math.max(1, SLUG_LENGTH - suffix.length)).replace(/-+$/, '')}${suffix}`

/**
 * The first free slug for a name: the seed, then `seed-2`, `seed-3`, … A name
 * that transliterates to nothing becomes `board`, `board-2`, … — stable,
 * unique and typeable, rather than a random string nobody can read back.
 *
 * `isTaken` is the caller's lookup, which keeps this function pure. Null means
 * every candidate was taken, which the route answers rather than looping.
 */
export function resolveSlug(seed: string, isTaken: (slug: string) => boolean, tries = 200): string | null {
  const base = seed || FALLBACK_SLUG
  if (!isTaken(base)) return base
  for (let n = 2; n <= tries; n += 1) {
    const candidate = fit(base, `-${n}`)
    if (!isTaken(candidate)) return candidate
  }
  return null
}

/** Versions start at 1 and only ever go up, restores included. */
export const nextVersion = (latest: number | null | undefined): number =>
  Number.isInteger(latest) && (latest as number) > 0 ? (latest as number) + 1 : 1

/**
 * The oldest version worth keeping once `latest` exists. Everything strictly
 * below it is beyond the retention window. Never above `latest`, so the current
 * graph is never the row that gets pruned.
 */
export const pruneCutoff = (latest: number, keep = BOARD_VERSION_LIMIT): number =>
  Math.min(latest, Math.max(1, latest - Math.max(1, keep) + 1))

/**
 * A restore is a save, not a rewind: the old graph comes back as a **new**
 * version and everything in between stays on the record, so an accidental
 * restore is itself undoable. The server records which version was copied as a
 * number rather than as a sentence — prose is the client's job (rule 11).
 */
export type RestorePlan = { version: number; restoredFrom: number }

export const planRestore = (latest: number, from: number): RestorePlan => ({
  version: nextVersion(latest),
  restoredFrom: from,
})

/** A version number out of a URL segment. */
export function parseVersion(raw: string | undefined): number | null {
  if (typeof raw !== 'string' || !/^[0-9]{1,9}$/.test(raw)) return null
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

/**
 * Who may read a board. Visibility lives in the database, so the path-level
 * allowlist in `server/auth.ts` cannot decide this — the handler does, and
 * answers a private board exactly the way it answers a missing one.
 */
export const visibleTo = (visibility: string, authenticated: boolean): boolean =>
  visibility === 'public' || authenticated

export type BoardCounts = { nodes: number; edges: number; groups: number }

/** Counted from the stored graph, never stored beside it (rule 6). */
export const countGraph = (graph: BoardGraph): BoardCounts => ({
  nodes: graph.nodes.length,
  edges: graph.edges.length,
  groups: graph.groups.length,
})
