/**
 * The two production services behind the ELEVENLABS and HIGGSFIELD nodes.
 *
 * Both interfaces are shaped so the fallback is not a placeholder: with no
 * credentials the voice adapter still returns a finished, timed, speakable
 * script and the video adapter still returns a shot-by-shot storyboard. Those
 * artefacts are the work an owner would otherwise do by hand, so the node is
 * real before anybody pays for an account.
 */

export type VoiceoverInput = {
  script: string
  locale: string
  /** Provider voice id, or a name the fallback records as the intended voice. */
  voice?: string
}

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
  /** The voice the owner asked for, kept so a later real render matches it. */
  voice: string | null
}

export type VoiceoverStatus = 'rendered' | 'scripted' | 'failed'

export type VoiceoverResult = {
  status: VoiceoverStatus
  externalId?: string
  url?: string
  durationSec?: number
  /** The artefact when no audio was produced: the script, timed line by line. */
  script?: TimedScript
  /** Why a real render did not happen, as a short machine-readable reason. */
  reason?: string
}

export interface VoiceoverAdapter {
  readonly name: string
  /** False when the adapter produces the script instead of the audio. */
  readonly live: boolean
  render(input: VoiceoverInput): Promise<VoiceoverResult>
}

export type AdVideoInput = {
  brief: string
  locale: string
  style?: string
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

export type AdVideoStatus = 'rendered' | 'storyboarded' | 'failed'

export type AdVideoResult = {
  status: AdVideoStatus
  externalId?: string
  url?: string
  durationSec?: number
  /** The artefact when no video was produced: the shot list. */
  storyboard?: Storyboard
  reason?: string
}

export interface AdVideoAdapter {
  readonly name: string
  readonly live: boolean
  render(input: AdVideoInput): Promise<AdVideoResult>
}

export const MEDIA_KINDS = ['voice', 'video'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

export type MediaStatus = VoiceoverStatus | AdVideoStatus

/** One recorded production run, exactly as the database keeps it. */
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

/**
 * Where rendered audio is written and how it is served back. Both halves of
 * that pair — the adapter that writes the file and the route that reads it —
 * take the path from here, so there is one answer. `data/` is the only
 * writable path in the container and is gitignored.
 *
 * Read at call time rather than from `env.ts` so a test can point it at a
 * throwaway directory.
 */
export const mediaDir = (): string => process.env.MEDIA_DIR ?? 'data/media'

export const MEDIA_URL_PREFIX = '/api/media/file'
