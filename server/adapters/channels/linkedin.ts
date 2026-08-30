/**
 * Real publishing to LinkedIn, behind `LINKEDIN_ACCESS_TOKEN`.
 *
 * Of the four channels this repository could not deliver, LinkedIn is the one
 * that genuinely takes a piece of text and puts it in front of an audience:
 * `POST /rest/posts` with a `commentary` string is a complete post. So this
 * adapter delivers a `copy` piece for real, and nothing here pretends to do
 * more than that — an image or a document post needs the asset upload API,
 * which this does not implement.
 *
 * UNVERIFIED: no LinkedIn app exists in this repository, so the call has never
 * run against the live API. It follows the documented Posts API shape, and
 * every part a future API change could move — host, path, version header,
 * visibility — is an environment variable, so a wrong guess needs no code.
 *
 * The variables are read from `process.env` at call time rather than from
 * `env.ts`, so this adapter is self-contained and a test can toggle them.
 */
import type { Lead, Message } from '../../types.ts'
import type { ChannelAdapter } from '../types.ts'

/**
 * What `ChannelAdapter.send` promises, plus the reason a live channel refused.
 * The interface's return type does not carry a reason, and widening it is not
 * this change's to make, so the code rides along as an extra property: the
 * callers that ignore it are unaffected, and the one that wants it can read it
 * without another round trip.
 */
export type ChannelSendResult = {
  status: Message['status']
  externalId?: string
  /** `channel:code`, for `explainCode` on the client. */
  reason?: string
}

const accessToken = () => process.env.LINKEDIN_ACCESS_TOKEN ?? ''
const baseUrl = () => (process.env.LINKEDIN_API_BASE ?? 'https://api.linkedin.com/rest').replace(/\/+$/, '')
const postsPath = () => (process.env.LINKEDIN_POSTS_PATH ?? 'posts').replace(/^\/+/, '')

/** LinkedIn versions its API by month and retires each one after a year. */
const apiVersion = () => process.env.LINKEDIN_API_VERSION ?? '202601'

const visibility = () => process.env.LINKEDIN_VISIBILITY ?? 'PUBLIC'
const timeoutMs = () => Number(process.env.CHANNEL_TIMEOUT_MS ?? 15_000)

/** A three-legged OAuth token with `w_member_social` or `w_organization_social`. */
export const hasLinkedIn = (): boolean => accessToken().length > 0

/**
 * The piece's target is whatever the owner typed. A full URN goes through
 * untouched; a bare id becomes one, defaulting to an organization because that
 * is what a business publishes as.
 */
export function authorUrn(target: string | null | undefined): string | null {
  const value = target?.trim() ?? ''
  if (!value) return null
  if (value.startsWith('urn:li:')) return value
  const type = process.env.LINKEDIN_AUTHOR_TYPE ?? 'organization'
  return `urn:li:${type}:${value}`
}

export const linkedinChannel: ChannelAdapter = {
  channel: 'linkedin',
  live: true,

  async send(lead: Lead, body: string): Promise<ChannelSendResult> {
    const author = authorUrn(lead.external_id)
    if (!author) return { status: 'failed', reason: 'linkedin:needs_target' }

    try {
      const response = await fetch(`${baseUrl()}/${postsPath()}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken()}`,
          'content-type': 'application/json',
          'linkedin-version': apiVersion(),
          'x-restli-protocol-version': '2.0.0',
        },
        signal: AbortSignal.timeout(timeoutMs()),
        body: JSON.stringify({
          author,
          commentary: body,
          visibility: visibility(),
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
      })

      if (!response.ok) {
        console.warn(`[channel] linkedin refused the post: ${response.status}`)
        return { status: 'failed', reason: 'linkedin:rejected' }
      }

      // A created post answers 201 with an empty body; the URN is in a header.
      const id = response.headers.get('x-restli-id') ?? response.headers.get('x-linkedin-id')
      return { status: 'sent', externalId: id ?? undefined }
    } catch (error) {
      // Never throw: a dead provider must not take the worker pass down.
      console.warn('[channel] linkedin was unreachable:', (error as Error).message)
      return { status: 'failed', reason: 'linkedin:unreachable' }
    }
  },
}
