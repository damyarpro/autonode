import type { Channel, MetricMap, Route } from '../types.ts'
import { CHANNELS } from '../types.ts'

/**
 * Plain aggregates gathered from the database. Kept separate from the SQL so the
 * arithmetic below — close rate, cycle length, pipeline value — can be tested
 * without a database.
 */
export type PipelineFacts = {
  leadsByChannel: Record<Channel, number>
  touchesByChannel: Record<Channel, number>
  /** Pieces this channel actually put out — delivered or recorded. */
  publishedByChannel: Record<Channel, number>
  totalLeads: number
  identified: number
  byRoute: Record<Route, number>
  activeConversations: number
  inSequence: number
  crmRecords: number
  meetingsBooked: number
  callsCompleted: number
  /** Briefs written and handed to the voice adapter, dialled or not. */
  callsPrepared: number
  voiceCalls: number
  openDealValueToman: number
  paidTotalToman: number
  paymentCount: number
  allocatedToman: number
  deliveries: number
  activeAccounts: number
  referrals: number
  contentPieces: number
  voiceovers: number
  videos: number
  /** Days from capture to payment, one entry per won deal. */
  cycleDays: number[]
}

export const emptyFacts = (): PipelineFacts => ({
  leadsByChannel: { instagram: 0, telegram: 0, linkedin: 0, youtube: 0, website: 0 },
  touchesByChannel: { instagram: 0, telegram: 0, linkedin: 0, youtube: 0, website: 0 },
  publishedByChannel: { instagram: 0, telegram: 0, linkedin: 0, youtube: 0, website: 0 },
  totalLeads: 0,
  identified: 0,
  byRoute: { hot: 0, warm: 0, cold: 0 },
  activeConversations: 0,
  inSequence: 0,
  crmRecords: 0,
  meetingsBooked: 0,
  callsCompleted: 0,
  callsPrepared: 0,
  voiceCalls: 0,
  openDealValueToman: 0,
  paidTotalToman: 0,
  paymentCount: 0,
  allocatedToman: 0,
  deliveries: 0,
  activeAccounts: 0,
  referrals: 0,
  contentPieces: 0,
  voiceovers: 0,
  videos: 0,
  cycleDays: [],
})

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * Turns the aggregates into the exact metric keys the canvas asks for:
 * `<nodeId>.badge` / `.stat` / `.stat2`, plus the four KPI values.
 */
export function buildMetrics(facts: PipelineFacts): MetricMap {
  const metrics: MetricMap = {}

  for (const channel of CHANNELS) {
    metrics[`${channel}.badge`] = facts.leadsByChannel[channel]
    metrics[`${channel}.stat`] = facts.touchesByChannel[channel]
    // Reach used to be invented here as touches × 9. Nothing in this app can
    // measure a platform's impressions, so the second line counts what the
    // channel actually put out instead.
    metrics[`${channel}.stat2`] = facts.publishedByChannel[channel]
  }

  metrics['elevenlabs.stat'] = facts.voiceovers
  metrics['elevenlabs.badge'] = facts.voiceovers
  metrics['higgsfield.stat'] = facts.videos
  metrics['higgsfield.badge'] = facts.videos
  metrics['factory.stat'] = facts.contentPieces
  metrics['factory.badge'] = facts.contentPieces

  metrics['inbox.badge'] = facts.totalLeads
  metrics['inbox.stat'] = facts.totalLeads

  metrics['router.badge'] = facts.identified
  metrics['router.stat'] = facts.identified

  metrics['hot.badge'] = facts.byRoute.hot
  metrics['hot.stat'] = facts.activeConversations
  metrics['warm.badge'] = facts.byRoute.warm
  metrics['warm.stat'] = facts.inSequence
  metrics['cold.badge'] = facts.byRoute.cold
  metrics['cold.stat'] = facts.byRoute.cold

  // Two different numbers on purpose: how many calls this node set up, and how
  // many of them a person actually had. They were the same value while nothing
  // came back from the provider, which made a started call look like a held one.
  metrics['vapi.badge'] = facts.callsPrepared
  metrics['vapi.stat'] = facts.callsCompleted
  metrics['salescall.badge'] = facts.meetingsBooked
  metrics['salescall.stat'] = facts.meetingsBooked

  metrics['memory.badge'] = facts.crmRecords
  metrics['memory.stat'] = facts.crmRecords

  metrics['payment.badge'] = facts.paymentCount
  metrics['payment.stat'] = facts.paymentCount
  metrics['sale.badge'] = facts.paymentCount
  metrics['sale.stat'] = facts.paidTotalToman

  metrics['growth.badge'] = facts.allocatedToman
  metrics['growth.stat'] = facts.allocatedToman

  metrics['fulfillment.badge'] = facts.deliveries
  metrics['fulfillment.stat'] = facts.deliveries
  metrics['support.badge'] = facts.activeAccounts
  metrics['support.stat'] = facts.activeAccounts
  metrics['referral.badge'] = facts.referrals
  metrics['referral.stat'] = facts.referrals

  metrics['kpi.dealValue'] =
    facts.paymentCount === 0 ? 0 : Math.round(facts.paidTotalToman / facts.paymentCount)
  metrics['kpi.pipelineValue'] = facts.openDealValueToman
  metrics['kpi.closeRate'] =
    facts.callsCompleted === 0
      ? 0
      : Math.round((facts.paymentCount / facts.callsCompleted) * 1000) / 10
  metrics['kpi.cycleDays'] = Math.round(mean(facts.cycleDays) * 10) / 10

  return metrics
}
