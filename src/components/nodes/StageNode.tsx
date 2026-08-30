import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { NodeIcon } from '../icons'
import { useI18n } from '../../i18n/I18nProvider'
import type { StageNodeData } from '../../data/types'

export type StageFlowNode = Node<StageNodeData & Record<string, unknown>, 'stage'>

const handleStyle = { opacity: 0, width: 1, height: 1, border: 'none' }

/**
 * The one card component behind every box on the canvas. Variants cover the
 * green payment nodes and the wide content-factory card; everything else is
 * data.
 */
export default function StageNode({ data, selected }: NodeProps<StageFlowNode>) {
  const { t, n, isRtl } = useI18n()
  const success = data.variant === 'success'

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={[
        'group relative rounded-[14px] border px-3.5 py-3 text-start backdrop-blur-sm transition',
        'bg-[linear-gradient(160deg,rgba(24,24,34,0.96),rgba(11,11,17,0.96))]',
        success ? 'border-success/45 shadow-[0_0_28px_-10px_rgba(52,211,153,0.65)]' : 'border-hairline',
        data.aiStack ? 'pb-6' : '',
        selected ? 'ring-1 ring-accent/70' : '',
      ].join(' ')}
      style={{ width: data.width ?? 285 }}
    >
      <Handle id="target-l" type="target" position={Position.Left} style={handleStyle} />
      <Handle id="target-r" type="target" position={Position.Right} style={handleStyle} />
      <Handle id="source-l" type="source" position={Position.Left} style={handleStyle} />
      <Handle id="source-r" type="source" position={Position.Right} style={handleStyle} />
      <Handle id="target-t" type="target" position={Position.Top} style={handleStyle} />
      <Handle id="source-t" type="source" position={Position.Top} style={handleStyle} />

      <div className="flex items-start gap-2.5">
        {data.badge && (
          <span
            className={[
              'mt-0.5 grid h-6 min-w-[28px] shrink-0 place-items-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
              success ? 'bg-success/15 text-success' : 'bg-white/[0.07] text-white/70',
            ].join(' ')}
          >
            {n(data.badge)}
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
        <div className="mt-3 flex items-center gap-1.5 rounded-[10px] border border-hairline bg-black/40 px-2.5 py-2">
          {data.chain.map((key, i) => (
            <span key={key} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-[10px] text-white/25">{isRtl ? '‹' : '›'}</span>}
              <NodeIcon icon={key} size={18} />
            </span>
          ))}
        </div>
      )}

      {(data.meta || data.stat || data.stat2) && (
        <div className="mt-2.5 border-t border-hairline pt-2">
          {data.meta && <div className="text-[10px] leading-relaxed text-white/40">{t(data.meta)}</div>}
          {data.stat && <div className="text-[10.5px] font-semibold text-white/75">{t(data.stat)}</div>}
          {data.stat2 && <div className="text-[10px] text-white/40">{t(data.stat2)}</div>}
        </div>
      )}

      {data.aiStack && (
        <span className="absolute bottom-2.5 end-3.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/25">
          AI STACK
        </span>
      )}
    </div>
  )
}
