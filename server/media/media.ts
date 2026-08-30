/**
 * Production orchestration for the ELEVENLABS and HIGGSFIELD nodes: pick the
 * adapter the environment allows, run it, and record the job with whatever it
 * produced. Nothing here throws — a provider that fails still leaves a row, and
 * with no credentials at all the row carries the timed script or the storyboard,
 * which is real work rather than a placeholder.
 *
 * Callers pass the script or the brief as plain text, so the content factory,
 * a route or a script can all drive this without knowing about each other.
 */
import { adVideo, voiceover } from '../adapters/registry.ts'
import * as q from '../db/queries.ts'
import type { AdVideoResult, MediaJob, VoiceoverResult } from '../adapters/media/types.ts'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/** The content list shows a title, not a paragraph. */
const title = (text: string, max = 70): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`
}

const localeOf = (locale?: string): string => (locale === 'en' ? 'en' : 'fa')

export type VoiceoverRequest = { script: string; locale?: string; voice?: string }
export type AdVideoRequest = { brief: string; locale?: string; style?: string }

/**
 * A produced piece is counted on the board, so the node's number is the number
 * of artefacts that exist. A failed run is recorded but counts nothing.
 */
const countPiece = (kind: 'voice' | 'video', status: string, text: string): void => {
  if (status === 'failed') return
  q.addContentPiece(kind, title(text))
}

export async function renderVoiceover(request: VoiceoverRequest): Promise<MediaJob> {
  const adapter = voiceover()
  const locale = localeOf(request.locale)
  const input = { script: request.script, locale, voice: request.voice ?? null }

  let result: VoiceoverResult
  try {
    result = await adapter.render({ script: request.script, locale, voice: request.voice })
  } catch (error) {
    // The adapters fall back internally; this is the last net, so one bad
    // provider cannot take down the caller that asked for a voiceover.
    console.warn(`[media] ${adapter.name} threw:`, (error as Error).message)
    result = { status: 'failed', reason: `${adapter.name}:threw` }
  }

  const job = q.saveMediaJob({
    kind: 'voice',
    status: result.status,
    adapter: adapter.name,
    locale,
    input,
    output: result,
    externalId: result.externalId ?? null,
    url: result.url ?? null,
    durationSec: result.durationSec ?? null,
  })
  countPiece('voice', result.status, request.script)
  return job
}

export async function renderAdVideo(request: AdVideoRequest): Promise<MediaJob> {
  const adapter = adVideo()
  const locale = localeOf(request.locale)
  const input = { brief: request.brief, locale, style: request.style ?? null }

  let result: AdVideoResult
  try {
    result = await adapter.render({ brief: request.brief, locale, style: request.style })
  } catch (error) {
    console.warn(`[media] ${adapter.name} threw:`, (error as Error).message)
    result = { status: 'failed', reason: `${adapter.name}:threw` }
  }

  const job = q.saveMediaJob({
    kind: 'video',
    status: result.status,
    adapter: adapter.name,
    locale,
    input,
    output: result,
    externalId: result.externalId ?? null,
    url: result.url ?? null,
    durationSec: result.durationSec ?? null,
  })
  countPiece('video', result.status, request.brief)
  return job
}

/** Newest first. An out-of-range limit is clamped rather than refused. */
export function listMediaJobs(limit = DEFAULT_LIMIT, kind?: 'voice' | 'video'): MediaJob[] {
  const asked = Number(limit)
  const safe = Number.isFinite(asked) && asked > 0 ? Math.min(Math.floor(asked), MAX_LIMIT) : DEFAULT_LIMIT
  return q.listMediaJobRows(safe, kind)
}
