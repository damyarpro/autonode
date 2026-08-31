import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  composeBrief,
  DEFAULT_HOURS,
  endOf,
  MINUTE_MS,
  nextFreeSlots,
  overlaps,
  reminderTimes,
  slotProblem,
  withinHours,
  type CallBriefInput,
  type WorkingHours,
} from './booking.ts'
import { emptyBusiness } from './business.ts'
import type { Lead, LeadEventType } from '../types.ts'

/** UTC office hours, so every expectation below reads straight off the clock. */
const HOURS: WorkingHours = {
  days: [1, 2, 3, 4, 5],
  startMinute: 9 * 60,
  endMinute: 17 * 60,
  offsetMinutes: 0,
}

const SLOT = 30
// A Tuesday, 08:00 UTC — an hour before the office opens.
const TUESDAY = new Date('2026-09-01T08:00:00Z')

const slots = (from: Date, count: number, taken: { start: Date; minutes: number }[] = []) =>
  nextFreeSlots({ from, count, taken, hours: HOURS, slotMinutes: SLOT })

test('slots start when the day opens, are evenly spaced and stay inside the window', () => {
  const found = slots(TUESDAY, 16)

  assert.equal(found.length, 16)
  assert.equal(found[0].start.toISOString(), '2026-09-01T09:00:00.000Z')
  assert.equal(found[0].end.toISOString(), '2026-09-01T09:30:00.000Z')
  for (let i = 1; i < found.length; i += 1) {
    assert.equal(found[i].start.getTime() - found[i - 1].start.getTime(), SLOT * MINUTE_MS)
  }
  // Sixteen half-hours is exactly the 09:00–17:00 window, and the last one ends on it.
  assert.equal(found.at(-1)!.end.toISOString(), '2026-09-01T17:00:00.000Z')
  for (const slot of found) assert.ok(withinHours(slot.start, SLOT, HOURS))
})

test('no slot is ever in the past, and a mid-day request resumes on the boundary', () => {
  const midday = new Date('2026-09-01T11:12:00Z')
  const found = slots(midday, 4)

  assert.equal(found[0].start.toISOString(), '2026-09-01T11:30:00.000Z')
  for (const slot of found) assert.ok(slot.start.getTime() >= midday.getTime())
})

test('a slot that overlaps a booking is skipped, one that only touches it is not', () => {
  const taken = [{ start: new Date('2026-09-01T09:30:00Z'), minutes: 45 }]
  const found = slots(TUESDAY, 4, taken)

  assert.deepEqual(
    found.map((slot) => slot.start.toISOString()),
    [
      '2026-09-01T09:00:00.000Z',
      // 09:30 and 10:00 both overlap the 45-minute booking.
      '2026-09-01T10:30:00.000Z',
      '2026-09-01T11:00:00.000Z',
      '2026-09-01T11:30:00.000Z',
    ],
  )
  assert.equal(overlaps({ start: new Date('2026-09-01T09:00:00Z'), minutes: 30 }, taken[0]), false)
  assert.equal(overlaps({ start: new Date('2026-09-01T09:15:00Z'), minutes: 30 }, taken[0]), true)
})

test('the search crosses the day boundary and skips days that are not working days', () => {
  // 16:45 on Friday: one slot left today, then the weekend, then Monday.
  const fridayEvening = new Date('2026-09-04T16:45:00Z')
  const found = slots(fridayEvening, 3)

  assert.deepEqual(
    found.map((slot) => slot.start.toISOString()),
    ['2026-09-07T09:00:00.000Z', '2026-09-07T09:30:00.000Z', '2026-09-07T10:00:00.000Z'],
  )
})

test('the offset moves the working day without moving the stored instant', () => {
  const tehran: WorkingHours = { ...HOURS, offsetMinutes: 210 }
  const [first] = nextFreeSlots({
    from: new Date('2026-09-01T00:00:00Z'),
    count: 1,
    hours: tehran,
    slotMinutes: SLOT,
  })
  // 09:00 in a +03:30 zone is 05:30 UTC, and that is what gets stored.
  assert.equal(first.start.toISOString(), '2026-09-01T05:30:00.000Z')
  assert.equal(withinHours(first.start, SLOT, tehran), true)
  assert.equal(withinHours(first.start, SLOT, HOURS), false)
})

test('a horizon with no working day in it returns nothing rather than looping', () => {
  const saturday = new Date('2026-09-05T09:00:00Z')
  assert.deepEqual(nextFreeSlots({ from: saturday, count: 5, hours: HOURS, slotMinutes: SLOT, horizonDays: 2 }), [])
  assert.deepEqual(nextFreeSlots({ from: TUESDAY, count: 0, hours: HOURS, slotMinutes: SLOT }), [])
  // A slot longer than the working day can never fit.
  assert.deepEqual(nextFreeSlots({ from: TUESDAY, count: 1, hours: HOURS, slotMinutes: 600 }), [])
})

test('a slot is refused when it is past, outside the day, or already taken', () => {
  const now = new Date('2026-09-01T10:00:00Z')
  const taken = [{ start: new Date('2026-09-01T14:00:00Z'), minutes: SLOT }]
  const check = (iso: string) =>
    slotProblem({ start: new Date(iso), now, minutes: SLOT, hours: HOURS, taken })

  assert.equal(check('2026-09-01T09:00:00Z'), 'past')
  assert.equal(check('2026-09-01T18:00:00Z'), 'outside_hours')
  assert.equal(check('2026-09-05T10:00:00Z'), 'outside_hours')
  assert.equal(check('2026-09-01T16:45:00Z'), 'outside_hours')
  assert.equal(check('2026-09-01T14:15:00Z'), 'taken')
  assert.equal(check('2026-09-01T14:30:00Z'), null)
  assert.equal(slotProblem({ start: new Date('nonsense'), now, hours: HOURS }), 'not_a_time')
})

test('reminders are due the given number of minutes before the meeting', () => {
  const start = new Date('2026-09-01T14:00:00Z')

  assert.deepEqual(
    reminderTimes(start, [1440, 60]).map((due) => due.toISOString()),
    ['2026-08-31T14:00:00.000Z', '2026-09-01T13:00:00.000Z'],
  )
  assert.equal(endOf({ start, minutes: 30 }).toISOString(), '2026-09-01T14:30:00.000Z')
  // Duplicates collapse and anything at or after the start is dropped.
  assert.deepEqual(
    reminderTimes(start, [60, 60, 0, -30, Number.NaN]).map((due) => due.toISOString()),
    ['2026-09-01T13:00:00.000Z'],
  )
  assert.deepEqual(reminderTimes(start, []), [])
})

test('the default working day is Tehran, Saturday to Wednesday', () => {
  assert.equal(DEFAULT_HOURS.offsetMinutes, 210)
  // Thursday and Friday are not bookable.
  assert.equal(withinHours(new Date('2026-09-03T08:00:00Z'), 30, DEFAULT_HOURS), false)
  assert.equal(withinHours(new Date('2026-09-01T08:00:00Z'), 30, DEFAULT_HOURS), true)
})

// ── the brief ────────────────────────────────────────────────────────────

const lead = (patch: Partial<Lead> = {}): Lead => ({
  id: 1,
  source: 'instagram',
  external_id: 'ig-1',
  handle: 'sara',
  name: 'سارا',
  locale: 'fa',
  score: 40,
  route: 'warm',
  stage: 'engaged',
  owner: null,
  value_toman: 0,
  created_at: '2026-08-20 09:00:00',
  updated_at: '2026-08-20 09:00:00',
  ...patch,
})

const briefFor = (events: LeadEventType[], patch: Partial<Lead> = {}, locale: 'fa' | 'en' = 'fa'): CallBriefInput => ({
  lead: lead(patch),
  business: { ...emptyBusiness(), name: 'استودیو نور', whatWeSell: 'ویدیوی تبلیغاتی', audience: 'فروشگاه‌ها', priceToman: 12_000_000 },
  events: events.map((type, index) => ({ type, at: `2026-08-2${index} 09:00:00` })),
  recentMessages: [],
  locale,
})

const NOW = new Date('2026-08-30T09:00:00Z')

test('the brief always has an opening, exactly two objections and one ask', () => {
  for (const events of [[], ['captured'], ['captured', 'reply', 'call_booked']] as LeadEventType[][]) {
    const brief = composeBrief(briefFor(events), NOW)
    assert.ok(brief.opening.trim().length > 0)
    assert.equal(brief.objections.length, 2)
    for (const entry of brief.objections) {
      assert.ok(entry.objection.trim().length > 0)
      assert.ok(entry.answer.trim().length > 0)
    }
    assert.ok(brief.ask.trim().length > 0)
    assert.equal(brief.producedBy, 'template')
  }
})

test('the objections come from this lead history and change with it', () => {
  const abandoned = composeBrief(briefFor(['captured', 'reply', 'checkout_started']), NOW)
  const noShow = composeBrief(briefFor(['captured', 'reply', 'call_booked']), NOW)
  const silent = composeBrief(briefFor(['captured', 'content_view', 'content_view', 'link_click']), NOW)

  assert.notEqual(abandoned.objections[0].objection, noShow.objections[0].objection)
  assert.notEqual(silent.objections[0].objection, noShow.objections[0].objection)
  // The abandoned checkout is asked to finish, not asked for a first meeting.
  assert.match(abandoned.ask, /پرداخت/)
  assert.match(noShow.ask, /۳۰ دقیقه/)
})

test('the opening names the lead and the last thing they actually did', () => {
  const brief = composeBrief(briefFor(['captured', 'link_click']), NOW)
  assert.match(brief.opening, /سارا/)
  assert.match(brief.opening, /اینستاگرام/)
  assert.match(brief.opening, /لینک/)

  const english = composeBrief(briefFor(['captured', 'link_click'], { locale: 'en' }, 'en'), NOW)
  assert.match(english.opening, /Instagram/)
  assert.match(english.opening, /clicked our link/)
  assert.match(english.ask, /30-minute/)
})

test('a delivered customer is asked for feedback and a name, not for a meeting', () => {
  const brief = composeBrief(briefFor(['paid', 'delivered'], { stage: 'delivered' }, 'en'), NOW)
  assert.match(brief.ask, /feedback/)
})
