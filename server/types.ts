/** Domain vocabulary shared by the server, the tests and the API responses. */

export const CHANNELS = ['instagram', 'telegram', 'linkedin', 'youtube', 'website'] as const
export type Channel = (typeof CHANNELS)[number]

export const ROUTES = ['hot', 'warm', 'cold'] as const
export type Route = (typeof ROUTES)[number]

export const STAGES = [
  'new',
  'engaged',
  'qualified',
  'meeting',
  'checkout',
  'paid',
  'delivered',
  'advocate',
  'lost',
] as const
export type Stage = (typeof STAGES)[number]

export const LEAD_EVENT_TYPES = [
  'captured',
  'content_view',
  'link_click',
  'form_submit',
  'message_in',
  'message_out',
  'reply',
  'call_booked',
  'call_completed',
  'checkout_started',
  'paid',
  'delivered',
  'referred',
  'unsubscribed',
] as const
export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number]

export type Lead = {
  id: number
  source: Channel
  external_id: string | null
  handle: string | null
  name: string | null
  locale: string
  score: number
  route: Route
  stage: Stage
  owner: string | null
  value_toman: number
  created_at: string
  updated_at: string
}

export type LeadEvent = {
  id: number
  lead_id: number
  type: LeadEventType
  payload_json: string | null
  at: string
}

export type Message = {
  id: number
  lead_id: number
  channel: Channel
  direction: 'in' | 'out'
  body: string
  status: 'sent' | 'simulated' | 'failed' | 'received'
  external_id: string | null
  at: string
}

export type SequenceStep = {
  id: number
  lead_id: number
  sequence: Route
  step_index: number
  due_at: string
  sent_at: string | null
  status: 'pending' | 'sent' | 'cancelled'
}

/** One live number on the canvas. Keys are `<nodeId>.<slot>` or `kpi.<name>`. */
export type MetricMap = Record<string, number>

export type DomainEvent = {
  type: string
  leadId?: number
  edgeId?: string
  nodeId?: string
  at: string
}
