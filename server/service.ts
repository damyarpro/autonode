import { env } from './env.ts'
import * as q from './db/queries.ts'
import { publish } from './events.ts'
import { scoreLead } from './domain/scoring.ts'
import { signCheckout } from './domain/checkout-token.ts'
import { advanceStage, EVENT_EDGE, routeForScore } from './domain/routing.ts'
import { planSteps, stepDef } from './domain/sequences.ts'
import { ai, channelFor, payments } from './adapters/registry.ts'
import { CHANNELS, type Channel, type Lead, type LeadEventType, type Stage } from './types.ts'

/** Default ticket size, in Toman. Matches the $274 average on the board. */
export const DEFAULT_DEAL_TOMAN = 27_400_000

const fire = (type: string, lead?: Lead, extra: Record<string, unknown> = {}) =>
  publish({ type, leadId: lead?.id, edgeId: EVENT_EDGE[type], ...extra })

/** Recomputes the score from the event log and re-routes when the band changes. */
export function rescore(leadId: number): Lead | undefined {
  const lead = q.getLead(leadId)
  if (!lead) return undefined

  const score = scoreLead({
    source: lead.source,
    hasName: Boolean(lead.name),
    hasHandle: Boolean(lead.handle),
    events: q.leadEvents(leadId).map((event) => ({ type: event.type, at: event.at })),
  })
  const route = routeForScore(score)
  // A brand-new lead needs its first sequence even when the band is unchanged.
  const changed = route !== lead.route || q.stepCount(leadId) === 0

  q.updateLead(leadId, { score, route })
  if (changed) {
    // A lead that heats up abandons the slower track rather than running both.
    q.cancelPendingSteps(leadId)
    for (const step of planSteps(route, new Date(), env.sequenceSpeed)) {
      q.scheduleStep(leadId, route, step.stepIndex, step.dueAt)
    }
  }

  const updated = q.getLead(leadId)!
  fire('lead.scored', updated, { nodeId: 'router' })
  if (route !== lead.route || changed) fire(`lead.routed.${route}`, updated, { nodeId: route })
  return updated
}

export function capture(input: q.CaptureInput & { message?: string }): Lead {
  const { lead, created } = q.captureLead(input)
  if (created) {
    q.addEvent(lead.id, 'captured', { source: input.source })
    fire(`lead.captured.${input.source}`, lead, { nodeId: 'inbox' })
  }
  if (input.message) {
    q.addMessage({
      lead_id: lead.id,
      channel: input.source,
      direction: 'in',
      body: input.message,
      status: 'received',
      external_id: null,
    })
    q.addEvent(lead.id, created ? 'message_in' : 'reply')
  }
  return rescore(lead.id) ?? lead
}

/** Records an inbound reply: stops the reply-sensitive steps and re-scores. */
export function handleInbound(leadId: number, body: string, externalId?: string): Lead | undefined {
  const lead = q.getLead(leadId)
  if (!lead) return undefined

  q.addMessage({
    lead_id: leadId,
    channel: lead.source,
    direction: 'in',
    body,
    status: 'received',
    external_id: externalId ?? null,
  })
  q.addEvent(leadId, 'reply', { body })
  q.updateLead(leadId, { stage: advanceStage(lead.stage, 'engaged') })
  fire('lead.replied', lead, { nodeId: 'memory' })

  const pending = q.dueSteps(new Date(8.64e15))
  if (pending.some((step) => step.lead_id === leadId && stepDef(step.sequence, step.step_index)?.stopOnReply)) {
    q.cancelPendingSteps(leadId)
  }
  return rescore(leadId)
}

/** One pass of the nurture worker: draft, deliver and record every due step. */
export async function runDueSteps(now = new Date()): Promise<number> {
  const steps = q.dueSteps(now)
  let sent = 0

  for (const step of steps) {
    const lead = q.getLead(step.lead_id)
    const def = stepDef(step.sequence, step.step_index)
    if (!lead || !def) {
      q.markStepSent(step.id)
      continue
    }

    const body = await ai().draft({
      lead,
      route: step.sequence,
      template: def.template,
      recentMessages: q.leadMessages(lead.id).map((m) => ({ direction: m.direction, body: m.body })),
    })

    const adapter = channelFor(lead.source)
    const result = await adapter.send(lead, body)

    q.addMessage({
      lead_id: lead.id,
      channel: lead.source,
      direction: 'out',
      body,
      status: result.status,
      external_id: result.externalId ?? null,
    })
    q.addEvent(lead.id, 'message_out', { template: def.template, status: result.status })
    q.markStepSent(step.id)
    q.updateLead(lead.id, { stage: advanceStage(lead.stage, 'engaged') })
    fire(`message.sent.${step.sequence}`, lead, { nodeId: step.sequence })
    sent += 1
  }

  return sent
}

const mark = (leadId: number, type: LeadEventType, stage: Stage, eventName: string, nodeId: string) => {
  const lead = q.getLead(leadId)
  if (!lead) return undefined
  q.addEvent(leadId, type)
  q.updateLead(leadId, { stage: advanceStage(lead.stage, stage) })
  fire(eventName, lead, { nodeId })
  return rescore(leadId)
}

export const bookMeeting = (leadId: number) =>
  mark(leadId, 'call_booked', 'meeting', 'meeting.booked', 'salescall')

export const completeCall = (leadId: number) =>
  mark(leadId, 'call_completed', 'qualified', 'meeting.booked', 'salescall')

export const startDelivery = (leadId: number) =>
  mark(leadId, 'delivered', 'delivered', 'delivery.started', 'fulfillment')

export const recordReferral = (leadId: number) =>
  mark(leadId, 'referred', 'advocate', 'referral.received', 'referral')

export async function startCheckout(leadId: number, amountToman = DEFAULT_DEAL_TOMAN) {
  const lead = q.getLead(leadId)
  if (!lead) return undefined

  const dealId = q.openDeal(leadId, amountToman)
  const checkout = await payments().createCheckout({ leadId, dealId, amountToman })

  q.addEvent(leadId, 'checkout_started', { ref: checkout.ref, amountToman })
  q.updateLead(leadId, { stage: advanceStage(lead.stage, 'checkout'), value_toman: amountToman })
  fire('checkout.started', lead, { nodeId: 'payment' })

  rescore(leadId)

  // The token is what makes the confirmation endpoint unforgeable; it travels
  // with the checkout link and comes back with the confirmation.
  const token = signCheckout({ leadId, dealId, ref: checkout.ref, amountToman }, env.checkoutSigningSecret)
  const url = `${checkout.url}&token=${token}`
  return { ...checkout, url, dealId, amountToman, token }
}

/**
 * Confirms a payment, then closes the growth loop: a fixed share of the money
 * is allocated back to the channel that produced the lead.
 */
export function capturePayment(input: { leadId: number; dealId: number; ref: string; amountToman: number }) {
  const lead = q.getLead(input.leadId)
  if (!lead) return { ok: false as const, reason: 'unknown lead' }

  const paymentId = q.recordPayment(input.dealId, payments().provider, input.ref, input.amountToman)
  if (paymentId === null) return { ok: false as const, reason: 'already recorded' }

  q.addEvent(input.leadId, 'paid', { amountToman: input.amountToman })
  q.updateLead(input.leadId, { stage: advanceStage(lead.stage, 'paid'), value_toman: input.amountToman })
  fire('payment.captured', lead, { nodeId: 'sale' })

  const reinvest = Math.round(input.amountToman * env.growthReinvestRate)
  const channel: Channel = CHANNELS.includes(lead.source) ? lead.source : 'website'
  q.recordAllocation(paymentId, channel, reinvest)
  fire('growth.allocated', lead, { nodeId: 'growth' })

  startDelivery(input.leadId)
  rescore(input.leadId)
  return { ok: true as const, paymentId, reinvest }
}
