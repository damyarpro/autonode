import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type OnNodeDrag,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import BoardNodeCard, { BoardGroupBox, type BoardFlowNode } from './BoardNodeCard'
import BoardContextMenu, { type BoardMenu, type MenuActions } from './ContextMenu'
import { useI18n } from '../../i18n/I18nProvider'
import type { Bi, BoardGraph } from '../../../shared/boardGraph'
import {
  GROUP_MIN_WIDTH,
  NODE_WIDTH,
  addGroup,
  addNodeOfKind,
  canConnect,
  connect,
  deleteElements,
  drawableEdges,
  duplicateNode,
  findNode,
  membersOf,
  moveGroupBy,
  moveNodes,
  renameGroup,
  renameNode,
  setNodeGroup,
  shortcutFor,
  toScreenX,
  toWorldX,
  useGraphEditor,
} from './useGraphEditor'

/**
 * The editable board. A page mounts it with a graph and gets a whole graph back
 * on every change; nothing above it needs to know React Flow exists.
 *
 * Rule 3 has one exception and this is it: the flow canvas stays `dir="ltr"`,
 * because React Flow positions by CSS transform and an RTL container would
 * fight it. The board mirrors its coordinates instead — see `mirrorX` — so in
 * Persian the funnel still reads right to left. Everything outside the canvas,
 * the context menu included, mirrors the ordinary way.
 */

const COPY = {
  emptyTitle: { fa: 'بوم خالی است', en: 'The board is empty' },
  emptyBody: {
    fa: 'روی فضای خالی راست‌کلیک کن — یا انگشتت را نگه دار — تا پالت نودها باز شود.',
    en: 'Right-click the canvas — or press and hold — to open the node palette.',
  },
  readOnly: { fa: 'فقط خواندنی', en: 'Read-only' },
}

const nodeTypes = { boardCard: BoardNodeCard, boardGroup: BoardGroupBox }

const EDGE_STROKE = 'rgba(124,92,255,0.7)'
const EDGE_SUCCESS = 'rgba(52,211,153,0.75)'

/** Group boxes are React Flow nodes too, so their ids live in their own space. */
const GROUP_PREFIX = 'group:'
const groupNodeId = (id: string) => `${GROUP_PREFIX}${id}`
const isGroupNodeId = (id: string) => id.startsWith(GROUP_PREFIX)
const groupIdOf = (nodeId: string) => nodeId.slice(GROUP_PREFIX.length)

/** How long a touch has to rest before it counts as a right-click. */
const LONG_PRESS_MS = 480

export type EditableCanvasProps = {
  graph: BoardGraph
  /** A board someone else published: it draws and pans, and nothing else. */
  readOnly?: boolean
  /** Fires once per accepted change, always with the whole graph. */
  onChange?: (next: BoardGraph) => void
  /** Live numbers, keyed as the node's `metric`. */
  metrics?: Record<string, number>
  /** Lets a page keep an undo button enabled or greyed without polling the ref. */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void
  /** Where a node's "open the tool" action goes; the page owns routing. */
  onOpenRoute?: (to: string) => void
  className?: string
}

export type EditableCanvasHandle = {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** The graph as edited, for a save button that does not track `onChange`. */
  graph: BoardGraph
  fitView: () => void
}

type Props = EditableCanvasProps & { innerRef: React.ForwardedRef<EditableCanvasHandle> }

function Editor({
  graph,
  readOnly = false,
  onChange,
  metrics,
  onHistoryChange,
  onOpenRoute,
  className,
  innerRef,
}: Props) {
  const { t, isRtl } = useI18n()
  const wrap = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()

  // The board the page last handed us. Everything here compares by identity: a
  // page that feeds `onChange` straight back hands us the very object we are
  // already showing, and a page that keeps no state at all never changes the
  // prop — neither may cost the person their edits.
  const lastProp = useRef(graph)

  const editor = useGraphEditor(graph, onChange)
  const { apply, canUndo, canRedo, undo, redo } = editor
  const current = editor.graph

  // A genuinely different board from the page — another board opened, an older
  // version previewed, a save reloaded — replaces what is being edited, history
  // and all. A prop that is already the graph on screen is not one of those.
  useEffect(() => {
    if (graph === lastProp.current) return
    lastProp.current = graph
    if (graph === editor.graph) return
    editor.reset(graph)
  }, [graph, editor])

  const [menu, setMenu] = useState<BoardMenu | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  const commitTitle = useCallback(
    (id: string, title: Bi) => {
      apply((g) => renameNode(g, id, title))
      setEditingId(null)
    },
    [apply],
  )
  const commitLabel = useCallback(
    (id: string, label: Bi) => {
      apply((g) => renameGroup(g, id, label))
      setEditingId(null)
    },
    [apply],
  )
  const cancelEdit = useCallback(() => setEditingId(null), [])

  // ── graph → React Flow ────────────────────────────────────────────────

  const buildNodes = useCallback((): BoardFlowNode[] => {
    const groups: BoardFlowNode[] = current.groups.map((group) => ({
      id: groupNodeId(group.id),
      type: 'boardGroup' as const,
      position: { x: toScreenX(group.x, group.width, isRtl), y: group.y },
      style: { width: group.width, height: group.height },
      draggable: !readOnly,
      connectable: false,
      zIndex: 0,
      data: {
        group,
        members: membersOf(current, group.id).length,
        editing: editingId === groupNodeId(group.id),
        readOnly,
        onCommitLabel: commitLabel,
        onCancelEdit: cancelEdit,
      },
    }))

    const cards: BoardFlowNode[] = current.nodes.map((node) => ({
      id: node.id,
      type: 'boardCard' as const,
      position: { x: toScreenX(node.x, node.width ?? NODE_WIDTH, isRtl), y: node.y },
      draggable: !readOnly,
      connectable: !readOnly,
      zIndex: 1,
      data: {
        node,
        metric: node.metric ? metrics?.[node.metric] : undefined,
        editing: editingId === node.id,
        readOnly,
        onCommitTitle: commitTitle,
        onCancelEdit: cancelEdit,
      },
    }))

    // Boxes first: React Flow paints in array order, so the group sits behind.
    return [...groups, ...cards]
  }, [current, isRtl, metrics, editingId, readOnly, commitTitle, commitLabel, cancelEdit])

  const buildEdges = useCallback(
    (): Edge[] =>
      // An edge whose end is missing is not handed to the canvas; a graph that
      // names a node it does not carry still draws (rule 8).
      drawableEdges(current).map((edge) => {
        const stroke = edge.variant === 'success' ? EDGE_SUCCESS : EDGE_STROKE
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          sourceHandle: isRtl ? 'source-l' : 'source-r',
          targetHandle: isRtl ? 'target-r' : 'target-l',
          ...(edge.label ? { label: t(edge.label) } : {}),
          style: { stroke, strokeWidth: 1.4, ...(edge.loopback ? { strokeDasharray: '7 7' } : {}) },
          markerEnd: { type: MarkerType.ArrowClosed, width: 11, height: 11, color: stroke },
        }
      }),
    [current, isRtl, t],
  )

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<BoardFlowNode>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])

  // React Flow owns the nodes while they are being dragged or selected; the
  // graph owns them the rest of the time. Rebuilding keeps the selection, which
  // the delete key reads.
  // A rebuild in the middle of a drag — a live metric arriving, say — must not
  // snap the card out from under the finger holding it.
  const dragging = useRef<Set<string>>(new Set())

  useEffect(() => {
    setRfNodes((previous) => {
      const before = new Map(previous.map((node) => [node.id, node]))
      return buildNodes().map((node) => {
        const old = before.get(node.id)
        if (!old) return node
        return {
          ...node,
          selected: old.selected ?? false,
          position: dragging.current.has(node.id) ? old.position : node.position,
        }
      })
    })
  }, [buildNodes, setRfNodes])

  useEffect(() => {
    setRfEdges((previous) => {
      const selected = new Set(previous.filter((edge) => edge.selected).map((edge) => edge.id))
      return buildEdges().map((edge) => (selected.has(edge.id) ? { ...edge, selected: true } : edge))
    })
  }, [buildEdges, setRfEdges])

  // ── moving ────────────────────────────────────────────────────────────

  const drag = useRef<{ groupId: string; fromX: number; fromY: number; lastX: number; lastY: number } | null>(null)

  const onNodeDragStart = useCallback<OnNodeDrag<BoardFlowNode>>(
    (_event, node, dragged) => {
      const held = new Set(dragged.map((entry) => entry.id))
      drag.current = isGroupNodeId(node.id)
        ? { groupId: groupIdOf(node.id), fromX: node.position.x, fromY: node.position.y, lastX: node.position.x, lastY: node.position.y }
        : null
      // A group carries its members, so they are held by this drag as well.
      if (drag.current) for (const member of membersOf(current, drag.current.groupId)) held.add(member.id)
      dragging.current = held
    },
    [current],
  )

  // A group is not a React Flow parent, so its members are moved by hand — this
  // is the frame-by-frame half, purely so the drag looks right.
  const onNodeDrag = useCallback<OnNodeDrag<BoardFlowNode>>(
    (_event, node, dragged) => {
      const state = drag.current
      if (!state || !isGroupNodeId(node.id)) return
      const dx = node.position.x - state.lastX
      const dy = node.position.y - state.lastY
      state.lastX = node.position.x
      state.lastY = node.position.y
      if (dx === 0 && dy === 0) return
      const carried = new Set(dragged.map((entry) => entry.id))
      const members = new Set(membersOf(current, state.groupId).map((entry) => entry.id))
      setRfNodes((previous) =>
        previous.map((entry) =>
          members.has(entry.id) && !carried.has(entry.id)
            ? { ...entry, position: { x: entry.position.x + dx, y: entry.position.y + dy } }
            : entry,
        ),
      )
    },
    [current, setRfNodes],
  )

  const onNodeDragStop = useCallback<OnNodeDrag<BoardFlowNode>>(
    (_event, node, dragged) => {
      const cards = dragged.filter((entry) => !isGroupNodeId(entry.id))
      const moves = cards.map((entry) => {
        const width = (entry.data as { node?: { width?: number } }).node?.width ?? NODE_WIDTH
        return { id: entry.id, x: toWorldX(entry.position.x, width, isRtl), y: entry.position.y }
      })

      const state = drag.current
      drag.current = null
      dragging.current = new Set()

      if (state && isGroupNodeId(node.id)) {
        const dxScreen = node.position.x - state.fromX
        const dy = node.position.y - state.fromY
        const dx = isRtl ? -dxScreen : dxScreen
        const carried = cards.map((entry) => entry.id)
        apply((g) => moveNodes(moveGroupBy(g, state.groupId, dx, dy, carried), moves))
        return
      }

      apply((g) => moveNodes(g, moves))
    },
    [apply, isRtl],
  )

  // ── connecting ────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => apply((g) => connect(g, connection.source, connection.target)),
    [apply],
  )

  // Refused quietly: React Flow simply will not drop the connection.
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => canConnect(current, connection.source, connection.target),
    [current],
  )

  // ── menus ─────────────────────────────────────────────────────────────

  const openMenuAt = useCallback(
    (cx: number, cy: number, target?: string) => {
      if (readOnly) return
      if (target && isGroupNodeId(target)) {
        setMenu({ kind: 'group', cx, cy, groupId: groupIdOf(target) })
        return
      }
      if (target) {
        setMenu({ kind: 'node', cx, cy, nodeId: target })
        return
      }
      setMenu({ kind: 'pane', cx, cy, at: screenToFlowPosition({ x: cx, y: cy }) })
    },
    [readOnly, screenToFlowPosition],
  )

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      openMenuAt(event.clientX, event.clientY)
    },
    [openMenuAt],
  )

  const onNodeContextMenu = useCallback<NodeMouseHandler<BoardFlowNode>>(
    (event, node) => {
      event.preventDefault()
      openMenuAt(event.clientX, event.clientY, node.id)
    },
    [openMenuAt],
  )

  // A phone has no right button, so a resting finger opens the same menu.
  const press = useRef<{ timer: number; x: number; y: number } | null>(null)
  const clearPress = useCallback(() => {
    if (press.current) window.clearTimeout(press.current.timer)
    press.current = null
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (readOnly || event.pointerType === 'mouse') return
      const element = event.target as HTMLElement
      const host = element.closest?.('.react-flow__node') as HTMLElement | null
      const id = host?.getAttribute('data-id') ?? undefined
      const { clientX: x, clientY: y } = event
      clearPress()
      press.current = { x, y, timer: window.setTimeout(() => openMenuAt(x, y, id), LONG_PRESS_MS) }
    },
    [readOnly, clearPress, openMenuAt],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const state = press.current
      if (!state) return
      if (Math.abs(event.clientX - state.x) > 8 || Math.abs(event.clientY - state.y) > 8) clearPress()
    },
    [clearPress],
  )

  const menuActions = useMemo<MenuActions>(
    () => ({
      addKind: (kind) => {
        if (menu?.kind !== 'pane') return
        const width = kind.defaults.width ?? NODE_WIDTH
        apply((g) => addNodeOfKind(g, kind, toWorldX(menu.at.x, width, isRtl), menu.at.y))
        closeMenu()
      },
      addGroup: () => {
        if (menu?.kind !== 'pane') return
        apply((g) => addGroup(g, { x: toWorldX(menu.at.x, GROUP_MIN_WIDTH, isRtl), y: menu.at.y }))
        closeMenu()
      },
      renameNode: (id) => {
        setEditingId(id)
        closeMenu()
      },
      duplicateNode: (id) => {
        apply((g) => duplicateNode(g, id))
        closeMenu()
      },
      deleteNode: (id) => {
        apply((g) => deleteElements(g, [id], []))
        closeMenu()
      },
      assignGroup: (id, groupId) => {
        apply((g) => setNodeGroup(g, id, groupId))
        closeMenu()
      },
      groupWithNew: (id) => {
        const node = findNode(current, id)
        apply((g) => addGroup(g, { x: node?.x ?? 0, y: node?.y ?? 0 }, [id]))
        closeMenu()
      },
      openLink: (href, external) => {
        closeMenu()
        if (external) {
          window.open(href, '_blank', 'noopener,noreferrer')
          return
        }
        // The page owns routing; without a handler the app's hash router does.
        if (onOpenRoute) onOpenRoute(href)
        else window.location.hash = `#${href}`
      },
      renameGroup: (id) => {
        setEditingId(groupNodeId(id))
        closeMenu()
      },
      deleteGroup: (id) => {
        apply((g) => deleteElements(g, [], [], [id]))
        closeMenu()
      },
    }),
    [menu, apply, isRtl, closeMenu, current, onOpenRoute],
  )

  // ── keyboard ──────────────────────────────────────────────────────────

  const selection = useRef({ nodes: rfNodes, edges: rfEdges })
  selection.current = { nodes: rfNodes, edges: rfEdges }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Only when the board has the keyboard: a form elsewhere on the page
      // keeps its own undo.
      const root = wrap.current
      const active = document.activeElement
      if (!root) return
      if (active && active !== document.body && !root.contains(active)) return

      const shortcut = shortcutFor(event)
      if (!shortcut) return
      if (readOnly) return

      if (shortcut === 'undo') {
        event.preventDefault()
        undo()
        return
      }
      if (shortcut === 'redo') {
        event.preventDefault()
        redo()
        return
      }

      const { nodes, edges } = selection.current
      const chosen = nodes.filter((node) => node.selected)
      const chosenEdges = edges.filter((edge) => edge.selected).map((edge) => edge.id)
      const nodeIds = chosen.filter((node) => !isGroupNodeId(node.id)).map((node) => node.id)
      const groupIds = chosen.filter((node) => isGroupNodeId(node.id)).map((node) => groupIdOf(node.id))
      if (nodeIds.length === 0 && groupIds.length === 0 && chosenEdges.length === 0) return
      event.preventDefault()
      apply((g) => deleteElements(g, nodeIds, chosenEdges, groupIds))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [apply, undo, redo, readOnly])

  // ── what the page can hold ────────────────────────────────────────────

  useImperativeHandle(
    innerRef,
    () => ({ undo, redo, canUndo, canRedo, graph: current, fitView: () => fitView({ padding: 0.3 }) }),
    [undo, redo, canUndo, canRedo, current, fitView],
  )

  const lastHistory = useRef({ canUndo: false, canRedo: false })
  useEffect(() => {
    if (lastHistory.current.canUndo === canUndo && lastHistory.current.canRedo === canRedo) return
    lastHistory.current = { canUndo, canRedo }
    onHistoryChange?.({ canUndo, canRedo })
  }, [canUndo, canRedo, onHistoryChange])

  const empty = current.nodes.length === 0 && current.groups.length === 0

  return (
    <div
      ref={wrap}
      className={`relative h-full w-full ${className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
    >
      <ReactFlow
        key={isRtl ? 'fa' : 'en'}
        // The canvas stays LTR in both locales; the coordinates mirror instead.
        dir="ltr"
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        // Deleting is handled with the rest of the shortcuts, in one place that
        // knows not to fire while someone is typing a name.
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="rgba(255,255,255,0.06)" />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>

      {empty && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6">
          <div className="max-w-[300px] rounded-2xl border border-hairline bg-panel/80 px-4 py-3 text-center backdrop-blur">
            <p className="text-[13px] font-semibold text-white/85">{t(COPY.emptyTitle)}</p>
            {!readOnly && <p className="mt-1 text-[11px] leading-relaxed text-white/45">{t(COPY.emptyBody)}</p>}
          </div>
        </div>
      )}

      {readOnly && (
        <span className="pointer-events-none absolute top-3 rounded-full border border-hairline bg-panel/85 px-2.5 py-1 text-[10px] text-white/50 backdrop-blur end-3">
          {t(COPY.readOnly)}
        </span>
      )}

      {menu && !readOnly && (
        <BoardContextMenu menu={menu} graph={current} actions={menuActions} onClose={closeMenu} />
      )}
    </div>
  )
}

/**
 * Undo and redo are on an imperative handle rather than in the props, because
 * the history belongs to the canvas: a page that owned it would have to own the
 * graph state too, and every page mounting a board would reimplement it. The
 * handle carries `canUndo`/`canRedo` for a caller that reads them on demand,
 * and `onHistoryChange` fires when they flip so a toolbar can re-render.
 */
const EditableCanvas = forwardRef<EditableCanvasHandle, EditableCanvasProps>(function EditableCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <Editor {...props} innerRef={ref} />
    </ReactFlowProvider>
  )
})

export default EditableCanvas
