export type Locale = 'en' | 'fa'

/** Every user-visible string in the graph carries both languages. */
export type Bi = { en: string; fa: string }

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
  /** Bold stat line under the meta, e.g. "AI calls 105". */
  stat?: Bi
  /** Second stat line, used by the channel nodes for reach. */
  stat2?: Bi
  /** Circled count on the leading edge of the card. */
  badge?: string
  icon: IconKey
  /** Renders the small "AI STACK" corner tag. */
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
  value: Bi
  caption: Bi
  icon: 'deal' | 'pipeline' | 'close' | 'cycle'
}
