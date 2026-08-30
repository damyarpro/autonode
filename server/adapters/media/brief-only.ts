/**
 * The no-credentials ad-video adapter, and the default one.
 *
 * It renders no frames, but it turns the brief into the thing a render is
 * ordered from: a shot list. Every shot says what is on screen, what text sits
 * over it, and how long it holds — built only out of the words the brief
 * already contains, never out of claims nobody made. The job is marked
 * `storyboarded`, never `rendered`.
 */
import { countWords, splitSpeakable } from './script-only.ts'
import type { AdVideoAdapter, AdVideoInput, Shot, Storyboard } from './types.ts'

/** A viewer reads on-screen text slower than a narrator speaks it. */
const READING_WORDS_PER_SECOND = 2.5

/** Every shot needs a beat to register, and none should outstay a scroll. */
const MIN_SHOT_SEC = 2
const MAX_SHOT_SEC = 6

/** A short ad; past this the shot list stops being a shot list. */
const MAX_SHOTS = 8

/** On-screen text longer than this stops being readable at ad pace. */
const CAPTION_WORDS = 7

/** A one-line brief is still paced across shots rather than dumped on one. */
const WORDS_PER_FALLBACK_SHOT = 6

const round1 = (value: number): number => Math.round(value * 10) / 10

const clampSeconds = (seconds: number): number =>
  round1(Math.min(MAX_SHOT_SEC, Math.max(MIN_SHOT_SEC, seconds)))

/** Keeps the first words of a segment, which is all a caption can hold. */
const caption = (segment: string, maxWords = CAPTION_WORDS): string => {
  const words = segment.trim().split(/\s+/u)
  if (words.length <= maxWords) return words.join(' ')
  return `${words.slice(0, maxWords).join(' ')}…`
}

const chunk = (segment: string, size: number): string[] => {
  const words = segment.trim().split(/\s+/u).filter((word) => word.length > 0)
  const chunks: string[] = []
  for (let at = 0; at < words.length; at += size) chunks.push(words.slice(at, at + size).join(' '))
  return chunks
}

/**
 * Direction, in the caller's language. It names the frame and hands the shot
 * the brief's own line — it does not invent a product, a claim or a number.
 */
function direction(role: Shot['role'], segment: string, locale: string): string {
  const line = caption(segment, 14)
  if (locale === 'en') {
    if (role === 'hook') return `Open on the problem, straight to camera: "${line}"`
    if (role === 'cta') return `Close on the offer and the call to action: "${line}"`
    return `Show what this means — "${line}"`
  }
  if (role === 'hook') return `نمای باز، رو به دوربین، روی همان مسئله: «${line}»`
  if (role === 'cta') return `نمای پایانی روی پیشنهاد و دعوت به اقدام: «${line}»`
  return `همین را نشان بده — «${line}»`
}

/**
 * Pure. Splits the brief into shots, gives the first the hook and the last the
 * call to action, and times each one from how much text it has to carry.
 */
export function storyboardFromBrief(
  brief: string,
  options: { locale?: string; style?: string } = {},
): Storyboard {
  const locale = options.locale === 'en' ? 'en' : 'fa'
  const style = options.style?.trim() || null

  let segments = splitSpeakable(brief, 18)
  // A single-sentence brief is still a brief; pace it across shots instead of
  // holding one frame for the whole ad.
  if (segments.length === 1) segments = chunk(segments[0]!, WORDS_PER_FALLBACK_SHOT)

  if (segments.length > MAX_SHOTS) {
    const tail = segments.slice(MAX_SHOTS - 1).join(' ')
    segments = [...segments.slice(0, MAX_SHOTS - 1), tail]
  }

  const shots: Shot[] = segments.map((segment, at) => {
    const role: Shot['role'] =
      at === 0 ? 'hook' : at === segments.length - 1 && segments.length > 1 ? 'cta' : 'beat'
    const text = caption(segment)
    return {
      // The shot number is a field, not prose: the client renders it with the
      // Persian digits the rest of the app uses.
      index: at + 1,
      role,
      onScreen: direction(role, segment, locale),
      caption: text,
      seconds: clampSeconds(countWords(text) / READING_WORDS_PER_SECOND + 1.2),
    }
  })

  return {
    shots,
    durationSec: round1(shots.reduce((total, shot) => total + shot.seconds, 0)),
    style,
  }
}

export const briefOnlyVideo: AdVideoAdapter = {
  name: 'brief-only',
  live: false,

  async render(input: AdVideoInput) {
    const storyboard = storyboardFromBrief(input.brief, { locale: input.locale, style: input.style })
    if (storyboard.shots.length === 0) {
      return { status: 'failed' as const, reason: 'brief:empty' }
    }
    return { status: 'storyboarded' as const, durationSec: storyboard.durationSec, storyboard }
  },
}
