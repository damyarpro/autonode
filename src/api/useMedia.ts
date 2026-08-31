import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiUrl, deleteJson, getJson, postJson } from './client'
import type { Locale } from '../data/types'

/**
 * The studio's half of the two production nodes: ELEVENLABS (voice-over) and
 * HIGGSFIELD (ad video).
 *
 * The shapes below are restated rather than imported: `server/` is outside the
 * app's tsconfig, so the browser build cannot see it. They mirror
 * `server/adapters/media/types.ts` exactly, and a change there has to land here
 * in the same commit.
 */

export const MEDIA_KINDS = ['voice', 'video'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

/**
 * A voice run ends `rendered` (audio exists) or `scripted` (a timed script
 * exists); a video run ends `rendered` (a provider URL exists) or
 * `storyboarded` (a shot list exists). `failed` produced nothing.
 */
export type MediaStatus = 'rendered' | 'scripted' | 'storyboarded' | 'failed'

/** One speakable line with the time it takes to say at a normal pace. */
export type ScriptLine = {
  index: number
  text: string
  words: number
  /** Seconds this line takes on its own, breath pause included. */
  seconds: number
  /** Seconds from the top of the script to the start of this line. */
  startSec: number
}

export type TimedScript = {
  lines: ScriptLine[]
  words: number
  durationSec: number
  wordsPerMinute: number
  voice: string | null
}

export type VoiceoverResult = {
  status: MediaStatus
  externalId?: string
  url?: string
  durationSec?: number
  /** The artefact when no audio was produced: the script, timed line by line. */
  script?: TimedScript
  /** Why a real render did not happen, as a short machine-readable reason. */
  reason?: string
}

/** One shot: what the camera shows, what is written over it, how long it holds. */
export type Shot = {
  index: number
  role: 'hook' | 'beat' | 'cta'
  onScreen: string
  caption: string
  seconds: number
}

export type Storyboard = {
  shots: Shot[]
  durationSec: number
  style: string | null
}

export type AdVideoResult = {
  status: MediaStatus
  externalId?: string
  url?: string
  durationSec?: number
  /** The artefact when no video was produced: the shot list. */
  storyboard?: Storyboard
  reason?: string
}

/** One recorded production run, exactly as the API returns it. */
export type MediaJob = {
  id: number
  kind: MediaKind
  status: MediaStatus
  /** Which half produced it — 'elevenlabs' or 'script-only', never a guess. */
  adapter: string
  locale: string
  input: Record<string, unknown>
  output: VoiceoverResult | AdVideoResult
  externalId: string | null
  url: string | null
  durationSec: number | null
  at: string
}

/** Which adapter each node is running behind right now. */
export type MediaAdapters = { voiceover: string; adVideo: string }

/** The adapters that call a paid service; anything else is the local fallback. */
const LIVE_ADAPTERS = new Set(['elevenlabs', 'higgsfield'])
export const isLiveAdapter = (name: string): boolean => LIVE_ADAPTERS.has(name)

/** The same ceilings `server/routes/media.ts` validates against. */
export const MEDIA_LIMITS = { script: 5000, voice: 120, brief: 4000, style: 80 } as const

export type VoiceoverRequest = { script: string; locale?: Locale; voice?: string }
export type AdVideoRequest = { brief: string; locale?: Locale; style?: string }

/**
 * Rendered audio is served by this server from its own path; a provider's
 * finished video is an absolute URL and is left alone.
 */
export const mediaHref = (url: string): string => (/^https?:\/\//i.test(url) ? url : apiUrl(url))

/** Narrowing helpers, so a page never reads a storyboard off a voice job. */
export const voiceOutput = (job: MediaJob): VoiceoverResult | null =>
  job.kind === 'voice' ? (job.output as VoiceoverResult) : null
export const videoOutput = (job: MediaJob): AdVideoResult | null =>
  job.kind === 'video' ? (job.output as AdVideoResult) : null

/**
 * Why a request failed. `messages` are the server's `field:code` strings, which
 * the page turns into sentences — the server never writes user-facing prose.
 */
export type MediaFailure = {
  kind: 'validation' | 'notFound' | 'offline' | 'server'
  messages: string[]
}

export type MediaFilter = MediaKind | 'all'

export type MediaState = {
  /** Everything produced so far, newest first; empty while offline. */
  jobs: MediaJob[]
  adapters: MediaAdapters | null
  filter: MediaFilter
  setFilter: (next: MediaFilter) => void
  loading: boolean
  online: boolean
  voicing: boolean
  filming: boolean
  /** The job to show as the answer: this session's run, else the newest stored. */
  latestVoice: MediaJob | null
  latestVideo: MediaJob | null
  error: MediaFailure | null
  renderVoice: (request: VoiceoverRequest) => Promise<MediaJob | null>
  renderVideo: (request: AdVideoRequest) => Promise<MediaJob | null>
  remove: (id: number) => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
}

const HISTORY_LIMIT = 30

type ListResponse = { jobs: MediaJob[]; adapters: MediaAdapters }
type JobResponse = { job: MediaJob }

/** Maps a thrown value onto the reason the page reports. */
function failureOf(cause: unknown): MediaFailure {
  if (!(cause instanceof ApiError)) return { kind: 'offline', messages: [] }
  const kind = cause.status === 400 ? 'validation' : cause.status === 404 ? 'notFound' : 'server'
  return { kind, messages: cause.messages }
}

/**
 * The studio's jobs and its two produce actions. An unreachable `/api` leaves
 * the list empty and flips `online`, so the page renders its calm empty state
 * instead of throwing.
 */
export function useMedia(): MediaState {
  const [jobs, setJobs] = useState<MediaJob[]>([])
  const [adapters, setAdapters] = useState<MediaAdapters | null>(null)
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(true)
  const [voicing, setVoicing] = useState(false)
  const [filming, setFilming] = useState(false)
  const [latestVoice, setLatestVoice] = useState<MediaJob | null>(null)
  const [latestVideo, setLatestVideo] = useState<MediaJob | null>(null)
  const [error, setError] = useState<MediaFailure | null>(null)

  /**
   * A filtered fetch cannot see the other kind, so the answer panels keep the
   * newest job they already had rather than blanking while the list is narrowed.
   */
  const absorb = useCallback((list: MediaJob[], scope: MediaFilter) => {
    if (scope !== 'video') setLatestVoice(list.find((job) => job.kind === 'voice') ?? null)
    if (scope !== 'voice') setLatestVideo(list.find((job) => job.kind === 'video') ?? null)
  }, [])

  const load = useCallback(
    async (scope: MediaFilter) => {
      const params = new URLSearchParams({ limit: String(HISTORY_LIMIT) })
      if (scope !== 'all') params.set('kind', scope)
      try {
        const data = await getJson<ListResponse>(`/api/media?${params}`)
        setJobs(data.jobs)
        setAdapters(data.adapters)
        absorb(data.jobs, scope)
        setOnline(true)
      } catch {
        setJobs([])
        setOnline(false)
      } finally {
        setLoading(false)
      }
    },
    [absorb],
  )

  useEffect(() => {
    void load(filter)
  }, [load, filter])

  const refresh = useCallback(() => load(filter), [load, filter])

  /** Both produce actions record a row either way, so a new job always arrives. */
  const produce = useCallback(
    async (path: string, body: unknown, busy: (value: boolean) => void): Promise<MediaJob | null> => {
      busy(true)
      setError(null)
      try {
        const { job } = await postJson<JobResponse>(path, body)
        setOnline(true)
        if (job.kind === 'voice') setLatestVoice(job)
        else setLatestVideo(job)
        // Only shows in the list when the current filter admits it.
        setJobs((prev) => (filter === 'all' || filter === job.kind ? [job, ...prev] : prev))
        return job
      } catch (cause) {
        const failure = failureOf(cause)
        setError(failure)
        if (failure.kind === 'offline') setOnline(false)
        return null
      } finally {
        busy(false)
      }
    },
    [filter],
  )

  const renderVoice = useCallback(
    (request: VoiceoverRequest) =>
      produce(
        '/api/media/voice',
        { script: request.script, locale: request.locale, voice: request.voice || undefined },
        setVoicing,
      ),
    [produce],
  )

  const renderVideo = useCallback(
    (request: AdVideoRequest) =>
      produce(
        '/api/media/video',
        { brief: request.brief, locale: request.locale, style: request.style || undefined },
        setFilming,
      ),
    [produce],
  )

  const remove = useCallback(async (id: number) => {
    const forget = () => {
      setJobs((prev) => prev.filter((job) => job.id !== id))
      setLatestVoice((prev) => (prev && prev.id === id ? null : prev))
      setLatestVideo((prev) => (prev && prev.id === id ? null : prev))
    }
    try {
      await deleteJson(`/api/media/${id}`)
      forget()
      setOnline(true)
    } catch (cause) {
      // A 404 means it is already gone, which is the state the caller wanted.
      if (cause instanceof ApiError && cause.status === 404) return forget()
      if (cause instanceof ApiError) setError(failureOf(cause))
      else setOnline(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return {
    jobs,
    adapters,
    filter,
    setFilter,
    loading,
    online,
    voicing,
    filming,
    latestVoice,
    latestVideo,
    error,
    renderVoice,
    renderVideo,
    remove,
    refresh,
    clearError,
  }
}
