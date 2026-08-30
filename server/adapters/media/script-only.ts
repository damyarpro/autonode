/**
 * The no-credentials voice adapter, and the default one.
 *
 * It produces no audio, but it does the part of the work a person would
 * otherwise do by hand: it turns the raw script into a finished, speakable
 * one — broken into lines a narrator can read in a breath, each timed from its
 * word count, with a running clock and a total. That is the artefact a voice
 * session is booked against, so the node produces something real with nobody's
 * credit card. The job is marked `scripted`, never `rendered`.
 */
import type { ScriptLine, TimedScript, VoiceoverAdapter, VoiceoverInput } from './types.ts'

/** A comfortable narration pace; ElevenLabs lands near the same number. */
export const WORDS_PER_MINUTE = 150

/** Breath between lines. Without it a read-aloud estimate runs short. */
const BREATH_SEC = 0.35

/** Even a one-word line takes a beat to land. */
const MIN_LINE_SEC = 0.6

/** Longer than this and a narrator runs out of air, so the line is split. */
const MAX_WORDS_PER_LINE = 24

/** Anything with a letter or a digit in it; standalone dashes are not words. */
const HAS_WORD_CHARACTER = /[\p{L}\p{N}]/u

const round1 = (value: number): number => Math.round(value * 10) / 10

const pieces = (text: string): string[] => text.trim().split(/\s+/u).filter((piece) => piece.length > 0)

/**
 * Persian glues parts of one word together with a zero-width non-joiner
 * (می‌روم is one word, not two), and that character is not whitespace — so
 * splitting on whitespace counts it correctly and nothing here special-cases
 * the script's language.
 */
export const countWords = (text: string): number =>
  pieces(text).filter((piece) => HAS_WORD_CHARACTER.test(piece)).length

const hardChunk = (segment: string, maxWords: number): string[] => {
  const words = pieces(segment)
  const chunks: string[] = []
  for (let at = 0; at < words.length; at += maxWords) {
    chunks.push(words.slice(at, at + maxWords).join(' '))
  }
  return chunks
}

/** Greedily regroups clauses so no line runs past the breath budget. */
const breathe = (segment: string, maxWords: number): string[] => {
  if (countWords(segment) <= maxWords) return [segment]

  const lines: string[] = []
  let current = ''
  for (const clause of segment.split(/(?<=[،؛,;:])\s+/u)) {
    const candidate = current ? `${current} ${clause}` : clause
    if (current && countWords(candidate) > maxWords) {
      lines.push(current)
      current = clause
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)

  return lines.flatMap((line) => (countWords(line) > maxWords ? hardChunk(line, maxWords) : [line]))
}

/**
 * Splits prose into speakable lines: the author's own line breaks first, then
 * sentences, then clauses when a sentence is too long to say in one breath.
 * Pure — the storyboard builder uses it too.
 */
export function splitSpeakable(text: string, maxWords = MAX_WORDS_PER_LINE): string[] {
  return text
    .split(/\r?\n+/u)
    .flatMap((line) => line.split(/(?<=[.!?…؟])\s+/u))
    .map((line) => line.trim())
    .filter((line) => countWords(line) > 0)
    .flatMap((line) => breathe(line, maxWords))
}

/** Pure, and the only place a spoken duration is estimated. */
export function timeScript(
  script: string,
  options: { voice?: string | null; wordsPerMinute?: number } = {},
): TimedScript {
  const wordsPerMinute = options.wordsPerMinute && options.wordsPerMinute > 0 ? options.wordsPerMinute : WORDS_PER_MINUTE
  const perSecond = wordsPerMinute / 60

  let startSec = 0
  const lines: ScriptLine[] = splitSpeakable(script).map((text, index) => {
    const words = countWords(text)
    const seconds = round1(Math.max(MIN_LINE_SEC, words / perSecond + BREATH_SEC))
    const line: ScriptLine = { index: index + 1, text, words, seconds, startSec: round1(startSec) }
    startSec += seconds
    return line
  })

  return {
    lines,
    words: lines.reduce((total, line) => total + line.words, 0),
    durationSec: round1(startSec),
    wordsPerMinute,
    voice: options.voice?.trim() || null,
  }
}

export const scriptOnlyVoice: VoiceoverAdapter = {
  name: 'script-only',
  live: false,

  async render(input: VoiceoverInput) {
    const script = timeScript(input.script, { voice: input.voice })
    if (script.lines.length === 0) {
      return { status: 'failed' as const, reason: 'script:empty' }
    }
    return { status: 'scripted' as const, durationSec: script.durationSec, script }
  },
}
