import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react'

/** Rounded orthogonal path: up out of the source, across the top, down into the target. */
function arcPath(sx: number, sy: number, tx: number, ty: number, topY: number, r = 26) {
  const dir = tx > sx ? 1 : -1
  const rr = Math.min(r, Math.abs(tx - sx) / 2, Math.abs(sy - topY), Math.abs(ty - topY))
  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${topY + rr}`,
    `Q ${sx} ${topY} ${sx + dir * rr} ${topY}`,
    `L ${tx - dir * rr} ${topY}`,
    `Q ${tx} ${topY} ${tx} ${topY + rr}`,
    `L ${tx} ${ty}`,
  ].join(' ')
}

export default function LoopbackEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  markerEnd,
  data,
}: EdgeProps) {
  // A shared rail above the whole layout, so every reinvestment edge runs
  // along the top instead of cutting back through the funnel.
  const topY = typeof data?.rail === 'number' ? data.rail : -150
  const path = arcPath(sourceX, sourceY, targetX, targetY, topY)
  const midX = (sourceX + targetX) / 2

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: 'rgba(124,92,255,0.55)',
          strokeWidth: 1.4,
          strokeDasharray: '7 7',
          animation: 'dashdraw 1.1s linear infinite',
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-full border border-accent/30 bg-canvas/90 px-2 py-0.5 text-[9px] text-accent/90"
            style={{ transform: `translate(-50%, -50%) translate(${midX}px, ${topY}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
