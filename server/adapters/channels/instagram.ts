/**
 * Real publishing to Instagram, behind `INSTAGRAM_ACCESS_TOKEN`.
 *
 * Instagram is not LinkedIn: the Content Publishing API has no text-only post.
 * Every container it accepts is built around an image or a video that is
 * already reachable at a public URL, and the words are only the caption. A
 * `copy` piece therefore **cannot** be published here, and this adapter says so
 * with `instagram:needs_media` rather than reporting a delivery that did not
 * happen. The media URL is taken from the piece itself — the first image or
 * video link in the body — because nothing in the schema carries one.
 *
 * UNVERIFIED: no Instagram business account exists in this repository, so the
 * two-step container/publish call has never run against the live API. It
 * follows the documented shape, and the host, the version, the paths and the
 * poll budget are all environment variables, so a wrong guess needs no code.
 *
 * The variables are read from `process.env` at call time rather than from
 * `env.ts`, so this adapter is self-contained and a test can toggle them.
 */
import { setTimeout as sleep } from 'node:timers/promises'
import type { Lead } from '../../types.ts'
import { isAudience, type ChannelAdapter, type ChannelSendResult } from '../types.ts'
// Its home is `adapters/types.ts`, which every adapter shares; it lives beside
// the first channel that needed it until the interface itself carries a reason.

const accessToken = () => process.env.INSTAGRAM_ACCESS_TOKEN ?? ''
const baseUrl = () => (process.env.INSTAGRAM_API_BASE ?? 'https://graph.facebook.com/v21.0').replace(/\/+$/, '')
const mediaPath = () => (process.env.INSTAGRAM_MEDIA_PATH ?? 'media').replace(/^\/+|\/+$/g, '')
const publishPath = () => (process.env.INSTAGRAM_PUBLISH_PATH ?? 'media_publish').replace(/^\/+|\/+$/g, '')

/** A video container is encoded before it can be published, so it is polled. */
const pollMs = () => Number(process.env.INSTAGRAM_POLL_MS ?? 3000)
const pollAttempts = () => Number(process.env.INSTAGRAM_POLL_ATTEMPTS ?? 10)

const timeoutMs = () => Number(process.env.CHANNEL_TIMEOUT_MS ?? 15_000)

/** A long-lived page token with `instagram_content_publish`. */
export const hasInstagram = (): boolean => accessToken().length > 0

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png']
const VIDEO_EXTENSIONS = ['mp4', 'mov']

export type PieceMedia = { url: string; kind: 'image' | 'video' }

/**
 * The first link in the body that points at something Instagram can publish.
 * A trailing bracket or full stop is punctuation around the link rather than
 * part of it, so it is trimmed before the extension is read.
 */
export function mediaIn(body: string): PieceMedia | null {
  for (const raw of body.match(/https?:\/\/[^\s<>"']+/g) ?? []) {
    const candidate = raw.replace(/[.,;:!?)\]}»]+$/, '')
    let extension = ''
    try {
      extension = (new URL(candidate).pathname.split('.').pop() ?? '').toLowerCase()
    } catch {
      continue
    }
    if (IMAGE_EXTENSIONS.includes(extension)) return { url: candidate, kind: 'image' }
    if (VIDEO_EXTENSIONS.includes(extension)) return { url: candidate, kind: 'video' }
  }
  return null
}

/** The link is the post, not the caption, so it does not get read out twice. */
const captionFor = (body: string, media: PieceMedia): string => body.split(media.url).join('').trim()

const form = (fields: Record<string, string>) => new URLSearchParams({ ...fields, access_token: accessToken() })

/** An error body is still a body; a provider that answers HTML must not throw. */
async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return ((await response.json()) ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

const post = (path: string, fields: Record<string, string>) =>
  fetch(`${baseUrl()}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(timeoutMs()),
    body: form(fields).toString(),
  })

/**
 * A video container reports `IN_PROGRESS` until Instagram has encoded it.
 * Publishing early fails, so the container is polled — and a container that is
 * still not finished inside the budget is reported as not ready rather than
 * as published.
 */
async function containerReady(containerId: string): Promise<boolean> {
  for (let attempt = 0; attempt < pollAttempts(); attempt += 1) {
    const url = `${baseUrl()}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken())}`
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs()) })
    const status = String((await readJson(response)).status_code ?? '')
    if (status === 'FINISHED') return true
    if (status === 'ERROR' || status === 'EXPIRED') return false
    await sleep(pollMs())
  }
  return false
}

export const instagramChannel: ChannelAdapter = {
  channel: 'instagram',
  live: true,

  async send(lead: Lead, body: string): Promise<ChannelSendResult> {
    // This is the publishing API, not the messaging one.
    if (!isAudience(lead)) return { status: 'failed', reason: 'instagram:no_direct_message' }

    const igUserId = lead.external_id?.trim() ?? ''
    if (!igUserId) return { status: 'failed', reason: 'instagram:needs_target' }

    // The honest half of this adapter: words alone are not an Instagram post.
    const media = mediaIn(body)
    if (!media) return { status: 'failed', reason: 'instagram:needs_media' }

    try {
      const created = await post(`${igUserId}/${mediaPath()}`, {
        ...(media.kind === 'image'
          ? { image_url: media.url }
          : { video_url: media.url, media_type: process.env.INSTAGRAM_VIDEO_TYPE ?? 'REELS' }),
        caption: captionFor(body, media),
      })
      if (!created.ok) {
        console.warn(`[channel] instagram refused the container: ${created.status}`)
        return { status: 'failed', reason: 'instagram:rejected' }
      }

      const containerId = String((await readJson(created)).id ?? '')
      if (!containerId) return { status: 'failed', reason: 'instagram:rejected' }

      if (media.kind === 'video' && !(await containerReady(containerId))) {
        console.warn(`[channel] instagram container ${containerId} was not ready in time`)
        return { status: 'failed', reason: 'instagram:not_ready' }
      }

      const published = await post(`${igUserId}/${publishPath()}`, { creation_id: containerId })
      if (!published.ok) {
        console.warn(`[channel] instagram refused the publish: ${published.status}`)
        return { status: 'failed', reason: 'instagram:rejected' }
      }

      const id = String((await readJson(published)).id ?? '')
      return { status: 'sent', externalId: id || containerId }
    } catch (error) {
      // Never throw: a dead provider must not take the worker pass down.
      console.warn('[channel] instagram was unreachable:', (error as Error).message)
      return { status: 'failed', reason: 'instagram:unreachable' }
    }
  },
}
