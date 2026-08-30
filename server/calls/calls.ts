import * as q from '../db/queries.ts'
import { publish } from '../events.ts'
import { ai, channelFor, voice } from '../adapters/registry.ts'
import { bookMeeting as markMeetingBooked } from '../service.ts'
import {
  composeBrief,
  DEFAULT_HOURS,
  DEFAULT_REMINDER_OFFSETS,
  DEFAULT_SLOT_MINUTES,
  MINUTE_MS,
  nextFreeSlots,
  reminderTimes,
  slotProblem,
  type CallBrief,
  type Interval,
  type Slot,
  type SlotProblem,
  type WorkingHours,
} from '../domain/booking.ts'
import type { Lead, LeadEventType } from '../types.ts'

/**
 * The sales call, end to end: write the brief, place (or prepare) the call,
 * hold the meeting on a calendar, remind the lead before it, and ask a
 * delivered customer for a referral exactly once.
 *
 * The knobs are read from `process.env` at call time rather than from
 * `env.ts` — this module cannot extend that file, and reading late is also what
 * lets a test change the working day between cases.
 */

const number = (name: string, fallback: number) => {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/** `HH:MM` in the owner's local time, as minutes from local midnight. */
const clock = (name: string, fallback: number) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(process.env[name] ?? '')
  if (!match) return fallback
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes >= 0 && minutes <= 1440 ? minutes : fallback
}

export const slotMinutes = () => Math.round(number('CALL_SLOT_MINUTES', DEFAULT_SLOT_MINUTES))

export function callHours(): WorkingHours {
  const offset = Number(process.env.CALL_UTC_OFFSET_MINUTES)
  return {
    ...DEFAULT_HOURS,
    startMinute: clock('CALL_HOURS_START', DEFAULT_HOURS.startMinute),
    endMinute: clock('CALL_HOURS_END', DEFAULT_HOURS.endMinute),
    offsetMinutes: Number.isFinite(offset) ? offset : DEFAULT_HOURS.offsetMinutes,
  }
}

const reminderOffsets = (): number[] => {
  const raw = (process.env.CALL_REMINDER_OFFSETS ?? '').split(',').map((part) => Number(part.trim()))
  const valid = raw.filter((value) => Number.isFinite(value) && value > 0)
  return valid.length ? valid : DEFAULT_REMINDER_OFFSETS
}

const referralAskDays = () => number('REFERRAL_ASK_DAYS', 7)

const localeOf = (lead: Lead): 'fa' | 'en' => (lead.locale === 'en' ? 'en' : 'fa')

const faDigits = (value: string) => value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])

/** The meeting in the owner's working timezone, which is the one both sides agreed. */
function localTime(startIso: string, locale: 'fa' | 'en'): string {
  const hours = callHours()
  const shifted = new Date(Date.parse(startIso) + hours.offsetMinutes * MINUTE_MS)
  const stamp = shifted.toISOString()
  const text = `${stamp.slice(0, 10)} ${stamp.slice(11, 16)}`
  return locale === 'en' ? text : faDigits(text)
}

const asInterval = (booking: { start_at: string; minutes: number }): Interval => ({
  start: new Date(booking.start_at),
  minutes: booking.minutes,
})

// ── slots and the meeting ────────────────────────────────────────────────

/** The next free slots inside `days`, capped so one request cannot walk a year. */
export function freeSlots(days = 7, now = new Date()): Slot[] {
  const horizonDays = Math.min(60, Math.max(1, Math.round(days)))
  const minutes = slotMinutes()
  const hours = callHours()
  const perDay = Math.max(1, Math.floor((hours.endMinute - hours.startMinute) / minutes))
  return nextFreeSlots({
    from: now,
    count: Math.min(60, horizonDays * perDay),
    horizonDays,
    hours,
    slotMinutes: minutes,
    taken: q.bookingsFrom(now).map(asInterval),
  })
}

export type BookResult =
  | { ok: true; booking: q.Booking; reminders: string[] }
  | { ok: false; code: SlotProblem | 'unknown_lead' }

/**
 * Books the meeting, then schedules its reminders. The lead's stage and the
 * `call_booked` event go through the existing service call, so the canvas edge
 * lights up the same way a manual booking does.
 */
export function bookMeeting(leadId: number, slotStartIso: string, now = new Date()): BookResult {
  const lead = q.getLead(leadId)
  if (!lead) return { ok: false, code: 'unknown_lead' }

  const start = new Date(slotStartIso)
  const minutes = slotMinutes()
  const problem = slotProblem({
    start,
    now,
    minutes,
    hours: callHours(),
    taken: q.bookingsFrom(now).map(asInterval),
  })
  if (problem) return { ok: false, code: problem }

  const booking = q.createBooking(leadId, start, minutes)

  // A reminder whose moment has already passed would fire the instant it was
  // written, so a meeting booked inside the window simply gets fewer of them.
  const reminders = reminderTimes(start, reminderOffsets()).filter((due) => due.getTime() > now.getTime())
  for (const due of reminders) q.scheduleReminder(booking.id, due)

  markMeetingBooked(leadId)
  return { ok: true, booking, reminders: reminders.map((due) => due.toISOString()) }
}

// ── the call brief ───────────────────────────────────────────────────────

const briefInput = (lead: Lead) => ({
  lead,
  business: q.getBusiness(),
  events: q.leadEvents(lead.id).map((event) => ({ type: event.type as LeadEventType, at: event.at })),
  recentMessages: q.leadMessages(lead.id).map((message) => ({ direction: message.direction, body: message.body })),
  locale: localeOf(lead),
})

/**
 * Writes the brief, hands it to the voice adapter and records what happened.
 * The brief is stored either way: with no voice credentials the call is
 * `simulated` and the owner dials it themselves, which is still real work.
 */
export async function prepareCall(
  leadId: number,
  now = new Date(),
): Promise<{ lead: Lead; brief: CallBrief; call: q.CallRecord } | null> {
  const lead = q.getLead(leadId)
  if (!lead) return null

  const input = briefInput(lead)
  let brief: CallBrief
  try {
    brief = await ai().callBrief(input)
  } catch (error) {
    // The adapters fall back on their own; this is the belt for a thrown one.
    console.warn('[calls] brief fell back to the composed one:', (error as Error).message)
    brief = composeBrief(input, now)
  }

  const adapter = voice()
  const upcoming = q.bookingsFrom(now).find((booking) => booking.lead_id === leadId)

  let result: { status: 'dialled' | 'simulated' | 'failed'; externalId?: string }
  try {
    result = await adapter.placeCall({ lead, brief, slotStart: upcoming?.start_at ?? null })
  } catch (error) {
    console.warn('[calls] voice adapter threw:', (error as Error).message)
    result = { status: 'failed' }
  }

  const call = q.recordCall({
    leadId,
    provider: adapter.name,
    status: result.status,
    externalId: result.externalId ?? null,
    brief,
  })
  publish({ type: 'call.prepared', leadId, nodeId: 'vapi' })
  return { lead, brief, call }
}

// ── the worker passes ────────────────────────────────────────────────────

const REMINDER_COPY = {
  fa: (when: string, name: string) =>
    `${name} عزیز، یادآوری جلسه‌ی ما: ${when} به وقت ایران. اگر زمان دیگری بهتر است همین‌جا بنویسید تا جابه‌جا کنیم.`,
  en: (when: string, name: string) =>
    `Hi ${name}, a reminder about our call: ${when} Tehran time. If another time works better, reply here and we will move it.`,
}

export const dueReminders = (now = new Date()) => q.dueCallReminders(now)

/** One worker pass over the reminders. Never throws; a failed send is recorded. */
export async function sendDueReminders(now = new Date()): Promise<number> {
  let sent = 0

  for (const reminder of dueReminders(now)) {
    try {
      const lead = q.getLead(reminder.lead_id)
      if (!lead) {
        q.markReminderSent(reminder.id, 'cancelled')
        continue
      }

      const locale = localeOf(lead)
      const name = lead.name?.trim() || lead.handle?.trim() || (locale === 'en' ? 'there' : 'دوست من')
      const body = REMINDER_COPY[locale](localTime(reminder.start_at, locale), name)
      const result = await channelFor(lead.source).send(lead, body)

      q.addMessage({
        lead_id: lead.id,
        channel: lead.source,
        direction: 'out',
        body,
        status: result.status,
        external_id: result.externalId ?? null,
      })
      q.addEvent(lead.id, 'message_out', { kind: 'call_reminder', bookingId: reminder.booking_id })
      q.markReminderSent(reminder.id)
      publish({ type: 'call.reminded', leadId: lead.id, nodeId: 'salescall' })
      sent += 1
    } catch (error) {
      // The pass must survive one bad reminder, so this one is left pending.
      console.warn(`[calls] reminder ${reminder.id} failed:`, (error as Error).message)
    }
  }

  return sent
}

const REFERRAL_COPY = {
  fa: (name: string, business: string, link: string) =>
    `${name} عزیز، امیدوارم ${business} برایتان خوب کار کرده باشد. دو خواهش کوچک: یک جمله بنویسید که چه چیزی برایتان عوض شد، و اگر کسی را می‌شناسید که همین مشکل را دارد، ما را معرفی کنید.${link}`,
  en: (name: string, business: string, link: string) =>
    `Hi ${name}, hope ${business} has been working out. Two small asks: one sentence on what changed for you, and if you know someone with the same problem, send them my way.${link}`,
}

/** Delivered customers past the waiting period who have never been asked. */
export const dueReferralAsks = (now = new Date()) =>
  q.leadsAwaitingReferralAsk(new Date(now.getTime() - referralAskDays() * 24 * 60 * MINUTE_MS))

/**
 * The other worker pass, and what makes the referral node autonomous. The ask
 * is claimed before it is sent, so running this twice — or a hundred times —
 * still asks each customer exactly once.
 */
export async function sendDueReferralAsks(now = new Date()): Promise<number> {
  const business = q.getBusiness()
  let sent = 0

  for (const lead of dueReferralAsks(now)) {
    if (!q.claimReferralAsk(lead.id)) continue

    try {
      const locale = localeOf(lead)
      const name = lead.name?.trim() || lead.handle?.trim() || (locale === 'en' ? 'there' : 'دوست من')
      const who = business.name.trim() || (locale === 'en' ? 'the work we did' : 'کاری که برایتان کردیم')
      const link = business.ctaUrl ? (locale === 'en' ? ` ${business.ctaUrl}` : ` ${business.ctaUrl}`) : ''
      const body = REFERRAL_COPY[locale](name, who, link)
      const result = await channelFor(lead.source).send(lead, body)

      q.addMessage({
        lead_id: lead.id,
        channel: lead.source,
        direction: 'out',
        body,
        status: result.status,
        external_id: result.externalId ?? null,
      })
      q.addEvent(lead.id, 'message_out', { kind: 'referral_ask' })
      q.setReferralAskStatus(lead.id, result.status)
      // Asking is not being referred: the `referred` event stays for the day a
      // customer actually sends someone, so the node's number is never invented.
      publish({ type: 'referral.asked', leadId: lead.id, nodeId: 'referral' })
      sent += 1
    } catch (error) {
      console.warn(`[calls] referral ask for lead ${lead.id} failed:`, (error as Error).message)
      q.setReferralAskStatus(lead.id, 'failed')
    }
  }

  return sent
}

/** Both passes, for the worker and for `POST /api/calls/run-due`. */
export async function runDueCallWork(now = new Date()): Promise<{ reminders: number; referrals: number }> {
  return { reminders: await sendDueReminders(now), referrals: await sendDueReferralAsks(now) }
}
