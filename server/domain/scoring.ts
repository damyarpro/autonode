import type { Channel, LeadEventType } from '../types.ts'

/** How much buying intent a first touch on each channel implies. */
const CHANNEL_INTENT: Record<Channel, number> = {
  website: 18,
  linkedin: 14,
  instagram: 12,
  telegram: 12,
  youtube: 8,
}

const EVENT_WEIGHT: Record<LeadEventType, number> = {
  captured: 0,
  content_view: 3,
  link_click: 6,
  form_submit: 18,
  message_in: 12,
  message_out: 0,
  reply: 14,
  call_booked: 25,
  call_completed: 15,
  checkout_started: 20,
  paid: 40,
  delivered: 4,
  referred: 8,
  unsubscribed: 0,
}

/** Contribution halves every 10 days, so an old burst never keeps a lead hot. */
const HALF_LIFE_DAYS = 10
const DECAY_SCALE = HALF_LIFE_DAYS / Math.LN2

const PROFILE_BONUS = { name: 4, handle: 2 }

export type ScorableEvent = { type: LeadEventType; at: string | Date }

export type ScoreInput = {
  source: Channel
  hasName: boolean
  hasHandle: boolean
  events: ScorableEvent[]
}

const ageInDays = (at: string | Date, now: Date) => {
  // SQLite datetime('now') is UTC without a zone marker; make that explicit.
  const stamp = at instanceof Date ? at : new Date(`${at.replace(' ', 'T')}Z`)
  return Math.max(0, (now.getTime() - stamp.getTime()) / 86_400_000)
}

/**
 * Turns a lead's event history into a 0-100 score. Pure: same input, same
 * output — which is what makes routing testable.
 */
export function scoreLead(input: ScoreInput, now: Date = new Date()): number {
  if (input.events.some((event) => event.type === 'unsubscribed')) return 0

  let total = CHANNEL_INTENT[input.source] ?? 10
  if (input.hasName) total += PROFILE_BONUS.name
  if (input.hasHandle) total += PROFILE_BONUS.handle

  for (const event of input.events) {
    const weight = EVENT_WEIGHT[event.type] ?? 0
    if (weight === 0) continue
    total += weight * Math.exp(-ageInDays(event.at, now) / DECAY_SCALE)
  }

  return Math.max(0, Math.min(100, Math.round(total)))
}
