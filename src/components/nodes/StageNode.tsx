import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { NodeIcon } from '../icons'
import { useI18n } from '../../i18n/I18nProvider'
import type { StageNodeData } from '../../data/types'

export type StageFlowNode = Node<StageNodeData & Record<string, unknown>, 'stage'>

const handleStyle = { opacity: 0, width: 1, height: 1, border: 'none' }

/**
 * The one card component behind every box on the canvas. Numbers come from the
 * slot's live value when the API is reachable and from its fallback otherwise —
 * the card itself does not know which.
 */
export default function StageNode({ data, selected }: NodeProps<StageFlowNode>) {
  const { t, slot, isRtl } = useI18n()
  const success = data.variant === 'success'
  const order = typeof data.order === 'number' ? data.order : 0
  const live = (data.liveMetrics ?? {}) as Record<string, number>

  const badge = slot(data.badge, live.badge)
  const stat = slot(data.stat, live.stat)
  const stat2 = slot(data.stat2, live.stat2)

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={[
        'node-in group relative rounded-[14px] border px-3.5 py-3 text-start transition duration-200',
        'bg-[linear-gradient(160deg,rgba(24,24,34,0.97),rgba(11,11,17,0.97))]',
        'hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_10px_30px_-16px_rgba(124,92,255,0.9)]',
        success ? 'border-success/45 shadow-[0_0_30px_-10px_rgba(52,211,153,0.6)]' : 'border-hairline',
        data.aiStack ? 'ai-glow' : '',
        data.live ? 'node-hit' : '',
        selected ? 'ring-1 ring-accent/70' : '',
      ].join(' ')}
      style={{ width: data.width ?? 285, animationDelay: `${order * 45}ms` }}
    >
      <Handle id="target-l" type="target" position={Position.Left} style={handleStyle} />
      <Handle id="target-r" type="target" position={Position.Right} style={handleStyle} />
      <Handle id="source-l" type="source" position={Position.Left} style={handleStyle} />
      <Handle id="source-r" type="source" position={Position.Right} style={handleStyle} />
      <Handle id="target-t" type="target" position={Position.Top} style={handleStyle} />
      <Handle id="source-t" type="source" position={Position.Top} style={handleStyle} />

      <div className="flex items-center gap-3">
        {badge && (
          <span
            className={[
              'grid h-7 shrink-0 place-items-center rounded-full px-2 text-[10px] font-semibold tabular-nums',
              badge.length > 3 ? 'min-w-[42px]' : 'w-7 px-0',
              success ? 'bg-success/15 text-success' : 'bg-white/[0.08] text-white/70',
            ].join(' ')}
          >
            {badge}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/35">{t(data.kicker)}</div>
          <div className={`truncate text-[13px] font-semibold ${success ? 'text-success' : 'text-white/92'}`}>
            {t(data.title)}
          </div>
        </div>
        <NodeIcon icon={data.icon} />
      </div>

      {data.chain && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-[10px] border border-hairline bg-black/45 px-2.5 py-1.5">
          {data.chain.map((key, i) => (
            <span key={`${key}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-[10px] text-white/25">{isRtl ? '‹' : '›'}</span>}
              <NodeIcon icon={key} size={17} />
            </span>
          ))}
          <span className="ms-auto text-[8px] font-semibold uppercase tracking-[0.18em] text-white/25">AI STACK</span>
        </div>
      )}

      {(data.meta || stat || stat2) && (
        <div className="mt-2.5 border-t border-hairline pt-2">
          <div className="flex items-baseline gap-2">
            {data.meta && <span className="text-[10px] leading-relaxed text-white/40">{t(data.meta)}</span>}
            {data.aiStack && !data.chain && (
              <span className="ms-auto shrink-0 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/25">
                AI STACK
              </span>
            )}
          </div>
          {stat && <div className="text-[10.5px] font-semibold text-white/75">{stat}</div>}
          {stat2 && <div className="text-[10px] text-white/40">{stat2}</div>}
        </div>
      )}
    </div>
  )
}
