import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

/**
 * The workhorse edge: a thin solid pipe with a lead marker sitting at the port
 * it leaves from, and a pulse that travels source → target so the funnel reads
 * as moving rather than static.
 */
export default function FlowEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  label,
  markerEnd,
  data,
}: EdgeProps) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
  })

  const success = data?.variant === 'success'
  const stroke = success ? 'rgba(52,211,153,0.75)' : 'rgba(124,92,255,0.7)'
  const pulse = success ? '#34d399' : '#a78bfa'
  const length = Math.hypot(targetX - sourceX, targetY - sourceY)
  const duration = Math.min(4.2, Math.max(1.7, length / 150))
  const delay = typeof data?.delay === 'number' ? data.delay : 0
  const markerX = sourceX + (sourcePosition === 'left' ? -11 : 11)

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: 1.4 }} />

      {/* Lead marker at the outgoing port, as drawn on the reference board. */}
      <g transform={`translate(${markerX} ${sourceY})`} opacity={0.7}>
        <circle r={6.2} fill="#07070c" stroke={stroke} strokeWidth={1} />
        <circle cx={0} cy={-1.3} r={1.4} fill={stroke} />
        <path d="M-2.5 2.9a2.5 2.5 0 0 1 5 0" fill="none" stroke={stroke} strokeWidth={1} strokeLinecap="round" />
      </g>

      <circle r={2.6} fill={pulse} opacity={0.95} style={{ filter: `drop-shadow(0 0 4px ${pulse})` }}>
        <animateMotion dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          keyTimes="0;0.12;0.88;1"
          dur={`${duration}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
      </circle>

      {label && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute whitespace-nowrap text-[9px] tracking-wide text-white/40"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 9}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
