import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BOARD_LIMITS, type Bi, type BoardEdge, type BoardGraph, type BoardGroup, type BoardNode } from '../../../shared/boardGraph'
import type { NodeCategory, NodeKind } from '../../data/nodeKinds'

/**
 * Every rule the board editor has, as pure functions, plus the one hook that
 * owns the graph and its history. There is no client test runner in this repo,
 * so the rules are written as functions a runner could take as-is rather than
 * as logic buried in an event handler.
 *
 * A function that refuses a change returns the graph it was given, unchanged and
 * by identity. `apply()` compares by identity, so a refused change costs no
 * history entry and the person's undo stack still means what they think it does.
 */

/** Card geometry, used only to fit a group box around its members. */
export const NODE_WIDTH = 285
export const NODE_HEIGHT = 96
export const GROUP_PADDING = 28
/** Room above the members for the group's own label. */
export const GROUP_HEADER = 36
export const GROUP_MIN_WIDTH = 320
export const GROUP_MIN_HEIGHT = 180
export const HISTORY_LIMIT = 60

export type Box = { x: number; y: number; width: number; height: number }

// ── small pure helpers ──────────────────────────────────────────────────

/** Both languages, or the name is not sayable in one of them (rule 2). */
export const biIsComplete = (bi: Bi): boolean => bi.fa.trim().length > 0 && bi.en.trim().length > 0

export const trimBi = (bi: Bi, max: number = BOARD_LIMITS.textLength): Bi => ({
  fa: bi.fa.trim().slice(0, max),
  en: bi.en.trim().slice(0, max),
})

export const biEquals = (a: Bi | undefined, b: Bi | undefined): boolean =>
  a === b || (!!a && !!b && a.fa === b.fa && a.en === b.en)

/**
 * A fresh id that no element on the board holds. Ids travel in JSON and in React
 * keys, so they stay inside `normalizeGraph`'s alphabet.
 */
export function makeId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  for (let i = 1; i <= 100000; i += 1) {
    const id = `${prefix}${i}`
    if (!used.has(id)) return id
  }
  // Unreachable below the board caps; a timestamp is still a legal id.
  return `${prefix}${Date.now()}`
}

const nodeWidthOf = (node: BoardNode): number => node.width ?? NODE_WIDTH

/**
 * The x a node is drawn at when the locale is right-to-left. The canvas itself
 * stays LTR because React Flow positions by CSS transform, so the board mirrors
 * its coordinates instead (rule 3). The axis is the world origin rather than the
 * board's right edge: an editor grows as nodes are dropped, and mirroring about
 * a moving edge would shuffle every other card each time one was added.
 * The function is its own inverse, so the same call converts back.
 */
export const mirrorX = (x: number, width: number): number => -x - width

export const toScreenX = (x: number, width: number, isRtl: boolean): number => (isRtl ? mirrorX(x, width) : x)
export const toWorldX = (screenX: number, width: number, isRtl: boolean): number =>
  isRtl ? mirrorX(screenX, width) : screenX

// ── graph reads ─────────────────────────────────────────────────────────

export const findNode = (graph: BoardGraph, id: string): BoardNode | undefined =>
  graph.nodes.find((node) => node.id === id)

export const findGroup = (graph: BoardGraph, id: string): BoardGroup | undefined =>
  graph.groups.find((group) => group.id === id)

export const membersOf = (graph: BoardGraph, groupId: string): BoardNode[] =>
  graph.nodes.filter((node) => node.group === groupId)

/**
 * Edges whose two ends are both on the board. A graph that names a node it does
 * not carry must draw rather than throw (rule 8), so the missing ones are simply
 * not handed to React Flow — and are left in the graph, because a paste or an
 * undo may bring the other end back.
 */
export const drawableEdges = (graph: BoardGraph): BoardEdge[] => {
  const ids = new Set(graph.nodes.map((node) => node.id))
  return graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
}

// ── group boxes ─────────────────────────────────────────────────────────

/** The rectangle that holds every one of these nodes, with room for a label. */
export function boxAround(nodes: BoardNode[]): Box | null {
  if (nodes.length === 0) return null
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const node of nodes) {
    left = Math.min(left, node.x)
    top = Math.min(top, node.y)
    right = Math.max(right, node.x + nodeWidthOf(node))
    bottom = Math.max(bottom, node.y + NODE_HEIGHT)
  }
  return {
    x: left - GROUP_PADDING,
    y: top - GROUP_PADDING - GROUP_HEADER,
    width: Math.max(GROUP_MIN_WIDTH, right - left + GROUP_PADDING * 2),
    height: Math.max(GROUP_MIN_HEIGHT, bottom - top + GROUP_PADDING * 2 + GROUP_HEADER),
  }
}

/**
 * Groups are drawn behind their members and sized to them, so putting a node in
 * a group never moves the node. An empty group keeps the box it was created
 * with, which is the only thing left to show.
 */
export function withGroupBoxes(graph: BoardGraph): BoardGraph {
  let changed = false
  const groups = graph.groups.map((group) => {
    const box = boxAround(membersOf(graph, group.id))
    if (!box) return group
    if (box.x === group.x && box.y === group.y && box.width === group.width && box.height === group.height) return group
    changed = true
    return { ...group, ...box }
  })
  return changed ? { ...graph, groups } : graph
}

// ── mutations ───────────────────────────────────────────────────────────

/** A node the palette just dropped, carrying its kind's defaults. */
export function nodeOfKind(kind: NodeKind, x: number, y: number, taken: Iterable<string>): BoardNode {
  return {
    id: makeId('n', taken),
    kind: kind.id,
    x: Math.round(x),
    y: Math.round(y),
    ...(kind.defaults.width ? { width: kind.defaults.width } : {}),
    icon: kind.icon,
    ...(kind.defaults.kicker ? { kicker: kind.defaults.kicker } : {}),
    title: kind.defaults.title,
    ...(kind.defaults.meta ? { meta: kind.defaults.meta } : {}),
    group: null,
    // A kind with no metric shows no number; one is never invented (rule 5).
    metric: kind.metric ?? null,
    note: null,
  }
}

export function addNodeOfKind(graph: BoardGraph, kind: NodeKind, x: number, y: number): BoardGraph {
  if (graph.nodes.length >= BOARD_LIMITS.nodes) return graph
  const node = nodeOfKind(kind, x, y, graph.nodes.map((n) => n.id))
  return { ...graph, nodes: [...graph.nodes, node] }
}

export function duplicateNode(graph: BoardGraph, id: string): BoardGraph {
  const node = findNode(graph, id)
  if (!node || graph.nodes.length >= BOARD_LIMITS.nodes) return graph
  const copy: BoardNode = {
    ...node,
    id: makeId('n', graph.nodes.map((n) => n.id)),
    x: node.x + 28,
    y: node.y + 28,
  }
  return { ...graph, nodes: [...graph.nodes, copy] }
}

export function moveNodes(graph: BoardGraph, moves: { id: string; x: number; y: number }[]): BoardGraph {
  if (moves.length === 0) return graph
  const byId = new Map(moves.map((move) => [move.id, move]))
  let changed = false
  const nodes = graph.nodes.map((node) => {
    const move = byId.get(node.id)
    if (!move) return node
    const x = Math.round(move.x)
    const y = Math.round(move.y)
    if (x === node.x && y === node.y) return node
    changed = true
    return { ...node, x, y }
  })
  return changed ? { ...graph, nodes } : graph
}

/** A title with an empty side is refused: rule 2 is not optional for content. */
export function renameNode(graph: BoardGraph, id: string, title: Bi): BoardGraph {
  if (!biIsComplete(title)) return graph
  const next = trimBi(title)
  let changed = false
  const nodes = graph.nodes.map((node) => {
    if (node.id !== id || biEquals(node.title, next)) return node
    changed = true
    return { ...node, title: next }
  })
  return changed ? { ...graph, nodes } : graph
}

export function renameGroup(graph: BoardGraph, id: string, label: Bi): BoardGraph {
  if (!biIsComplete(label)) return graph
  const next = trimBi(label)
  let changed = false
  const groups = graph.groups.map((group) => {
    if (group.id !== id || biEquals(group.label, next)) return group
    changed = true
    return { ...group, label: next }
  })
  return changed ? { ...graph, groups } : graph
}

/**
 * Whether this connection may be drawn. A node cannot feed itself, and a pair
 * already joined is not joined twice — `normalizeGraph` drops both on save, so
 * accepting one here would lose the person's work without saying so.
 */
export function canConnect(graph: BoardGraph, source: string | null, target: string | null): boolean {
  if (!source || !target || source === target) return false
  if (!findNode(graph, source) || !findNode(graph, target)) return false
  if (graph.edges.length >= BOARD_LIMITS.edges) return false
  return !graph.edges.some((edge) => edge.source === source && edge.target === target)
}

export function connect(graph: BoardGraph, source: string | null, target: string | null): BoardGraph {
  if (!canConnect(graph, source, target)) return graph
  const edge: BoardEdge = {
    id: makeId('e', graph.edges.map((e) => e.id)),
    source: source as string,
    target: target as string,
  }
  return { ...graph, edges: [...graph.edges, edge] }
}

/** Deleting a node takes its edges with it; a dangling edge draws from nowhere. */
export function deleteElements(graph: BoardGraph, nodeIds: string[], edgeIds: string[], groupIds: string[] = []): BoardGraph {
  const nodes = new Set(nodeIds)
  const edges = new Set(edgeIds)
  const groups = new Set(groupIds)
  if (nodes.size === 0 && edges.size === 0 && groups.size === 0) return graph
  return {
    nodes: graph.nodes
      .filter((node) => !nodes.has(node.id))
      .map((node) => (node.group && groups.has(node.group) ? { ...node, group: null } : node)),
    edges: graph.edges.filter(
      (edge) => !edges.has(edge.id) && !nodes.has(edge.source) && !nodes.has(edge.target),
    ),
    groups: graph.groups.filter((group) => !groups.has(group.id)),
  }
}

export function setNodeGroup(graph: BoardGraph, nodeId: string, groupId: string | null): BoardGraph {
  if (groupId !== null && !findGroup(graph, groupId)) return graph
  let changed = false
  const nodes = graph.nodes.map((node) => {
    if (node.id !== nodeId || (node.group ?? null) === groupId) return node
    changed = true
    return { ...node, group: groupId }
  })
  return changed ? { ...graph, nodes } : graph
}

export const DEFAULT_GROUP_LABEL: Bi = { fa: 'گروه تازه', en: 'New group' }

/**
 * A group with the given members, or an empty box at the pointer when there are
 * none. The box is recomputed from the members by `withGroupBoxes`.
 */
export function addGroup(graph: BoardGraph, at: { x: number; y: number }, memberIds: string[] = []): BoardGraph {
  if (graph.groups.length >= BOARD_LIMITS.groups) return graph
  const id = makeId('g', graph.groups.map((group) => group.id))
  const group: BoardGroup = {
    id,
    label: DEFAULT_GROUP_LABEL,
    x: Math.round(at.x),
    y: Math.round(at.y),
    width: GROUP_MIN_WIDTH,
    height: GROUP_MIN_HEIGHT,
  }
  const members = new Set(memberIds)
  return {
    ...graph,
    groups: [...graph.groups, group],
    nodes: graph.nodes.map((node) => (members.has(node.id) ? { ...node, group: id } : node)),
  }
}

/**
 * Dragging a group carries its members; the box then refits around them.
 * `except` names members whose own position is being committed by the same
 * drag — a node the person is dragging along with the group would otherwise
 * move twice.
 */
export function moveGroupBy(
  graph: BoardGraph,
  groupId: string,
  dx: number,
  dy: number,
  except: Iterable<string> = [],
): BoardGraph {
  if (dx === 0 && dy === 0) return graph
  const group = findGroup(graph, groupId)
  if (!group) return graph
  const skip = new Set(except)
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.group === groupId && !skip.has(node.id)
        ? { ...node, x: Math.round(node.x + dx), y: Math.round(node.y + dy) }
        : node,
    ),
    groups: graph.groups.map((entry) =>
      entry.id === groupId ? { ...entry, x: Math.round(entry.x + dx), y: Math.round(entry.y + dy) } : entry,
    ),
  }
}

// ── history ─────────────────────────────────────────────────────────────

export type History = { past: BoardGraph[]; present: BoardGraph; future: BoardGraph[] }

export const startHistory = (graph: BoardGraph): History => ({ past: [], present: graph, future: [] })

/** A bounded stack: the oldest step is dropped rather than the newest refused. */
export function pushHistory(history: History, next: BoardGraph, limit: number = HISTORY_LIMIT): History {
  if (next === history.present) return history
  const past = [...history.past, history.present]
  return { past: past.length > limit ? past.slice(past.length - limit) : past, present: next, future: [] }
}

export function undoHistory(history: History): History {
  const previous = history.past[history.past.length - 1]
  if (previous === undefined) return history
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
  }
}

export function redoHistory(history: History): History {
  const next = history.future[0]
  if (next === undefined) return history
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1) }
}

// ── the hook ────────────────────────────────────────────────────────────

export type GraphEditor = {
  graph: BoardGraph
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  /** The one door every mutation goes through, so nothing escapes the history. */
  apply: (mutate: (graph: BoardGraph) => BoardGraph) => void
  /** Load a different board, discarding the history and emitting nothing. */
  reset: (graph: BoardGraph) => void
}

/**
 * Holds the board being edited. `onChange` fires once per accepted mutation and
 * once per undo or redo, always with the whole graph — a board is saved whole,
 * so a caller never has to reassemble one from deltas.
 */
export function useGraphEditor(initial: BoardGraph, onChange?: (next: BoardGraph) => void): GraphEditor {
  const [history, setHistory] = useState<History>(() => startHistory(initial))

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // The graph the caller has already been told about. Comparing by identity
  // keeps `reset` — a board arriving from outside — from echoing straight back.
  const emitted = useRef(history.present)
  useEffect(() => {
    if (history.present === emitted.current) return
    emitted.current = history.present
    onChangeRef.current?.(history.present)
  }, [history.present])

  const apply = useCallback((mutate: (graph: BoardGraph) => BoardGraph) => {
    setHistory((current) => pushHistory(current, withGroupBoxes(mutate(current.present))))
  }, [])

  const undo = useCallback(() => setHistory(undoHistory), [])
  const redo = useCallback(() => setHistory(redoHistory), [])

  const reset = useCallback((graph: BoardGraph) => {
    emitted.current = graph
    setHistory(startHistory(graph))
  }, [])

  return useMemo(
    () => ({
      graph: history.present,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      undo,
      redo,
      apply,
      reset,
    }),
    [history, undo, redo, apply, reset],
  )
}

/** True while the keyboard belongs to a text field, where shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element || typeof element.tagName !== 'string') return false
  if (element.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
}

export type Shortcut = 'undo' | 'redo' | 'delete' | null

/** Which editor shortcut a key event is, if any. Never a shortcut while typing. */
export function shortcutFor(event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  target?: EventTarget | null
}): Shortcut {
  if (isTypingTarget(event.target ?? null)) return null
  const mod = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()
  if (mod && key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (mod && key === 'y') return 'redo'
  if (!mod && (event.key === 'Delete' || event.key === 'Backspace')) return 'delete'
  return null
}

// ── the palette ─────────────────────────────────────────────────────────

/**
 * Persian is typed with more than one keyboard: the Arabic ye and kaf look like
 * the Persian ones and sort differently, and a zero-width non-joiner sits inside
 * many words. Folding them means "کارخانه" finds "کارخانه‌ی محتوا".
 */
export function foldSearch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200e\u200f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Does this kind answer the palette's search box, in either language? */
export function kindMatches(kind: NodeKind, query: string): boolean {
  const needle = foldSearch(query)
  if (!needle) return true
  const haystack = foldSearch(
    [kind.label.fa, kind.label.en, kind.hint.fa, kind.hint.en, kind.id, kind.category].join(' '),
  )
  return needle.split(' ').every((word) => haystack.includes(word))
}

/**
 * The palette the right-click menu draws: the shared grouping, narrowed by the
 * search box. The catalogue is long enough that an unfiltered flat list is
 * unusable, but the grouping stays so a search of nothing still reads as one.
 */
export function filterPalette(
  groups: { category: NodeCategory; kinds: NodeKind[] }[],
  query: string,
): { category: NodeCategory; kinds: NodeKind[] }[] {
  if (!foldSearch(query)) return groups
  return groups
    .map((group) => ({ category: group.category, kinds: group.kinds.filter((kind) => kindMatches(kind, query)) }))
    .filter((group) => group.kinds.length > 0)
}
