/**
 * Real text-to-speech through ElevenLabs, behind `ELEVENLABS_API_KEY`.
 *
 * UNVERIFIED: this call has never run against the live API from this
 * repository — no account exists here. It is written straight from the
 * documented `text-to-speech` endpoint and kept deliberately small so the
 * first person with a key can check it in one read. Everything is wrapped: any
 * failure falls back to the timed script rather than losing the work.
 *
 * The variables are read from `process.env` at call time instead of `env.ts`
 * so this adapter is self-contained and a test can toggle them.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { scriptOnlyVoice } from './script-only.ts'
import { MEDIA_URL_PREFIX, mediaDir, type VoiceoverAdapter, type VoiceoverInput } from './types.ts'

/** "Rachel" — the sample voice on every ElevenLabs account. */
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

/** The multilingual model, because the app writes Persian first. */
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2'

const OUTPUT_FORMAT = 'mp3_44100_128'

const apiKey = () => process.env.ELEVENLABS_API_KEY ?? ''
const baseUrl = () => (process.env.ELEVENLABS_API_URL ?? 'https://api.elevenlabs.io/v1').replace(/\/$/, '')

export const hasElevenLabs = (): boolean => apiKey().length > 0

type TimestampedSpeech = {
  audio_base64?: string
  alignment?: { character_end_times_seconds?: number[] }
}

/**
 * The `with-timestamps` variant costs the same and returns per-character end
 * times, which is the only way to record a true duration instead of an
 * estimate — and truth about duration is the whole reason to call the API.
 */
async function speak(input: VoiceoverInput): Promise<{ file: string; durationSec?: number; requestId?: string }> {
  const voiceId = input.voice?.trim() || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID
  const url = `${baseUrl()}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${OUTPUT_FORMAT}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey(), 'content-type': 'application/json' },
    body: JSON.stringify({
      text: input.script,
      model_id: process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID,
    }),
  })

  if (!response.ok) throw new Error(`elevenlabs answered ${response.status}`)

  const payload = (await response.json()) as TimestampedSpeech
  if (!payload.audio_base64) throw new Error('elevenlabs returned no audio')

  const name = `${randomUUID()}.mp3`
  const directory = mediaDir()
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, name), Buffer.from(payload.audio_base64, 'base64'))

  const ends = payload.alignment?.character_end_times_seconds ?? []
  const last = ends.length > 0 ? ends[ends.length - 1] : undefined

  return {
    file: name,
    durationSec: typeof last === 'number' ? Math.round(last * 10) / 10 : undefined,
    requestId: response.headers.get('request-id') ?? undefined,
  }
}

export const elevenLabsVoice: VoiceoverAdapter = {
  name: 'elevenlabs',
  live: true,

  async render(input: VoiceoverInput) {
    try {
      const spoken = await speak(input)
      return {
        status: 'rendered' as const,
        url: `${MEDIA_URL_PREFIX}/${spoken.file}`,
        durationSec: spoken.durationSec,
        externalId: spoken.requestId,
      }
    } catch (error) {
      console.warn('[media] elevenlabs failed; recording the timed script instead:', (error as Error).message)
      const scripted = await scriptOnlyVoice.render(input)
      return { ...scripted, reason: 'elevenlabs:unavailable' }
    }
  },
}
