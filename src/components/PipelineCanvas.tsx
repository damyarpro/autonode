import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type NodeMouseHandler,
  type OnInit,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import StageNode, { type StageFlowNode } from './nodes/StageNode'
import LoopbackEdge from './nodes/LoopbackEdge'
import FlowEdge from './nodes/FlowEdge'
import { edges as edgeData, nodes as nodeData } from '../data/pipeline'
import { useI18n } from '../i18n/I18nProvider'

const DEFAULT_WIDTH = 285
const nodeTypes = { stage: StageNode }
const edgeTypes = { loopback: LoopbackEdge, flow: FlowEdge }

/** Right-most edge of the layout, used to mirror x for the RTL locale. */
const layoutWidth = Math.max(...nodeData.map((node) => node.x + (node.width ?? DEFAULT_WIDTH)))

const INITIAL_ZOOM = 0.8
/** A narrow screen trades a little card size for a second column of context. */
const COMPACT_ZOOM = 0.66
/** World y of the group rail, and of the first row of cards under it. */
const RAIL_Y = -235
const FIRST_ROW_Y = 20
/** Below this many pixels of canvas the rail is not worth the height it costs. */
const RAIL_ROOM = 560

/** Stacks the reinvestment edges on separate rails so they never overlap. */
const loopbackOrder = edgeData.filter((edge) => edge.loopback).map((edge) => edge.id)
const loopbackRail = (index: number) => loopbackOrder.indexOf(edgeData[index].id)

export type CanvasProps = {
  /** Live values keyed `<nodeId>.<slot>`; empty falls back to the seeded copy. */
  metrics: Record<string, number>
  /** Bump counters per edge id, each one firing a single bright pulse. */
  pulses: Record<string, number>
  /** Node ids touched by the latest events, highlighted briefly. */
  hotNodes: Record<string, number>
  /** Tapping a card asks the page to explain that node. */
  onOpenNode: (nodeId: string) => void
}

function Canvas({ metrics, pulses, hotNodes, onOpenNode }: CanvasProps) {
  const { t, isRtl } = useI18n()

  // A hit highlights its node for a moment, then clears itself.
  const [flash, setFlash] = useState<Record<string, boolean>>({})
  useEffect(() => {
    const ids = Object.keys(hotNodes)
    if (ids.length === 0) return
    setFlash(Object.fromEntries(ids.map((id) => [id, true])))
    const timer = window.setTimeout(() => setFlash({}), 1500)
    return () => window.clearTimeout(timer)
  }, [hotNodes])
  const wrapRef = useRef<HTMLDivElement>(null)

  // Open on the head of the funnel rather than fitting the whole 4,500px
  // layout, which would shrink every card past legibility. The top rail sits
  // at world y ≈ -235, so anchor that just under the KPI bar — but only when
  // there is height to spend on it. A phone canvas is a few hundred pixels
  // tall, and anchoring the rail there opened the board on empty air with the
  // first row of cards below the fold, so a short canvas anchors that row.
  const onInit = useCallback<OnInit<StageFlowNode, Edge>>(
    (instance) => {
      const width = wrapRef.current?.clientWidth ?? 1440
      const height = wrapRef.current?.clientHeight ?? 900
      const zoom = width < 1024 ? COMPACT_ZOOM : INITIAL_ZOOM
      const topWorldY = height < RAIL_ROOM ? FIRST_ROW_Y : RAIL_Y
      instance.setViewport({
        x: isRtl ? width - 40 - layoutWidth * zoom : 40 + 40 * zoom,
        y: 26 - topWorldY * zoom,
        zoom,
      })
    },
    [isRtl],
  )

  const flowNodes = useMemo<StageFlowNode[]>(
    () =>
      nodeData.map((node, index) => {
        const width = node.width ?? DEFAULT_WIDTH
        return {
          id: node.id,
          type: 'stage' as const,
          // The canvas itself stays LTR (React Flow positions by transform);
          // for Persian we mirror the layout so the funnel reads right-to-left.
          position: { x: isRtl ? layoutWidth - node.x - width : node.x, y: node.y },
          data: {
            ...node,
            order: index,
            live: flash[node.id] ?? false,
            liveMetrics: {
              badge: metrics[`${node.id}.badge`],
              stat: metrics[`${node.id}.stat`],
              stat2: metrics[`${node.id}.stat2`],
            },
          } as StageFlowNode['data'],
          draggable: false,
        }
      }),
    [isRtl, metrics, flash],
  )

  const onNodeClick = useCallback<NodeMouseHandler<StageFlowNode>>(
    (_event, node) => onOpenNode(node.id),
    [onOpenNode],
  )

  const flowEdges = useMemo<Edge[]>(
    () =>
      edgeData.map((edge, i) => {
        const success = edge.variant === 'success'
        const stroke = success ? 'rgba(52,211,153,0.75)' : 'rgba(124,92,255,0.7)'
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.loopback ? 'loopback' : 'flow',
          data: edge.loopback
            ? { rail: -150 - loopbackRail(i) * 34 }
            : // Stagger the pulses so the whole board never blinks in unison.
              { variant: edge.variant, delay: (i % 7) * 0.42, burst: pulses[edge.id] ?? 0 },
          label: edge.label ? t(edge.label) : undefined,
          sourceHandle: edge.loopback ? 'source-t' : isRtl ? 'source-l' : 'source-r',
          targetHandle: edge.loopback ? 'target-t' : isRtl ? 'target-r' : 'target-l',
          markerEnd: { type: MarkerType.ArrowClosed, width: 11, height: 11, color: stroke },
        }
      }),
    [isRtl, t, pulses],
  )

  return (
    <div ref={wrapRef} className="h-full w-full">
    <ReactFlow
      key={isRtl ? 'fa' : 'en'}
      onInit={onInit}
      // Keep the flow viewport LTR in both locales; only the layout mirrors.
      dir="ltr"
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.15}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      elementsSelectable
      onNodeClick={onNodeClick}
    >
      <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="rgba(255,255,255,0.06)" />
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
    </div>
  )
}

export default function PipelineCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
