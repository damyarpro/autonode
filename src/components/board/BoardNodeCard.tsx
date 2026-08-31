import { useEffect, useRef, useState } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { NodeIcon } from '../icons'
import { IconTile } from '../Icon'
import { useI18n } from '../../i18n/I18nProvider'
import { nodeKindById, nodeKinds } from '../../data/nodeKinds'
import type { IconKey } from '../../data/types'
import type { Bi, BoardGroup, BoardNode } from '../../../shared/boardGraph'
import { NODE_WIDTH, biIsComplete } from './useGraphEditor'

/**
 * One box on the editable board, and the labelled container behind a group.
 * The read-only sales board has its own card in `components/nodes/StageNode`;
 * this one is the same shape with a rename form folded into it.
 */

const COPY = {
  fa: { fa: 'فارسی', en: 'Persian' },
  en: { fa: 'انگلیسی', en: 'English' },
  save: { fa: 'ذخیره', en: 'Save' },
  cancel: { fa: 'انصراف', en: 'Cancel' },
  bothNeeded: {
    fa: 'هر دو زبان لازم است؛ نامی که فقط یک زبان دارد ذخیره نمی‌شود.',
    en: 'Both languages are required; a name in only one is not saved.',
  },
  groupCount: { fa: 'نود', en: 'nodes' },
  renameHint: { fa: 'نام تازه', en: 'New name' },
}

/**
 * A board can name any glyph, including one no kind uses. Every key of the icon
 * union is claimed by a funnel kind, so the kinds themselves are the registry —
 * and an icon the app does not know falls back rather than throwing (rule 8).
 */
const KNOWN_ICONS = new Set<string>(nodeKinds.map((kind) => kind.icon))
const iconKey = (icon: string): IconKey => (KNOWN_ICONS.has(icon) ? (icon as IconKey) : 'router')

export type BoardCardData = {
  node: BoardNode
  /** The live number for this node's `metric`, when the page has one. */
  metric?: number
  editing: boolean
  readOnly: boolean
  onCommitTitle: (id: string, title: Bi) => void
  onCancelEdit: () => void
} & Record<string, unknown>

export type BoardGroupData = {
  group: BoardGroup
  members: number
  editing: boolean
  readOnly: boolean
  onCommitLabel: (id: string, label: Bi) => void
  onCancelEdit: () => void
} & Record<string, unknown>

export type BoardCardNode = Node<BoardCardData, 'boardCard'>
export type BoardGroupNode = Node<BoardGroupData, 'boardGroup'>
export type BoardFlowNode = BoardCardNode | BoardGroupNode

/**
 * The four connection points. They hide until the card is hovered — but a
 * finger never hovers, so a selected card shows them too: on a touch screen
 * tapping a node is the only way to be told where a wire can start. They are
 * also wider where the pointer is coarse, because 10px is under half of what a
 * fingertip can reliably hit.
 */
const handleClass = [
  'opacity-0 transition-opacity duration-150 group-hover:opacity-100',
  '!h-2.5 !w-2.5 !rounded-full !border !border-white/40 !bg-accent',
  '[@media(pointer:coarse)]:!h-4 [@media(pointer:coarse)]:!w-4',
  // React Flow marks only its own pane `touch-action: none`. A wire is dragged
  // mostly up or down, and on a phone the page under the canvas scrolls — so
  // the handles claim the gesture rather than leaving the browser entitled to
  // read it as a scroll and cancel the pointer mid-drag.
  'touch-none',
].join(' ')

/**
 * The rename form. A bilingual name is not a preference here — a title with one
 * empty side cannot be rendered in the other locale, so saving stays disabled
 * until both sides have text (rule 2).
 */
export function BiEditor({
  value,
  onSave,
  onCancel,
}: {
  value: Bi
  onSave: (next: Bi) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<Bi>(value)
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    first.current?.focus()
    first.current?.select()
  }, [])

  const complete = biIsComplete(draft)
  const commit = () => {
    if (complete) onSave({ fa: draft.fa.trim(), en: draft.en.trim() })
  }

  const field = 'w-full rounded-lg border border-hairline bg-black/40 px-2 py-1.5 text-[12px] text-white/90 outline-none focus:border-accent/70'

  return (
    <div className="nodrag nowheel mt-2 space-y-1.5 text-start" onKeyDown={(event) => event.stopPropagation()}>
      <label className="block">
        <span className="text-[9px] uppercase tracking-[0.14em] text-white/35">{t(COPY.fa)}</span>
        <input
          ref={first}
          dir="rtl"
          className={field}
          value={draft.fa}
          placeholder={t(COPY.renameHint)}
          onChange={(event) => setDraft((prev) => ({ ...prev, fa: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') onCancel()
          }}
        />
      </label>
      <label className="block">
        <span className="text-[9px] uppercase tracking-[0.14em] text-white/35">{t(COPY.en)}</span>
        <input
          dir="ltr"
          className={field}
          value={draft.en}
          placeholder={t(COPY.renameHint)}
          onChange={(event) => setDraft((prev) => ({ ...prev, en: event.target.value }))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') onCancel()
          }}
        />
      </label>

      {!complete && <p className="text-[9.5px] leading-relaxed text-white/45">{t(COPY.bothNeeded)}</p>}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          disabled={!complete}
          onClick={commit}
          className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
        >
          {t(COPY.save)}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg px-2 py-1 text-[11px] text-white/55 hover:text-white">
          {t(COPY.cancel)}
        </button>
      </div>
    </div>
  )
}

export default function BoardNodeCard({ data, selected }: NodeProps<BoardCardNode>) {
  const { t, num, isRtl } = useI18n()
  const node = data.node
  const kind = nodeKindById(node.kind)
  // A node with no metric key, or a page with no value for it, shows no
  // number at all rather than a plausible-looking one (rule 5).
  const value = node.metric ? data.metric : undefined
  // Selecting is the touch equivalent of hovering, so it reveals the handles.
  const handles = selected && !data.readOnly ? `${handleClass} !opacity-100` : handleClass

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={[
        'node-in group relative rounded-[14px] border px-3.5 py-3 text-start transition duration-200',
        'bg-[linear-gradient(160deg,rgba(24,24,34,0.97),rgba(11,11,17,0.97))]',
        selected ? 'border-accent/70 ring-1 ring-accent/60' : 'border-hairline hover:border-white/20',
      ].join(' ')}
      style={{ width: node.width ?? NODE_WIDTH }}
    >
      <Handle id="target-l" type="target" position={Position.Left} className={handles} isConnectable={!data.readOnly} />
      <Handle id="target-r" type="target" position={Position.Right} className={handles} isConnectable={!data.readOnly} />
      <Handle id="source-l" type="source" position={Position.Left} className={handles} isConnectable={!data.readOnly} />
      <Handle id="source-r" type="source" position={Position.Right} className={handles} isConnectable={!data.readOnly} />

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {node.kicker && (
            <div className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-white/35">{t(node.kicker)}</div>
          )}
          <div className="truncate text-[13px] font-semibold text-white/92">{t(node.title)}</div>
        </div>
        {kind?.brand ? (
          <IconTile name={kind.brand.iconName} color={kind.brand.color} gradient={kind.brand.gradient} size={30} />
        ) : (
          <NodeIcon icon={iconKey(node.icon)} />
        )}
      </div>

      {(node.meta || value !== undefined) && !data.editing && (
        <div className="mt-2.5 border-t border-hairline pt-2">
          {node.meta && <div className="text-[10px] leading-relaxed text-white/40">{t(node.meta)}</div>}
          {value !== undefined && <div className="text-[10.5px] font-semibold text-white/75">{num(value)}</div>}
        </div>
      )}

      {data.editing && !data.readOnly && (
        <BiEditor
          value={node.title}
          onSave={(next) => data.onCommitTitle(node.id, next)}
          onCancel={data.onCancelEdit}
        />
      )}
    </div>
  )
}

/**
 * The labelled box behind a group. It is a React Flow node like any other, drawn
 * under the cards, and it is sized to its members rather than clipping them —
 * so putting a node in a group never moves the node.
 */
export function BoardGroupBox({ data, selected }: NodeProps<BoardGroupNode>) {
  const { t, num, isRtl } = useI18n()
  const group = data.group

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={[
        'h-full w-full rounded-2xl border border-dashed text-start',
        selected ? 'border-accent/70 bg-accent-soft/30' : 'border-white/15 bg-white/[0.02]',
      ].join(' ')}
      style={{ width: group.width, height: group.height }}
    >
      <div className="flex items-center gap-2 px-3.5 pt-2.5">
        <span className="truncate text-[11px] font-semibold text-white/70">{t(group.label)}</span>
        <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] tabular-nums text-white/45">
          {num(data.members)} {t(COPY.groupCount)}
        </span>
      </div>

      {data.editing && !data.readOnly && (
        <div className="nodrag nowheel w-[260px] max-w-full px-3.5">
          <BiEditor
            value={group.label}
            onSave={(next) => data.onCommitLabel(group.id, next)}
            onCancel={data.onCancelEdit}
          />
        </div>
      )}
    </div>
  )
}
