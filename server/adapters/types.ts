import type { Channel, Lead, Message, Route } from '../types.ts'
import type { TemplateKey } from '../domain/sequences.ts'
import type { CallBrief, CallBriefInput } from '../domain/booking.ts'
import type { AiToolSpec, ToolRunResult } from '../../shared/aiToolSpecs.ts'
import type { BusinessProfile } from '../domain/business.ts'
import type { ContentBrief, ContentLocale, ContentWritten } from '../domain/content.ts'

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
  /** One batch of content for the factory: one piece per brief, same order. */
  writeContent(input: ContentWriteInput): Promise<ContentWritten[]>
  /** The opening, the two likely objections and the ask for one sales call. */
  callBrief(input: CallBriefInput): Promise<CallBrief>
}

/** Re-exported so an adapter never imports the domain shape twice over. */
export type { CallBrief, CallBriefInput }

export type PlaceCallInput = {
  lead: Lead
  /** Already written, and stored, whether or not this adapter dials. */
  brief: CallBrief
  /** The meeting this call is about, when there is one. */
  slotStart?: string | null
}

/**
 * Anything that can put a voice on the phone with a lead. The default
 * implementation does not dial at all — it hands the owner the brief and marks
 * the call `simulated`, so the node produces real work with no paid account.
 */
export interface VoiceAdapter {
  readonly name: string
  /** False when the adapter prepares the call instead of placing it. */
  readonly live: boolean
  placeCall(input: PlaceCallInput): Promise<{
    status: 'dialled' | 'simulated' | 'failed'
    externalId?: string
  }>
}

export interface PaymentAdapter {
  readonly provider: string
  readonly live: boolean
  createCheckout(input: { leadId: number; dealId: number; amountToman: number }): Promise<{
    url: string
    ref: string
  }>
}

/**
 * One pass of the content factory. The briefs already fix the channel and the
 * kind, so a producer only writes the words — it never gets to change where a
 * piece goes.
 */
export type ContentWriteInput = {
  business: BusinessProfile
  briefs: ContentBrief[]
  locale: ContentLocale
}

/** Re-exported so an adapter never imports the domain shape twice over. */
export type { ContentBrief, ContentWritten }
