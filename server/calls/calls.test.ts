import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The orchestration, driven against a throwaway database. The environment is
 * prepared before anything under `server/` is imported: `env.ts` reads
 * `process.env` once at module load, so a later assignment is invisible.
 *
 * It is also emptied of credentials on purpose — that is what pins the
 * assertions below to the fallback path: the brief-only voice adapter, template
 * copy, and a store-only channel that reports `simulated`.
 */

const workdir = mkdtempSync(join(tmpdir(), 'autonode-calls-'))
process.env.DB_FILE = join(workdir, 'calls.db')
process.env.SEQUENCE_SPEED = '0'
process.env.WORKER_ENABLED = 'false'
// A UTC working day, so every instant below reads straight off the clock.
process.env.CALL_UTC_OFFSET_MINUTES = '0'
process.env.CALL_HOURS_START = '09:00'
process.env.CALL_HOURS_END = '17:00'
process.env.CALL_SLOT_MINUTES = '30'
process.env.CALL_REMINDER_OFFSETS = '1440,60'
process.env.REFERRAL_ASK_DAYS = '7'
delete process.env.ANTHROPIC_API_KEY
delete process.env.TELEGRAM_BOT_TOKEN
delete process.env.VAPI_API_KEY
delete process.env.VAPI_ASSISTANT_ID

const q = await import('../db/queries.ts')
const { closeDatabase } = await import('../db/index.ts')
const { voice } = await import('../adapters/registry.ts')
const calls = await import('./calls.ts')

after(() => {
  closeDatabase()
  rmSync(workdir, { recursive: true, force: true })
})

/** A Tuesday, an hour before the office opens. */
const NOW = new Date('2026-09-01T08:00:00Z')

let seq = 0
const makeLead = (patch: Partial<{ name: string; handle: string; locale: string }> = {}) => {
  seq += 1
  return q.captureLead({
    source: 'instagram',
    externalId: `calls-test-${seq}`,
    name: 'سارا',
    handle: 'sara',
    locale: 'fa',
    ...patch,
  }).lead
}

test('with no credentials the call is prepared, not dialled, and the brief is stored', async () => {
  const lead = makeLead()
  q.addEvent(lead.id, 'captured')
  q.addEvent(lead.id, 'reply')
  q.addEvent(lead.id, 'checkout_started')

  const prepared = await calls.prepareCall(lead.id, NOW)
  assert.ok(prepared)
  assert.equal(voice().name, 'brief-only')
  assert.equal(voice().live, false)
  assert.equal(prepared.call.provider, 'brief-only')
  assert.equal(prepared.call.status, 'simulated')
  assert.equal(prepared.call.external_id, null)

  // The brief is the work product, and it is built from this lead's own log.
  assert.equal(prepared.brief.producedBy, 'template')
  assert.equal(prepared.brief.objections.length, 2)
  assert.ok(prepared.brief.opening.includes('سارا'))
  assert.ok(prepared.brief.opening.includes('اینستاگرام'))
  for (const entry of prepared.brief.objections) {
    assert.ok(entry.objection.trim().length > 0)
    assert.ok(entry.answer.trim().length > 0)
  }
  // The abandoned checkout is what the ask picks up on.
  assert.match(prepared.brief.ask, /پرداخت/)

  const stored = q.leadCalls(lead.id)
  assert.equal(stored.length, 1)
  assert.deepEqual(stored[0].brief, prepared.brief)
  assert.equal(q.callCounts().calls, 1)
})

test('preparing a call for a lead that does not exist is a null, not a throw', async () => {
  assert.equal(await calls.prepareCall(9_999, NOW), null)
})

test('a booked slot advances the lead and disappears from the free list', () => {
  const lead = makeLead()
  const [first] = calls.freeSlots(3, NOW)
  assert.equal(first.start.toISOString(), '2026-09-01T09:00:00.000Z')

  const booked = calls.bookMeeting(lead.id, first.start.toISOString(), NOW)
  assert.ok(booked.ok)
  assert.equal(booked.booking.minutes, 30)
  assert.equal(booked.booking.status, 'booked')
  assert.equal(q.getLead(lead.id)!.stage, 'meeting')
  assert.equal(
    q.leadEvents(lead.id).filter((event) => event.type === 'call_booked').length,
    1,
    'the meeting is on the lead timeline, the way a manual booking is',
  )

  assert.ok(!calls.freeSlots(3, NOW).some((slot) => slot.start.getTime() === first.start.getTime()))
})

test('a taken, past or unknown booking is refused with a code the client can phrase', () => {
  const lead = makeLead()

  assert.deepEqual(calls.bookMeeting(lead.id, '2026-09-01T09:00:00Z', NOW), { ok: false, code: 'taken' })
  assert.deepEqual(calls.bookMeeting(lead.id, '2026-08-31T09:00:00Z', NOW), { ok: false, code: 'past' })
  assert.deepEqual(calls.bookMeeting(lead.id, '2026-09-01T20:00:00Z', NOW), { ok: false, code: 'outside_hours' })
  assert.deepEqual(calls.bookMeeting(9_999, '2026-09-01T11:00:00Z', NOW), { ok: false, code: 'unknown_lead' })
})

test('reminders are scheduled ahead of the meeting and each one is sent once', async () => {
  const lead = makeLead({ name: 'رضا', handle: 'reza' })
  const start = new Date('2026-09-01T11:00:00Z')

  const booked = calls.bookMeeting(lead.id, start.toISOString(), NOW)
  assert.ok(booked.ok)
  // The day-before reminder is already in the past at NOW, so only the
  // hour-before one is written: a reminder is never scheduled to fire at once.
  assert.deepEqual(booked.reminders, ['2026-09-01T10:00:00.000Z'])

  const tooEarly = new Date('2026-09-01T09:59:00Z')
  assert.equal(calls.dueReminders(tooEarly).length, 0)
  assert.equal(await calls.sendDueReminders(tooEarly), 0)

  const due = new Date('2026-09-01T10:01:00Z')
  assert.equal(calls.dueReminders(due).length, 1)
  assert.equal(await calls.sendDueReminders(due), 1)

  const sent = q.leadMessages(lead.id).filter((message) => message.direction === 'out')
  assert.equal(sent.length, 1)
  assert.equal(sent[0].status, 'simulated')
  assert.match(sent[0].body, /رضا/)
  assert.match(sent[0].body, /۱۱:۰۰/, 'the meeting time is in the local clock and Persian digits')

  // Running the pass again delivers nothing: the reminder is spent.
  assert.equal(await calls.sendDueReminders(due), 0)
  assert.equal(await calls.sendDueReminders(new Date('2026-09-01T10:59:00Z')), 0)
})

test('a customer is asked for a referral exactly once, however often the pass runs', async () => {
  // Anchored to the real clock, because `backdateLead` shifts the event log
  // relative to when SQLite wrote it.
  const now = new Date()
  const customer = makeLead({ name: 'مینا', handle: 'mina' })
  q.updateLead(customer.id, { stage: 'delivered' })
  q.addEvent(customer.id, 'delivered')
  q.backdateLead(customer.id, 30)

  assert.deepEqual(
    calls.dueReferralAsks(now).map((lead) => lead.id),
    [customer.id],
  )
  assert.equal(await calls.sendDueReferralAsks(now), 1)

  for (let pass = 0; pass < 4; pass += 1) {
    assert.equal(await calls.sendDueReferralAsks(now), 0, 'the ask is claimed before it is sent')
  }
  assert.equal(calls.dueReferralAsks(now).length, 0)

  const asks = q.leadMessages(customer.id).filter((message) => message.direction === 'out')
  assert.equal(asks.length, 1)
  assert.match(asks[0].body, /معرفی/)
  assert.match(asks[0].body, /مینا/)
  assert.equal(q.referralAskFor(customer.id)!.status, 'simulated')
  assert.equal(q.callCounts().referralAsks, 1)

  // Asking is not being referred: that event still belongs to the day someone
  // actually sends a name, so the referral node never counts an invented one.
  assert.equal(q.leadEvents(customer.id).filter((event) => event.type === 'referred').length, 0)
})

test('a customer who took delivery today is left alone until the waiting period is up', async () => {
  const now = new Date()
  const fresh = makeLead({ name: 'کاوه', handle: 'kaveh' })
  q.updateLead(fresh.id, { stage: 'delivered' })
  q.addEvent(fresh.id, 'delivered')

  assert.ok(!calls.dueReferralAsks(now).some((lead) => lead.id === fresh.id))
  assert.equal(await calls.sendDueReferralAsks(now), 0)
  assert.equal(q.referralAskFor(fresh.id), undefined)
})

test('one worker call runs both passes and reports what each did', async () => {
  const result = await calls.runDueCallWork(new Date('2026-09-01T10:01:00Z'))
  assert.deepEqual(result, { reminders: 0, referrals: 0 })
})
