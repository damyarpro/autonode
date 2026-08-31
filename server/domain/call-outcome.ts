/**
 * What the voice provider says happened on an outbound call, and what that
 * means for the lead.
 *
 * UNVERIFIED: there is no Vapi account in this repository, so this parser has
 * never seen a live payload. It is written to the documented
 * `end-of-call-report` server message and it is deliberately strict — a shape
 * it does not recognise becomes `unknown`, never a completed call, and the
 * caller stores the payload whole so a wrong guess here is recoverable rather
 * than a lie in the funnel. Everything a provider could rename (the message
 * type, the duration field, where the recording hangs) is read defensively.
 */

export const CALL_OUTCOME_STATUSES = ['completed', 'no_answer', 'voicemail', 'failed', 'unknown'] as const
export type CallOutcomeStatus = (typeof CALL_OUTCOME_STATUSES)[number]

/** Vapi's message type for the report that arrives once the call is over. */
export const END_OF_CALL_REPORT = 'end-of-call-report'

/**
 * Under this, two people did not have a conversation — a hello and a hang-up,
 * or an IVR that picked up and stopped. A sales call that qualifies anyone
 * runs longer than half a minute.
 */
export const DEFAULT_MIN_CONVERSATION_SECONDS = 30

export type CallOutcome = {
  /** The provider's message type, when it sent one. */
  kind: string | null
  /** Whether this payload is the end-of-call report and not a live update. */
  isReport: boolean
  /** The provider's call id, matched against `calls.external_id`. */
  externalId: string | null
  status: CallOutcomeStatus
  seconds: number | null
  endedReason: string | null
  recordingUrl: string | null
  transcript: string | null
  summary: string | null
  /** True only when the report's ended reason mapped onto a status we know. */
  recognised: boolean
}

/**
 * The ended reasons that mean the two of them actually spoke. Membership, not
 * a substring match: `assistant-ended-call` and `pipeline-error-…` differ by
 * meaning, not by spelling, and guessing the second into the first would write
 * a conversation that never happened.
 */
const ANSWERED = new Set([
  'customer-ended-call',
  'assistant-ended-call',
  'assistant-said-end-call-phrase',
  'assistant-forwarded-call',
  'assistant-ended-call-with-hangup-task',
  'exceeded-max-duration',
])

/**
 * Nobody was on the other end. `silence-timed-out` belongs here rather than
 * with the answered calls: the line opened and no one ever spoke, which is a
 * call that did not happen.
 */
const NOT_ANSWERED = new Set([
  'customer-did-not-answer',
  'customer-busy',
  'customer-did-not-give-microphone-permission',
  'twilio-failed-to-connect-call',
  'silence-timed-out',
])

/** Our side, the provider or the carrier broke. Matched loosely on purpose: the
 *  error family is long, versioned and keeps growing, and every member of it
 *  means the same thing for the lead — nothing to record. */
const BROKEN = /error|failed|cancel/i

function statusFor(endedReason: string | null): CallOutcomeStatus {
  if (!endedReason) return 'unknown'
  const reason = endedReason.toLowerCase()
  if (reason.includes('voicemail')) return 'voicemail'
  if (ANSWERED.has(reason)) return 'completed'
  if (NOT_ANSWERED.has(reason)) return 'no_answer'
  if (BROKEN.test(reason)) return 'failed'
  return 'unknown'
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** A duration is a non-negative number; anything else is no duration at all. */
const seconds = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 1000) / 1000
}

const spanSeconds = (from: unknown, to: unknown): number | null => {
  const start = Date.parse(typeof from === 'string' ? from : '')
  const end = Date.parse(typeof to === 'string' ? to : '')
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return seconds((end - start) / 1000)
}

const first = <T>(...values: (T | null)[]): T | null => values.find((value) => value !== null) ?? null

export type ParseOptions = {
  /** The message type that carries the report, in case the provider renames it. */
  reportType?: string
}

/**
 * Reads a provider payload into an outcome. Never throws: an empty body, a
 * string, an array or a shape from a future API version all come back as an
 * unrecognised outcome rather than an exception or an invented success.
 */
export function parseCallOutcome(payload: unknown, options: ParseOptions = {}): CallOutcome {
  const reportType = options.reportType?.trim() || END_OF_CALL_REPORT
  const envelope = record(payload) ?? {}
  // Vapi wraps its server messages in `message`; older examples and some
  // replays post the report flat, so both are accepted.
  const body = record(envelope.message) ?? envelope
  const artifact = record(body.artifact) ?? {}
  const analysis = record(body.analysis) ?? {}
  const call = record(body.call) ?? record(envelope.call) ?? {}

  const kind = text(body.type)
  const endedReason = first(text(body.endedReason), text(body.ended_reason), text(call.endedReason))

  const duration = first(
    seconds(body.durationSeconds),
    seconds(body.duration_seconds),
    seconds(typeof body.durationMs === 'number' ? body.durationMs / 1000 : null),
    spanSeconds(body.startedAt, body.endedAt),
    seconds(call.durationSeconds),
  )

  const externalId = first(text(call.id), text(body.callId), text(body.call_id))

  // A payload with no message type but an ended reason is still a report — that
  // is the flat shape. Anything else with a type we were not told to read (a
  // transcript, a status update, a hang) is left alone.
  const isReport = kind === null ? endedReason !== null : kind === reportType

  const status = isReport ? statusFor(endedReason) : 'unknown'

  return {
    kind,
    isReport,
    externalId,
    status,
    seconds: isReport ? duration : null,
    endedReason,
    recordingUrl: first(text(body.recordingUrl), text(artifact.recordingUrl), text(body.stereoRecordingUrl)),
    transcript: first(text(body.transcript), text(artifact.transcript)),
    summary: first(text(body.summary), text(analysis.summary)),
    recognised: isReport && status !== 'unknown',
  }
}

export const CALL_CONSEQUENCE_REASONS = [
  'answered',
  'too_short',
  'not_answered',
  'voicemail',
  'failed',
  'unrecognised',
] as const
export type CallConsequenceReason = (typeof CALL_CONSEQUENCE_REASONS)[number]

/** `event` is a `LeadEventType` from server/types.ts, or nothing to record. */
export type CallConsequence = {
  event: 'call_completed' | null
  reason: CallConsequenceReason
}

/**
 * What the outcome means for the lead. Only a call that the provider says
 * ended between two people, and lasted long enough to be a conversation, is a
 * `call_completed` event. A voicemail, a missed call, a broken one and a
 * payload we could not read all leave the lead exactly where it was — the
 * outcome is still recorded, it just does not move anybody down the funnel.
 */
export function callConsequence(
  outcome: CallOutcome,
  minSeconds: number = DEFAULT_MIN_CONVERSATION_SECONDS,
): CallConsequence {
  switch (outcome.status) {
    case 'voicemail':
      return { event: null, reason: 'voicemail' }
    case 'no_answer':
      return { event: null, reason: 'not_answered' }
    case 'failed':
      return { event: null, reason: 'failed' }
    case 'unknown':
      return { event: null, reason: 'unrecognised' }
    case 'completed':
      // A report with no duration cannot show a conversation happened, so it
      // is treated as the short call it might have been.
      if (outcome.seconds === null || outcome.seconds < minSeconds) return { event: null, reason: 'too_short' }
      return { event: 'call_completed', reason: 'answered' }
  }
}
