export type Locale = 'en' | 'fa'

/** Every user-visible string in the graph carries both languages. */
export type Bi = { en: string; fa: string }

export type SlotFormat = 'count' | 'money' | 'percent' | 'days'

/**
 * A number on the board. `value` is the fallback the page renders before — or
 * without — the API; the live value arrives keyed by `<nodeId>.<slot>`.
 * `text` wraps it, with `{n}` marking where the number goes.
 */
export type Slot = { text?: Bi; value: number; format?: SlotFormat }

export type IconKey =
  | 'elevenlabs'
  | 'higgsfield'
  | 'factory'
  | 'instagram'
  | 'telegram'
  | 'linkedin'
  | 'youtube'
  | 'website'
  | 'inbox'
  | 'router'
  | 'hot'
  | 'warm'
  | 'cold'
  | 'voice'
  | 'calendar'
  | 'memory'
  | 'card'
  | 'check'
  | 'growth'
  | 'delivery'
  | 'support'
  | 'referral'

export type StageNodeData = {
  kicker: Bi
  title: Bi
  /** Dotted middle line, e.g. "Qualify · Handle doubts · Book". */
  meta?: Bi
  /** Circled count on the leading edge of the card. */
  badge?: Slot
  /** Bold stat line under the meta. */
  stat?: Slot
  /** Second stat line, used by the channel nodes for reach. */
  stat2?: Slot
  icon: IconKey
  /** Renders the small "AI STACK" label. */
  aiStack?: boolean
  variant?: 'default' | 'success'
  /** Icon strip shown inside the content-factory card. */
  chain?: IconKey[]
  width?: number
  /** Locale-agnostic layout position; mirrored horizontally in RTL. */
  x: number
  y: number
  /** Filled in by the canvas to stagger the entrance animation. */
  order?: number
  /** Set by the canvas when a live event just crossed this node. */
  live?: boolean
}

export type StageNode = StageNodeData & { id: string }

export type StageEdge = {
  id: string
  source: string
  target: string
  label?: Bi
  /** Dashed budget-reinvestment edge that arcs back over the canvas. */
  loopback?: boolean
  variant?: 'default' | 'success'
}

export type Kpi = {
  id: string
  label: Bi
  caption: Bi
  icon: 'deal' | 'pipeline' | 'close' | 'cycle'
  /** Live metric key; falls back to `value` when the API is unreachable. */
  metric: string
  value: number
  format: SlotFormat
}
