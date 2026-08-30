import type { Channel, Lead, Message, Route } from '../types.ts'
import type { TemplateKey } from '../domain/sequences.ts'

/** Anything that can put a message in front of a lead. */
export interface ChannelAdapter {
  readonly channel: Channel
  /** False when the adapter only records the message instead of delivering it. */
  readonly live: boolean
  send(lead: Lead, body: string): Promise<{ externalId?: string; status: Message['status'] }>
}

export type DraftInput = {
  lead: Lead
  template: TemplateKey
  route: Route
  recentMessages: { direction: 'in' | 'out'; body: string }[]
}

export type NextBestAction = {
  action: 'send_followup' | 'book_call' | 'send_checkout' | 'wait' | 'close_lost'
  reason: string
  confidence: number
}

/** Writes the outreach copy and picks the next move. */
export interface AiAdapter {
  readonly name: string
  readonly live: boolean
  draft(input: DraftInput): Promise<string>
  nextBestAction(input: Omit<DraftInput, 'template'>): Promise<NextBestAction>
}

export interface PaymentAdapter {
  readonly provider: string
  readonly live: boolean
  createCheckout(input: { leadId: number; dealId: number; amountToman: number }): Promise<{
    url: string
    ref: string
  }>
}
