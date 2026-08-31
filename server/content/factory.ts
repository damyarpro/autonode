/**
 * The content pipeline's impure half: ask the AI adapter for a batch of pieces,
 * store them on a schedule, and publish each one when its hour comes. Nothing
 * here throws — a producer that fails falls back to the templates, and a channel
 * that rejects a piece marks that piece failed and lets the pass continue.
 */
import { env } from '../env.ts'
import { ai, channelFor } from '../adapters/registry.ts'
import * as q from '../db/queries.ts'
import { publish } from '../events.ts'
import { destinationFor, isUsable, missingFields } from '../domain/business.ts'
import {
  briefsFor,
  mergeDrafts,
  planSchedule,
  templateContent,
  DEFAULT_COUNT,
  DEFAULT_PER_DAY,
  type ContentBrief,
  type ContentDraft,
  type ContentLocale,
  type ContentPlan,
  type ContentRecord,
  type ContentSource,
} from '../domain/content.ts'
import type { BusinessProfile } from '../domain/business.ts'
import { CHANNELS, type Channel, type Lead } from '../types.ts'

export type ProduceInput = {
  count?: number
  channels?: Channel[]
  locale?: ContentLocale
  /** How many pieces a day the schedule lays out. */
  perDay?: number
  /** Scales the spacing, exactly like a nurture sequence. 0 is due-now. */
  speed?: number
  from?: Date
}

/**
 * Writes one batch. The owner's profile is the whole subject: with nothing to
 * write about, this returns an empty plan carrying the missing fields rather
 * than inventing a business that does not exist.
 */
export async function produce(input: ProduceInput = {}): Promise<ContentPlan> {
  const locale: ContentLocale = input.locale === 'en' ? 'en' : 'fa'
  const business = q.getBusiness()

  if (!isUsable(business)) {
    return { pieces: [], locale, producedBy: 'none', blockedBy: missingFields(business) }
  }

  const channels = pickChannels(input.channels, business)
  const briefs = briefsFor(channels, input.count ?? DEFAULT_COUNT)
  const { drafts, producedBy } = await write(business, briefs, locale)

  const pieces = planSchedule(
    drafts,
    input.from ?? new Date(),
    input.perDay ?? DEFAULT_PER_DAY,
    input.speed ?? env.sequenceSpeed,
  )
  return { pieces, locale, producedBy, blockedBy: [] }
}

/** Asked-for channels first, then the ones the owner says they are on. */
const pickChannels = (asked: Channel[] | undefined, business: BusinessProfile): Channel[] => {
  if (asked && asked.length > 0) return asked
  return business.channels.length > 0 ? business.channels : [...CHANNELS]
}

/**
 * The adapter writes the words; the templates answer whenever it cannot. A
 * partial answer is thrown away whole — `mergeDrafts` returns nothing unless
 * every brief came back complete — so `producedBy` is never a half-truth.
 */
async function write(
  business: BusinessProfile,
  briefs: ContentBrief[],
  locale: ContentLocale,
): Promise<{ drafts: ContentDraft[]; producedBy: ContentSource }> {
  const adapter = ai()
  try {
    const drafts = mergeDrafts(briefs, await adapter.writeContent({ business, briefs, locale }))
    if (drafts.length === briefs.length) {
      return { drafts, producedBy: adapter.name === 'claude' ? 'claude' : 'template' }
    }
    console.warn('[content] the producer came back incomplete; using the templates')
  } catch (error) {
    console.warn('[content] production fell back to the templates:', (error as Error).message)
  }
  return { drafts: mergeDrafts(briefs, templateContent(business, briefs, locale)), producedBy: 'template' }
}

/** Stores a plan and hands back what the API returns. */
export function persistPlan(plan: ContentPlan): ContentRecord[] {
  const stored = plan.pieces.map((piece) =>
    q.insertContentPiece({
      kind: piece.kind,
      channel: piece.channel,
      title: piece.title,
      body: piece.body,
      locale: plan.locale,
      angle: piece.angle,
      dueAt: piece.dueAt,
      producedBy: plan.producedBy,
    }),
  )
  if (stored.length > 0) publish({ type: 'content.produced', nodeId: 'factory' })
  return stored
}

/**
 * The channel adapters address a lead, and a published piece has no lead: this
 * is the audience of a channel standing in for one. `target` is the only field
 * a live adapter reads — with none, Telegram has nowhere to put the piece and
 * says so, which is the truth rather than a silent success.
 */
const audience = (piece: ContentRecord, target: string | null): Lead => ({
  id: 0,
  source: piece.channel,
  external_id: target,
  handle: null,
  name: null,
  locale: piece.locale,
  score: 0,
  route: 'cold',
  stage: 'new',
  owner: null,
  value_toman: 0,
  created_at: piece.createdAt,
  updated_at: piece.createdAt,
})

/**
 * One worker pass: everything pending whose hour has come goes out through its
 * channel. `sent` when the channel really delivered it, `simulated` when the
 * adapter only recorded it. Returns how many left; never throws.
 */
export async function publishDue(now = new Date(), limit = 25): Promise<number> {
  let published = 0

  // Read once per pass, and read now rather than when the batch was written:
  // the owner may fill a channel's destination in after producing a week of
  // pieces, and those pieces should then go where they now belong.
  const business = q.getBusiness()

  for (const piece of q.dueContent(now, limit)) {
    try {
      const adapter = channelFor(piece.channel)
      // A piece that already went somewhere keeps that address; everything else
      // asks the profile where this channel publishes.
      const target = piece.target ?? destinationFor(business, piece.channel)

      // A live channel needs somewhere to put it. Saying so beats a generic
      // rejection, and beats calling it published when nothing was delivered.
      if (adapter.live && !target) {
        q.markContentStatus(piece.id, 'failed', 'target:required')
        continue
      }

      const result = await adapter.send(audience(piece, target), piece.body)

      if (result.status === 'failed') {
        // The adapter's own reason when it has one: "Instagram cannot publish
        // text on its own" is something the owner can act on, and "Instagram
        // rejected this piece" is not.
        q.markContentStatus(piece.id, 'failed', result.reason ?? `${piece.channel}:rejected`)
        continue
      }

      // 'received' belongs to inbound messages; anything else is what the
      // adapter actually did with this piece.
      const status = result.status === 'sent' ? 'sent' : 'simulated'
      // Where it went is history now: the profile may name a different address
      // tomorrow, and this row must keep saying where this piece was delivered.
      if (target !== piece.target) q.setContentTarget(piece.id, target)
      q.markContentStatus(piece.id, status, result.externalId ?? null)
      publish({ type: 'content.published', nodeId: piece.channel })
      published += 1
    } catch (error) {
      q.markContentStatus(piece.id, 'failed', (error as Error).message.slice(0, 200))
    }
  }

  return published
}
