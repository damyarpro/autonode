import { useCallback, useMemo, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
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

/** Stacks the reinvestment edges on separate rails so they never overlap. */
const loopbackOrder = edgeData.filter((edge) => edge.loopback).map((edge) => edge.id)
const loopbackRail = (index: number) => loopbackOrder.indexOf(edgeData[index].id)

function Canvas() {
  const { t, isRtl } = useI18n()
  const wrapRef = useRef<HTMLDivElement>(null)

  // Open on the head of the funnel rather than fitting the whole 4,500px
  // layout, which would shrink every card past legibility. The top rail sits
  // at world y ≈ -235, so anchor that just under the KPI bar.
  const onInit = useCallback<OnInit<StageFlowNode, Edge>>(
    (instance) => {
      const width = wrapRef.current?.clientWidth ?? 1440
      instance.setViewport({
        x: isRtl ? width - 40 - layoutWidth * INITIAL_ZOOM : 40 + 40 * INITIAL_ZOOM,
        y: 26 + 235 * INITIAL_ZOOM,
        zoom: INITIAL_ZOOM,
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
          data: { ...node, order: index } as StageFlowNode['data'],
          draggable: false,
        }
      }),
    [isRtl],
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
              { variant: edge.variant, delay: (i % 7) * 0.42 },
          label: edge.label ? t(edge.label) : undefined,
          sourceHandle: edge.loopback ? 'source-t' : isRtl ? 'source-l' : 'source-r',
          targetHandle: edge.loopback ? 'target-t' : isRtl ? 'target-r' : 'target-l',
          markerEnd: { type: MarkerType.ArrowClosed, width: 11, height: 11, color: stroke },
        }
      }),
    [isRtl, t],
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
    >
      <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="rgba(255,255,255,0.06)" />
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
    </div>
  )
}

export default function PipelineCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
