import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { NodeIcon } from '../icons'
import { IconTile } from '../Icon'
import { useI18n } from '../../i18n/I18nProvider'
import { CATEGORY_LABEL, kindsByCategory, nodeKindById, type NodeKind } from '../../data/nodeKinds'
import type { BoardGraph, BoardNode } from '../../../shared/boardGraph'
import { filterPalette, findGroup, findNode, membersOf } from './useGraphEditor'

/**
 * The two right-click menus: the node palette on empty canvas, and the actions
 * on one node or one group. Plain DOM, so unlike the flow canvas it mirrors with
 * the locale (rule 3) — the menu opens from the pointer towards the reading
 * direction, and never off the edge of the screen.
 *
 * Two shapes, one menu. With room, it hangs from the pointer and is clamped
 * against its own measured height so the last item is never under the fold.
 * Below `sm` there is no room to hang anything: a 268px card next to a finger
 * on a 390px screen either covers the node it is about or runs off the edge, so
 * it docks to the bottom instead, full width, the way the node sheet does.
 */

const COPY = {
  addNode: { fa: 'افزودن نود', en: 'Add a node' },
  search: { fa: 'جست‌وجو در پالت…', en: 'Search the palette…' },
  noMatch: { fa: 'چیزی با این نام پیدا نشد.', en: 'Nothing matches that.' },
  newGroup: { fa: 'گروه تازه اینجا', en: 'New group here' },
  rename: { fa: 'تغییر نام', en: 'Rename' },
  duplicate: { fa: 'تکثیر', en: 'Duplicate' },
  remove: { fa: 'حذف', en: 'Delete' },
  addToGroup: { fa: 'افزودن به گروه', en: 'Add to group' },
  removeFromGroup: { fa: 'خارج کردن از گروه', en: 'Remove from group' },
  newGroupWith: { fa: 'گروه تازه با این نود', en: 'New group with this node' },
  openTool: { fa: 'باز کردن ابزار', en: 'Open the tool' },
  openSite: { fa: 'باز کردن سایت', en: 'Open the website' },
  groupActions: { fa: 'گروه', en: 'Group' },
  renameGroup: { fa: 'تغییر نام گروه', en: 'Rename the group' },
  deleteGroup: { fa: 'حذف گروه', en: 'Delete the group' },
  deleteGroupNote: { fa: 'نودها می‌مانند', en: 'Its nodes stay' },
  menu: { fa: 'منوی بوم', en: 'Board menu' },
}

/** Where a menu was opened, and on what. */
export type BoardMenu =
  | { kind: 'pane'; cx: number; cy: number; at: { x: number; y: number } }
  | { kind: 'node'; cx: number; cy: number; nodeId: string }
  | { kind: 'group'; cx: number; cy: number; groupId: string }

export type MenuActions = {
  addKind: (kind: NodeKind) => void
  addGroup: () => void
  renameNode: (nodeId: string) => void
  duplicateNode: (nodeId: string) => void
  deleteNode: (nodeId: string) => void
  assignGroup: (nodeId: string, groupId: string | null) => void
  groupWithNew: (nodeId: string) => void
  openLink: (href: string, external: boolean) => void
  renameGroup: (groupId: string) => void
  deleteGroup: (groupId: string) => void
}

const MENU_WIDTH = 268
const MARGIN = 10

/** Narrower than this and the menu docks to the bottom edge instead. */
const COMPACT = '(max-width: 639px)'

function useCompact(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(COMPACT).matches,
  )
  useEffect(() => {
    const query = window.matchMedia(COMPACT)
    const onChange = () => setCompact(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return compact
}

/** The window, as state, so a rotation re-clamps the menu instead of stranding it. */
function useViewport(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({
    width: typeof window === 'undefined' ? 1024 : window.innerWidth,
    height: typeof window === 'undefined' ? 768 : window.innerHeight,
  }))
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

function MenuItem({
  label,
  hint,
  danger,
  onPick,
}: {
  label: string
  hint?: string
  danger?: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onPick}
      className={[
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-start text-[12px] transition-colors sm:py-2',
        danger ? 'text-red-300/85 hover:bg-white/[0.06] hover:text-red-300' : 'text-white/80 hover:bg-white/[0.06]',
      ].join(' ')}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-[10px] text-white/35">{hint}</span>}
    </button>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <div className="px-2.5 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">{children}</div>
}

/** A palette row: the kind's own tile when it has one, its board glyph otherwise. */
function KindRow({ kind, onPick }: { kind: NodeKind; onPick: () => void }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onPick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-white/[0.06] sm:py-1.5"
    >
      {kind.brand ? (
        <IconTile name={kind.brand.iconName} color={kind.brand.color} gradient={kind.brand.gradient} size={26} />
      ) : (
        <NodeIcon icon={kind.icon} size={26} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-white/85">{t(kind.label)}</span>
        <span className="block truncate text-[10px] text-white/40">{t(kind.hint)}</span>
      </span>
    </button>
  )
}

function PaletteMenu({ onPick, onNewGroup }: { onPick: (kind: NodeKind) => void; onNewGroup: () => void }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const all = useMemo(() => kindsByCategory(), [])
  const groups = useMemo(() => filterPalette(all, query), [all, query])

  useEffect(() => {
    search.current?.focus()
  }, [])

  return (
    <>
      <div className="shrink-0 px-2.5 pb-2 pt-2.5">
        <div className="pb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">{t(COPY.addNode)}</div>
        <input
          ref={search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t(COPY.search)}
          className="w-full rounded-lg border border-hairline bg-black/40 px-2.5 py-1.5 text-[12px] text-white/90 outline-none placeholder:text-white/30 focus:border-accent/70"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-1">
        {groups.length === 0 && <p className="px-2.5 py-3 text-[11px] text-white/40">{t(COPY.noMatch)}</p>}
        {groups.map((group) => (
          <div key={group.category}>
            <SectionLabel>{t(CATEGORY_LABEL[group.category])}</SectionLabel>
            {group.kinds.map((kind) => (
              <KindRow key={kind.id} kind={kind} onPick={() => onPick(kind)} />
            ))}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-hairline p-1">
        <MenuItem label={t(COPY.newGroup)} onPick={onNewGroup} />
      </div>
    </>
  )
}

function NodeMenu({ node, graph, actions }: { node: BoardNode; graph: BoardGraph; actions: MenuActions }) {
  const { t } = useI18n()
  const kind = nodeKindById(node.kind)
  const groups = graph.groups.filter((group) => group.id !== node.group)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-1">
      <MenuItem label={t(COPY.rename)} onPick={() => actions.renameNode(node.id)} />
      <MenuItem label={t(COPY.duplicate)} onPick={() => actions.duplicateNode(node.id)} />
      {kind?.to && <MenuItem label={t(COPY.openTool)} onPick={() => actions.openLink(kind.to as string, false)} />}
      {kind?.url && <MenuItem label={t(COPY.openSite)} onPick={() => actions.openLink(kind.url as string, true)} />}

      <div className="my-1 border-t border-hairline" />
      <SectionLabel>{t(COPY.addToGroup)}</SectionLabel>
      {groups.map((group) => (
        <MenuItem
          key={group.id}
          label={t(group.label)}
          onPick={() => actions.assignGroup(node.id, group.id)}
        />
      ))}
      <MenuItem label={t(COPY.newGroupWith)} onPick={() => actions.groupWithNew(node.id)} />
      {node.group && <MenuItem label={t(COPY.removeFromGroup)} onPick={() => actions.assignGroup(node.id, null)} />}

      <div className="my-1 border-t border-hairline" />
      <MenuItem danger label={t(COPY.remove)} onPick={() => actions.deleteNode(node.id)} />
    </div>
  )
}

export default function BoardContextMenu({
  menu,
  graph,
  actions,
  onClose,
}: {
  menu: BoardMenu
  graph: BoardGraph
  actions: MenuActions
  onClose: () => void
}) {
  const { t, num, isRtl } = useI18n()
  const box = useRef<HTMLDivElement>(null)
  const compact = useCompact()
  const viewport = useViewport()
  /** The menu's own height, so the clamp below knows what it is clamping. */
  const [height, setHeight] = useState(0)

  // Any click elsewhere, any Escape, closes. `pointerdown` rather than `click`
  // so the menu is gone before the canvas reacts to the same press.
  useEffect(() => {
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as globalThis.Node)) onClose()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])

  // Measured before paint, so the menu is never drawn once in the wrong place
  // and corrected afterwards. A palette that shrinks as you type re-measures.
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    setHeight(element.getBoundingClientRect().height)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setHeight(element.getBoundingClientRect().height))
    observer.observe(element)
    return () => observer.disconnect()
  }, [menu.kind, compact])

  const { width: viewportWidth, height: viewportHeight } = viewport
  const room = viewportHeight - MARGIN * 2

  // The menu hangs from the pointer towards the reading direction, so the
  // start edge is the right one in Persian and the left one in English. Its
  // measured height is what keeps the bottom of it on screen: clamping against
  // a guessed 200px left the palette's last rows under the fold.
  const startFromPointer = isRtl ? viewportWidth - menu.cx : menu.cx
  const start = Math.max(MARGIN, Math.min(startFromPointer, viewportWidth - MENU_WIDTH - MARGIN))
  const top = Math.max(MARGIN, Math.min(menu.cy, viewportHeight - (height || 220) - MARGIN))

  const placement = compact
    ? // Docked: full width at the bottom edge, where a thumb can reach every row.
      {
        insetInlineStart: 0,
        insetInlineEnd: 0,
        bottom: 0,
        maxHeight: Math.round(viewportHeight * 0.72),
      }
    : { insetInlineStart: start, top, width: MENU_WIDTH, maxHeight: room }

  const node = menu.kind === 'node' ? findNode(graph, menu.nodeId) : undefined
  const group = menu.kind === 'group' ? findGroup(graph, menu.groupId) : undefined

  // A menu whose subject was deleted under it has nothing to show.
  if ((menu.kind === 'node' && !node) || (menu.kind === 'group' && !group)) return null

  return (
    <div
      ref={box}
      role="menu"
      aria-label={t(COPY.menu)}
      className={[
        'fixed z-50 flex flex-col overflow-hidden border border-hairline bg-panel/95 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur',
        compact ? 'rounded-t-2xl border-b-0 pb-[env(safe-area-inset-bottom)]' : 'rounded-xl',
      ].join(' ')}
      style={placement}
    >
      {compact && <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/15" />}

      {menu.kind === 'pane' && <PaletteMenu onPick={actions.addKind} onNewGroup={actions.addGroup} />}

      {menu.kind === 'node' && node && <NodeMenu node={node} graph={graph} actions={actions} />}

      {menu.kind === 'group' && group && (
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          <SectionLabel>{`${t(COPY.groupActions)} · ${t(group.label)}`}</SectionLabel>
          <MenuItem label={t(COPY.renameGroup)} onPick={() => actions.renameGroup(group.id)} />
          <MenuItem
            danger
            label={t(COPY.deleteGroup)}
            hint={`${num(membersOf(graph, group.id).length)} · ${t(COPY.deleteGroupNote)}`}
            onPick={() => actions.deleteGroup(group.id)}
          />
        </div>
      )}
    </div>
  )
}
