/**
 * Real delivery to the owner's own site, behind `WEBSITE_PUBLISH_URL`.
 *
 * There is no website API to sign up for: the site belongs to the owner, so the
 * honest implementation is the mirror image of the webhook this server already
 * accepts. A piece goes out as one signed JSON POST to a URL the owner
 * configures, and the receiver — their CMS endpoint, a serverless function, a
 * Zapier catch hook — decides what a post means on their site.
 *
 * The signature is computed exactly as `signatureMatches` in
 * `server/routes/webhooks.ts` verifies it: sha256 HMAC of the raw JSON body,
 * hex, in `x-signature`. The body is sent as the very string that was signed,
 * and its keys are plain values in a fixed order, so a receiver that verifies
 * over `JSON.stringify(parsedBody)` — which is what this repository's own
 * inbound route does — computes the same digest.
 *
 * Signing is opt-in in the same way inbound verification is: with no secret the
 * POST goes unsigned rather than not going at all.
 *
 * The variables are read from `process.env` at call time rather than from
 * `env.ts`, so this adapter is self-contained and a test can toggle them.
 */
import { createHmac } from 'node:crypto'
import type { Lead } from '../../types.ts'
import { isAudience, type ChannelAdapter, type ChannelSendResult } from '../types.ts'
// Its home is `adapters/types.ts`, which every adapter shares; it lives beside
// the first channel that needed it until the interface itself carries a reason.

const publishUrl = () => process.env.WEBSITE_PUBLISH_URL ?? ''

/** Its own key when there is one, otherwise the key the inbound hook uses. */
const signingSecret = () => process.env.WEBSITE_SIGNING_SECRET || process.env.WEBHOOK_SIGNING_SECRET || ''

const signatureHeader = () => process.env.WEBSITE_SIGNATURE_HEADER ?? 'x-signature'
const authToken = () => process.env.WEBSITE_PUBLISH_TOKEN ?? ''
const timeoutMs = () => Number(process.env.CHANNEL_TIMEOUT_MS ?? 15_000)

/** An endpoint is the whole credential: without one there is nowhere to POST. */
export const hasWebsite = (): boolean => publishUrl().length > 0

/** The same digest `signatureMatches` computes over an inbound raw body. */
export const sign = (raw: string, secret: string): string =>
  createHmac('sha256', secret).update(raw).digest('hex')

export const websiteChannel: ChannelAdapter = {
  channel: 'website',
  live: true,

  async send(lead: Lead, body: string): Promise<ChannelSendResult> {
    // The receiver publishes what it is handed, so a message written for one
    // lead must never reach it: that would put private words on a public page.
    if (!isAudience(lead)) return { status: 'failed', reason: 'website:no_direct_message' }

    // Every value is a plain string, so the receiver's re-serialisation of the
    // parsed object is byte-identical to what was signed.
    const payload = {
      channel: 'website',
      target: lead.external_id ?? '',
      locale: lead.locale,
      body,
      sentAt: new Date().toISOString(),
    }
    const raw = JSON.stringify(payload)
    const secret = signingSecret()

    try {
      const response = await fetch(publishUrl(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(secret ? { [signatureHeader()]: sign(raw, secret) } : {}),
          ...(authToken() ? { authorization: `Bearer ${authToken()}` } : {}),
        },
        signal: AbortSignal.timeout(timeoutMs()),
        body: raw,
      })

      if (!response.ok) {
        console.warn(`[channel] the website endpoint refused the piece: ${response.status}`)
        return { status: 'failed', reason: 'website:rejected' }
      }

      // A receiver that answers with an id gets it recorded; one that answers
      // "204 no content" is just as valid a receiver.
      let id = ''
      try {
        const answer = ((await response.json()) ?? {}) as { id?: unknown; externalId?: unknown }
        id = String(answer.id ?? answer.externalId ?? '')
      } catch {
        id = ''
      }

      return { status: 'sent', externalId: id || undefined }
    } catch (error) {
      // Never throw: a dead endpoint must not take the worker pass down.
      console.warn('[channel] the website endpoint was unreachable:', (error as Error).message)
      return { status: 'failed', reason: 'website:unreachable' }
    }
  },
}
