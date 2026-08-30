import type { Route, Stage } from '../types.ts'

/**
 * Bands the reference board draws as hot / warm / cold. The board labelled cold
 * as "<45", which left 45-54 unassigned; cold is everything under the warm
 * floor here, and the edge label in src/data/pipeline.ts says so.
 */
export const ROUTE_FLOOR = { hot: 80, warm: 55 } as const

export function routeForScore(score: number): Route {
  if (score >= ROUTE_FLOOR.hot) return 'hot'
  if (score >= ROUTE_FLOOR.warm) return 'warm'
  return 'cold'
}

const STAGE_ORDER: Stage[] = [
  'new',
  'engaged',
  'qualified',
  'meeting',
  'checkout',
  'paid',
  'delivered',
  'advocate',
]

/** Stages only move forward; a late low-value event never demotes a paid lead. */
export function advanceStage(current: Stage, next: Stage): Stage {
  if (current === 'lost' || next === 'lost') return next === 'lost' ? 'lost' : current
  const a = STAGE_ORDER.indexOf(current)
  const b = STAGE_ORDER.indexOf(next)
  if (a < 0 || b < 0) return current
  return b > a ? next : current
}

/** Canvas edge each domain event travels along, so the board can pulse it. */
export const EVENT_EDGE: Record<string, string> = {
  'lead.captured.instagram': 'e-ig-inbox',
  'lead.captured.telegram': 'e-tg-inbox',
  'lead.captured.linkedin': 'e-li-inbox',
  'lead.captured.youtube': 'e-yt-inbox',
  'lead.captured.website': 'e-web-inbox',
  'lead.routed.hot': 'e-router-hot',
  'lead.routed.warm': 'e-router-warm',
  'lead.routed.cold': 'e-router-cold',
  'lead.scored': 'e-inbox-router',
  'message.sent.hot': 'e-hot-vapi',
  'message.sent.warm': 'e-warm-mem',
  'message.sent.cold': 'e-cold-mem',
  'lead.replied': 'e-hot-mem',
  'meeting.booked': 'e-vapi-call',
  'checkout.started': 'e-call-pay',
  'payment.captured': 'e-pay-sale',
  'growth.allocated': 'e-sale-growth',
  'delivery.started': 'e-sale-fulfil',
  'support.handover': 'e-fulfil-support',
  'referral.received': 'e-support-ref',
}
