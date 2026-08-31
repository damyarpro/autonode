import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  callConsequence,
  DEFAULT_MIN_CONVERSATION_SECONDS,
  END_OF_CALL_REPORT,
  parseCallOutcome,
} from './call-outcome.ts'

/** The documented end-of-call report, trimmed to the fields this parser reads. */
const report = (message: Record<string, unknown>) => ({
  message: { type: END_OF_CALL_REPORT, call: { id: 'call_abc' }, ...message },
})

test('a completed call is read whole and moves the lead', () => {
  const outcome = parseCallOutcome(
    report({
      endedReason: 'customer-ended-call',
      durationSeconds: 214.5,
      recordingUrl: 'https://example.invalid/r.mp3',
      transcript: 'AI: سلام...',
      analysis: { summary: 'Agreed to a demo on Sunday.' },
    }),
  )

  assert.equal(outcome.isReport, true)
  assert.equal(outcome.recognised, true)
  assert.equal(outcome.status, 'completed')
  assert.equal(outcome.externalId, 'call_abc')
  assert.equal(outcome.seconds, 214.5)
  assert.equal(outcome.endedReason, 'customer-ended-call')
  assert.equal(outcome.recordingUrl, 'https://example.invalid/r.mp3')
  assert.equal(outcome.summary, 'Agreed to a demo on Sunday.')

  assert.deepEqual(callConsequence(outcome), { event: 'call_completed', reason: 'answered' })
})

test('the duration is taken from whichever field the provider sent', () => {
  assert.equal(parseCallOutcome(report({ endedReason: 'customer-ended-call', durationMs: 90_000 })).seconds, 90)

  const spanned = parseCallOutcome(
    report({
      endedReason: 'assistant-ended-call',
      startedAt: '2026-08-30T09:00:00.000Z',
      endedAt: '2026-08-30T09:02:30.000Z',
    }),
  )
  assert.equal(spanned.seconds, 150)

  // A negative or unparseable duration is no duration, not a zero-second call.
  assert.equal(parseCallOutcome(report({ endedReason: 'customer-ended-call', durationSeconds: -4 })).seconds, null)
})

test('a call nobody answered is recorded and advances nothing', () => {
  const outcome = parseCallOutcome(report({ endedReason: 'customer-did-not-answer', durationSeconds: 0 }))

  assert.equal(outcome.status, 'no_answer')
  assert.equal(outcome.recognised, true)
  assert.deepEqual(callConsequence(outcome), { event: null, reason: 'not_answered' })

  // Silence on an open line is not a conversation either.
  assert.equal(parseCallOutcome(report({ endedReason: 'silence-timed-out', durationSeconds: 45 })).status, 'no_answer')
})

test('voicemail is its own outcome, however long the message ran', () => {
  const outcome = parseCallOutcome(report({ endedReason: 'voicemail', durationSeconds: 120 }))

  assert.equal(outcome.status, 'voicemail')
  assert.deepEqual(callConsequence(outcome), { event: null, reason: 'voicemail' })
})

test('a two-second hang-up is a completed call and still not a conversation', () => {
  const outcome = parseCallOutcome(report({ endedReason: 'customer-ended-call', durationSeconds: 2 }))

  assert.equal(outcome.status, 'completed', 'the provider says it completed, so that is what we store')
  assert.deepEqual(callConsequence(outcome), { event: null, reason: 'too_short' })

  // The threshold is a knob, so the same payload can qualify on a shorter one.
  assert.deepEqual(callConsequence(outcome, 1), { event: 'call_completed', reason: 'answered' })
  assert.ok(DEFAULT_MIN_CONVERSATION_SECONDS > 2)

  // A completed call with no duration at all cannot prove a conversation.
  const undated = parseCallOutcome(report({ endedReason: 'customer-ended-call' }))
  assert.deepEqual(callConsequence(undated), { event: null, reason: 'too_short' })
})

test('a broken call is failed, not completed', () => {
  for (const reason of ['pipeline-error-openai-llm-failed', 'twilio-failed-to-connect-call', 'unknown-error']) {
    const outcome = parseCallOutcome(report({ endedReason: reason, durationSeconds: 300 }))
    assert.notEqual(outcome.status, 'completed', `${reason} must never read as a conversation`)
    assert.equal(callConsequence(outcome).event, null)
  }
})

test('an unrecognised ended reason is unknown rather than a happy guess', () => {
  const outcome = parseCallOutcome(
    report({ endedReason: 'some-reason-invented-in-2027', durationSeconds: 300, mood: 'excellent' }),
  )

  assert.equal(outcome.status, 'unknown')
  assert.equal(outcome.recognised, false, 'the caller stores the raw payload when this is false')
  assert.equal(outcome.endedReason, 'some-reason-invented-in-2027', 'what it did say is kept verbatim')
  assert.deepEqual(callConsequence(outcome), { event: null, reason: 'unrecognised' })
})

test('an empty or malformed payload never throws and never completes a call', () => {
  for (const payload of [{}, null, undefined, 'end-of-call-report', [], { message: 42 }]) {
    const outcome = parseCallOutcome(payload)
    assert.equal(outcome.status, 'unknown')
    assert.equal(outcome.isReport, false)
    assert.equal(outcome.externalId, null)
    assert.equal(outcome.seconds, null)
    assert.equal(callConsequence(outcome).event, null)
  }
})

test('a live message that is not the end-of-call report is left alone', () => {
  const outcome = parseCallOutcome({
    message: { type: 'transcript', call: { id: 'call_abc' }, transcript: 'hello', endedReason: 'customer-ended-call' },
  })

  assert.equal(outcome.isReport, false, 'a mid-call message must not be read as an outcome')
  assert.equal(outcome.status, 'unknown')
  assert.equal(outcome.seconds, null)

  // The type the report arrives under is configurable, for the day it moves.
  const renamed = parseCallOutcome(
    { message: { type: 'call.ended', call: { id: 'call_abc' }, endedReason: 'customer-ended-call', durationSeconds: 90 } },
    { reportType: 'call.ended' },
  )
  assert.equal(renamed.isReport, true)
  assert.equal(renamed.status, 'completed')
})

test('a flat payload with no message envelope is still read', () => {
  const outcome = parseCallOutcome({
    call_id: 'call_flat',
    endedReason: 'assistant-ended-call',
    durationSeconds: 61,
    artifact: { recordingUrl: 'https://example.invalid/flat.mp3', transcript: 'AI: ...' },
  })

  assert.equal(outcome.isReport, true)
  assert.equal(outcome.externalId, 'call_flat')
  assert.equal(outcome.status, 'completed')
  assert.equal(outcome.recordingUrl, 'https://example.invalid/flat.mp3')
  assert.equal(outcome.transcript, 'AI: ...')
  assert.deepEqual(callConsequence(outcome), { event: 'call_completed', reason: 'answered' })
})
