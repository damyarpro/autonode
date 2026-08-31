import type { Bi } from './aiToolSpecs.ts'

/**
 * The shape of a board, shared by the server that stores it and the editor that
 * draws it (rule 10). A board is saved as one whole graph rather than as rows
 * per node: a save is then atomic, and a version is a snapshot you can restore
 * without replaying anything.
 */

export type { Bi }

export const VISIBILITIES = ['private', 'public'] as const
export type BoardVisibility = (typeof VISIBILITIES)[number]

/** One box. `kind` names an entry in `src/data/nodeKinds.ts`. */
export type BoardNode = {
  id: string
  kind: string
  x: number
  y: number
  width?: number
  icon: string
  kicker?: Bi
  title: Bi
  meta?: Bi
  /** The group box this node sits in, by group id. */
  group?: string | null
  /**
   * A live metric key such as `inbox.badge`. A node that names one shows the
   * real number from `GET /api/pipeline`; a node that does not shows nothing,
   * because an unmeasured number is never invented (rule 5).
   */
  metric?: string | null
  note?: string | null
}

/** A labelled container drawn behind the nodes assigned to it. */
export type BoardGroup = {
  id: string
  label: Bi
  x: number
  y: number
  width: number
  height: number
}

export type BoardEdge = {
  id: string
  source: string
  target: string
  label?: Bi
  variant?: 'default' | 'success'
  /** Draws as the dashed arc that reaches back over the board. */
  loopback?: boolean
}

export type BoardGraph = {
  nodes: BoardNode[]
  edges: BoardEdge[]
  groups: BoardGroup[]
}

export const emptyGraph = (): BoardGraph => ({ nodes: [], edges: [], groups: [] })

/** Caps, so one board cannot become a denial of service or an unreadable page. */
export const BOARD_LIMITS = {
  nodes: 200,
  edges: 400,
  groups: 40,
  idLength: 64,
  textLength: 120,
  metaLength: 200,
  noteLength: 600,
  nameLength: 80,
} as const

/** Node and group ids travel in JSON and in React keys; keep them boring. */
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

const isBi = (value: unknown): value is Bi => {
  if (!value || typeof value !== 'object') return false
  const bi = value as Record<string, unknown>
  return typeof bi.fa === 'string' && typeof bi.en === 'string'
}

const trimBi = (bi: Bi, max: number): Bi => ({ fa: bi.fa.trim().slice(0, max), en: bi.en.trim().slice(0, max) })

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export type GraphResult = { ok: true; graph: BoardGraph } | { ok: false; errors: string[] }

/**
 * Reads whatever the client sent into a graph, or says why it cannot. Unknown
 * fields are dropped rather than stored, and every failure is a `field:code`
 * string the client turns into a sentence (rule 11).
 */
export function normalizeGraph(raw: unknown): GraphResult {
  const errors: string[] = []
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  if (!Array.isArray(body.nodes)) return { ok: false, errors: ['nodes:not_a_list'] }
  if (body.edges !== undefined && !Array.isArray(body.edges)) return { ok: false, errors: ['edges:not_a_list'] }
  if (body.groups !== undefined && !Array.isArray(body.groups)) return { ok: false, errors: ['groups:not_a_list'] }

  const rawNodes = body.nodes as unknown[]
  const rawEdges = (body.edges ?? []) as unknown[]
  const rawGroups = (body.groups ?? []) as unknown[]

  if (rawNodes.length > BOARD_LIMITS.nodes) errors.push(`nodes:too_many:${BOARD_LIMITS.nodes}`)
  if (rawEdges.length > BOARD_LIMITS.edges) errors.push(`edges:too_many:${BOARD_LIMITS.edges}`)
  if (rawGroups.length > BOARD_LIMITS.groups) errors.push(`groups:too_many:${BOARD_LIMITS.groups}`)
  if (errors.length > 0) return { ok: false, errors }

  const groups: BoardGroup[] = []
  const groupIds = new Set<string>()
  for (const entry of rawGroups) {
    const g = (entry ?? {}) as Record<string, unknown>
    if (typeof g.id !== 'string' || !ID.test(g.id)) return { ok: false, errors: ['groups:bad_id'] }
    if (groupIds.has(g.id)) return { ok: false, errors: ['groups:duplicate_id'] }
    if (!isBi(g.label)) return { ok: false, errors: ['groups:label_required'] }
    groupIds.add(g.id)
    groups.push({
      id: g.id,
      label: trimBi(g.label, BOARD_LIMITS.textLength),
      x: num(g.x),
      y: num(g.y),
      // A zero-sized container would be invisible and unselectable.
      width: Math.max(120, num(g.width, 320)),
      height: Math.max(80, num(g.height, 200)),
    })
  }

  const nodes: BoardNode[] = []
  const nodeIds = new Set<string>()
  for (const entry of rawNodes) {
    const n = (entry ?? {}) as Record<string, unknown>
    if (typeof n.id !== 'string' || !ID.test(n.id)) return { ok: false, errors: ['nodes:bad_id'] }
    if (nodeIds.has(n.id)) return { ok: false, errors: ['nodes:duplicate_id'] }
    if (!isBi(n.title)) return { ok: false, errors: ['nodes:title_required'] }
    nodeIds.add(n.id)

    // A node pointing at a group that is not on the board would render nowhere.
    const group = typeof n.group === 'string' && groupIds.has(n.group) ? n.group : null

    nodes.push({
      id: n.id,
      kind: typeof n.kind === 'string' ? n.kind.slice(0, BOARD_LIMITS.idLength) : 'plain',
      x: num(n.x),
      y: num(n.y),
      ...(typeof n.width === 'number' && Number.isFinite(n.width)
        ? { width: Math.min(600, Math.max(160, n.width)) }
        : {}),
      icon: typeof n.icon === 'string' ? n.icon.slice(0, BOARD_LIMITS.idLength) : 'router',
      ...(isBi(n.kicker) ? { kicker: trimBi(n.kicker, BOARD_LIMITS.textLength) } : {}),
      title: trimBi(n.title, BOARD_LIMITS.textLength),
      ...(isBi(n.meta) ? { meta: trimBi(n.meta, BOARD_LIMITS.metaLength) } : {}),
      group,
      metric: typeof n.metric === 'string' && n.metric.trim() ? n.metric.trim().slice(0, 64) : null,
      note: typeof n.note === 'string' && n.note.trim() ? n.note.trim().slice(0, BOARD_LIMITS.noteLength) : null,
    })
  }

  const edges: BoardEdge[] = []
  const edgeIds = new Set<string>()
  const pairs = new Set<string>()
  for (const entry of rawEdges) {
    const e = (entry ?? {}) as Record<string, unknown>
    if (typeof e.id !== 'string' || !ID.test(e.id)) return { ok: false, errors: ['edges:bad_id'] }
    if (typeof e.source !== 'string' || typeof e.target !== 'string') return { ok: false, errors: ['edges:bad_ends'] }
    // A dangling edge would draw from nowhere; a self edge draws on top of its
    // own node. Both are dropped rather than rejected, because an editor that
    // just deleted a node should still be able to save.
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target) || e.source === e.target) continue
    if (edgeIds.has(e.id)) continue
    const pair = `${e.source}→${e.target}`
    if (pairs.has(pair)) continue
    edgeIds.add(e.id)
    pairs.add(pair)

    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(isBi(e.label) ? { label: trimBi(e.label, BOARD_LIMITS.textLength) } : {}),
      ...(e.variant === 'success' ? { variant: 'success' as const } : {}),
      ...(e.loopback === true ? { loopback: true as const } : {}),
    })
  }

  return { ok: true, graph: { nodes, edges, groups } }
}

/**
 * A URL-safe name. Latin letters and digits survive; everything else — Persian
 * included — becomes a separator, so a Persian-only name yields an empty slug
 * and the caller falls back to an id rather than to a meaningless one.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
