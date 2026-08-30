import type { Channel, Lead, Message, Route } from '../types.ts'
import type { TemplateKey } from '../domain/sequences.ts'
import type { AiToolSpec, ToolRunResult } from '../../shared/aiToolSpecs.ts'

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

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

/** One press of an in-app AI tool's run button. */
export type ToolRunInput = {
  spec: AiToolSpec
  /** Already validated against `spec.fields`; blank optional fields are absent. */
  inputs: Record<string, string>
  locale: 'fa' | 'en'
}

export type CoachInput = {
  messages: ChatTurn[]
  locale: string
  /** Where the user is on the learning path, so answers stay on their level. */
  context: { levelId: number; percent: number; headline: string | null }
}

/**
 * Writes the outreach copy, picks the next move, answers the coach chat, and
 * runs the in-app AI tools.
 */
export interface AiAdapter {
  readonly name: string
  readonly live: boolean
  draft(input: DraftInput): Promise<string>
  nextBestAction(input: Omit<DraftInput, 'template'>): Promise<NextBestAction>
  coach(input: CoachInput): Promise<string>
  runTool(input: ToolRunInput): Promise<ToolRunResult>
}

export interface PaymentAdapter {
  readonly provider: string
  readonly live: boolean
  createCheckout(input: { leadId: number; dealId: number; amountToman: number }): Promise<{
    url: string
    ref: string
  }>
}
