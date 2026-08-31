/**
 * Real publishing to YouTube, behind a Google OAuth credential.
 *
 * A script is not a video. `videos.insert` uploads bytes — there is no endpoint
 * that turns a paragraph into a YouTube video — so a `copy` or `voice` piece
 * cannot be published here and this adapter says so with `youtube:needs_video`
 * rather than reporting a delivery that did not happen. The bytes come from the
 * first video link in the piece's body, because nothing in the schema carries a
 * rendered file; the studio's ad-video job is where such a link comes from.
 *
 * The channel is decided by the OAuth credential, not by the piece's target, so
 * this is the one live channel that does not need one.
 *
 * New uploads default to `private`. Publishing to the world on a worker pass is
 * not a default anybody should get by accident — set `YOUTUBE_PRIVACY_STATUS`
 * deliberately.
 *
 * UNVERIFIED: no Google project exists in this repository, so neither the token
 * exchange nor the resumable upload has run against the live API. Both follow
 * the documented shape, and every host, path, part and limit is an environment
 * variable, so a wrong guess needs no code.
 *
 * The variables are read from `process.env` at call time rather than from
 * `env.ts`, so this adapter is self-contained and a test can toggle them.
 */
import type { Lead } from '../../types.ts'
import { isAudience, type ChannelAdapter, type ChannelSendResult, type SendMeta } from '../types.ts'
// Its home is `adapters/types.ts`, which every adapter shares; it lives beside
// the first channel that needed it until the interface itself carries a reason.

const staticToken = () => process.env.YOUTUBE_ACCESS_TOKEN ?? ''
const clientId = () => process.env.YOUTUBE_CLIENT_ID ?? ''
const clientSecret = () => process.env.YOUTUBE_CLIENT_SECRET ?? ''
const refreshToken = () => process.env.YOUTUBE_REFRESH_TOKEN ?? ''

const tokenUrl = () => process.env.YOUTUBE_TOKEN_URL ?? 'https://oauth2.googleapis.com/token'
const uploadUrl = () => process.env.YOUTUBE_UPLOAD_URL ?? 'https://www.googleapis.com/upload/youtube/v3/videos'
const uploadParts = () => process.env.YOUTUBE_UPLOAD_PARTS ?? 'snippet,status'

const privacyStatus = () => process.env.YOUTUBE_PRIVACY_STATUS ?? 'private'
const categoryId = () => process.env.YOUTUBE_CATEGORY_ID ?? '22'

/** Whole-file upload, so the file is held in memory: keep the ceiling sane. */
const maxBytes = () => Number(process.env.YOUTUBE_MAX_UPLOAD_BYTES ?? 128 * 1024 * 1024)

const timeoutMs = () => Number(process.env.CHANNEL_TIMEOUT_MS ?? 15_000)
const uploadTimeoutMs = () => Number(process.env.YOUTUBE_UPLOAD_TIMEOUT_MS ?? 120_000)

/**
 * Either a token somebody minted by hand, or the refresh credential that can
 * mint one. Anything less cannot upload, so the channel stays store-only.
 */
export const hasYouTube = (): boolean =>
  staticToken().length > 0 || (clientId().length > 0 && clientSecret().length > 0 && refreshToken().length > 0)

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v']

/** The first link in the body that points at a video file. */
export function videoIn(body: string): string | null {
  for (const raw of body.match(/https?:\/\/[^\s<>"']+/g) ?? []) {
    const candidate = raw.replace(/[.,;:!?)\]}»]+$/, '')
    try {
      const extension = (new URL(candidate).pathname.split('.').pop() ?? '').toLowerCase()
      if (VIDEO_EXTENSIONS.includes(extension)) return candidate
    } catch {
      continue
    }
  }
  return null
}

/** YouTube truncates a title at 100 characters, so the cut is made here. */
const titleFrom = (body: string): string => {
  const first = body.trim().split('\n')[0]?.trim() ?? ''
  const title = first.length > 0 ? first : 'Untitled'
  return title.length > 100 ? `${title.slice(0, 97)}…` : title
}

/** One exchanged token, reused until it expires rather than minted per send. */
let cached: { token: string; expiresAt: number } | null = null

async function accessToken(): Promise<string> {
  const fixed = staticToken()
  if (fixed) return fixed
  if (cached && cached.expiresAt > Date.now()) return cached.token

  const response = await fetch(tokenUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(timeoutMs()),
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: refreshToken(),
      grant_type: 'refresh_token',
    }).toString(),
  })
  if (!response.ok) throw new Error(`google refused the refresh token: ${response.status}`)

  const payload = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!payload.access_token) throw new Error('google returned no access token')

  // A minute of slack, so a token never expires mid-upload.
  cached = { token: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 - 60_000 }
  return cached.token
}

/** Only for tests and for a credential change: the next send mints a new one. */
export const forgetYouTubeToken = () => {
  cached = null
}

export const youtubeChannel: ChannelAdapter = {
  channel: 'youtube',
  live: true,

  async send(lead: Lead, body: string, meta?: SendMeta): Promise<ChannelSendResult> {
    // A channel has an audience, not an inbox.
    if (!isAudience(lead)) return { status: 'failed', reason: 'youtube:no_direct_message' }

    // The honest half of this adapter: a script is not a video.
    const source = videoIn(body)
    if (!source) return { status: 'failed', reason: 'youtube:needs_video' }

    try {
      const token = await accessToken()

      const file = await fetch(source, { signal: AbortSignal.timeout(uploadTimeoutMs()) })
      if (!file.ok) {
        console.warn(`[channel] youtube could not read ${source}: ${file.status}`)
        return { status: 'failed', reason: 'youtube:needs_video' }
      }
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (bytes.byteLength === 0 || bytes.byteLength > maxBytes()) {
        console.warn(`[channel] youtube will not upload ${bytes.byteLength} bytes from ${source}`)
        return { status: 'failed', reason: 'youtube:needs_video' }
      }
      const contentType = file.headers.get('content-type') ?? 'video/*'

      // Resumable rather than multipart: the metadata is accepted or refused
      // before a byte of video moves, which is the cheaper failure.
      const session = await fetch(`${uploadUrl()}?uploadType=resumable&part=${encodeURIComponent(uploadParts())}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-upload-content-type': contentType,
          'x-upload-content-length': String(bytes.byteLength),
        },
        signal: AbortSignal.timeout(timeoutMs()),
        body: JSON.stringify({
          snippet: { title: titleFrom(meta?.title || body), description: body.slice(0, 5000), categoryId: categoryId() },
          status: { privacyStatus: privacyStatus(), selfDeclaredMadeForKids: false },
        }),
      })
      if (!session.ok) {
        console.warn(`[channel] youtube refused the upload session: ${session.status}`)
        return { status: 'failed', reason: 'youtube:rejected' }
      }

      const location = session.headers.get('location')
      if (!location) {
        console.warn('[channel] youtube opened no upload session')
        return { status: 'failed', reason: 'youtube:rejected' }
      }

      const uploaded = await fetch(location, {
        method: 'PUT',
        headers: { 'content-type': contentType, 'content-length': String(bytes.byteLength) },
        signal: AbortSignal.timeout(uploadTimeoutMs()),
        body: bytes,
      })
      if (!uploaded.ok) {
        console.warn(`[channel] youtube refused the upload: ${uploaded.status}`)
        return { status: 'failed', reason: 'youtube:rejected' }
      }

      const payload = (await uploaded.json()) as { id?: string }
      if (!payload.id) return { status: 'failed', reason: 'youtube:rejected' }
      return { status: 'sent', externalId: payload.id }
    } catch (error) {
      // Never throw: a dead provider must not take the worker pass down.
      console.warn('[channel] youtube was unreachable:', (error as Error).message)
      return { status: 'failed', reason: 'youtube:unreachable' }
    }
  },
}
