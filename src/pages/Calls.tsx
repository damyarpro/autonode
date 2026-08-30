import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PageBanner from '../components/PageBanner'
import { Card, CardHead, PrimaryButton, Row } from '../components/Card'
import Chip from '../components/Chip'
import { Icon } from '../components/Icon'
import { NodeIcon } from '../components/icons'
import { useCalls, type Booking, type CallRecord, type CallSlot } from '../api/useCalls'
import type { ApiLead } from '../api/client'
import { explainCode } from '../i18n/errors'
import { useI18n } from '../i18n/I18nProvider'
import type { Bi, IconKey } from '../data/types'

/**
 * The call desk — the page that drives the `vapi`, `salescall` and `referral`
 * nodes by hand: pick a lead, write the brief, take a slot, and run the due
 * reminders and referral asks now instead of waiting for the worker.
 *
 * What it does not do is dial. With no Vapi key the brief is the whole work
 * product and the owner picks up the phone themselves, which the page says in
 * as many words rather than implying a call was placed (rule 5).
 */

const COPY = {
  title: { fa: 'میز تماس', en: 'Call desk' },
  subtitle: { fa: 'بریف تماس، رزرو جلسه و پیگیری‌ها', en: 'Call briefs, meetings and follow-ups' },
  back: { fa: 'بازگشت به تابلوی فروش', en: 'Back to the sales board' },

  offline: {
    fa: 'API در دسترس نیست، پس این صفحه خالی است و هیچ کاری انجام نمی‌شود.',
    en: 'The API is unreachable, so this page is empty and nothing can be done.',
  },
  retry: { fa: 'تلاش دوباره', en: 'Try again' },
  loading: { fa: 'در حال بارگذاری…', en: 'Loading…' },

  // lead picker
  leadKicker: { fa: 'لید', en: 'Lead' },
  leadTitle: { fa: 'با چه کسی تماس می‌گیری؟', en: 'Who are you calling?' },
  leadSub: { fa: 'هر کاری در این صفحه روی یک لید انجام می‌شود', en: 'Everything here happens on one lead' },
  leadReady: { fa: 'آماده‌ی تماس', en: 'ready to call' },
  leadNone: { fa: 'هنوز لیدی ثبت نشده است.', en: 'No leads yet.' },
  leadPickFirst: { fa: 'اول یک لید انتخاب کن.', en: 'Pick a lead first.' },
  score: { fa: 'امتیاز', en: 'score' },

  // brief
  briefKicker: { fa: 'بریف تماس', en: 'Call brief' },
  briefTitle: { fa: 'چه باید گفت', en: 'What to say' },
  briefSub: { fa: 'از روی رویدادهای همین لید نوشته می‌شود', en: 'Written from this lead’s own history' },
  prepare: { fa: 'نوشتن بریف تماس', en: 'Write the call brief' },
  preparingNow: { fa: 'در حال نوشتن…', en: 'Writing…' },
  opening: { fa: 'شروع مکالمه', en: 'Opening' },
  objections: { fa: 'دو مخالفتی که انتظار می‌رود', en: 'The two objections to expect' },
  answer: { fa: 'پاسخ', en: 'Answer' },
  ask: { fa: 'درخواست پایانی', en: 'The ask' },
  byClaude: { fa: 'نوشته‌ی Claude', en: 'written by Claude' },
  byTemplate: { fa: 'قالب آفلاین', en: 'offline template' },
  voiceAdapter: { fa: 'سرویس صدا', en: 'Voice adapter' },
  notLive: {
    fa: 'این صفحه تماسی برقرار نمی‌کند. بدون کلید Vapi فقط بریف نوشته می‌شود و شماره را خودت می‌گیری؛ تماس در دفتر با وضعیت «شبیه‌سازی‌شده» ثبت می‌شود.',
    en: 'This page does not place a call. With no Vapi key only the brief is written and you dial the number yourself; the call is logged as “simulated”.',
  },
  isLive: {
    fa: 'کلید Vapi تنظیم است، پس شماره‌گیری به همان سرویس سپرده می‌شود. وضعیت واقعی هر تماس در فهرست پایین می‌آید.',
    en: 'A Vapi key is set, so the dialling is handed to that service. Each call’s real status is in the list below.',
  },
  dialUnknown: {
    fa: 'شماره‌گیری به سرویس صدای پیکربندی‌شده بستگی دارد؛ بعد از نوشتن بریف، همین‌جا می‌گوید تماس گرفته شد یا باید خودت بگیری.',
    en: 'Whether anything dials depends on the configured voice adapter; once the brief is written, this line says whether a call was placed or you dial it yourself.',
  },

  // booking
  bookKicker: { fa: 'رزرو جلسه', en: 'Book a meeting' },
  bookTitle: { fa: 'زمان‌های آزاد', en: 'Free slots' },
  bookSub: { fa: 'از تقویم سرور، بدون زمان‌های رزروشده', en: 'From the server’s calendar, minus what is taken' },
  bookConfirm: { fa: 'رزرو این زمان', en: 'Book this time' },
  bookingNow: { fa: 'در حال رزرو…', en: 'Booking…' },
  bookNoSlots: { fa: 'در این بازه زمان آزادی نیست.', en: 'No free slot in this window.' },
  booked: { fa: 'جلسه رزرو شد', en: 'Meeting booked' },
  remindersLabel: { fa: 'یادآوری‌ها', en: 'Reminders' },
  remindersNone: {
    fa: 'زمان یادآوری‌ها گذشته بود، پس چیزی زمان‌بندی نشد.',
    en: 'The reminder times had already passed, so none were scheduled.',
  },
  remindersNote: {
    fa: 'یادآوری‌ها از همان کانالی می‌رود که لید از آن آمده است.',
    en: 'Reminders go out on the channel the lead came from.',
  },

  // calendar and log
  logKicker: { fa: 'تقویم و دفتر', en: 'Calendar and log' },
  logTitle: { fa: 'جلسه‌ها و تماس‌های ثبت‌شده', en: 'Meetings and logged calls' },
  logSub: { fa: 'همان چیزی که در پایگاه داده هست', en: 'Exactly what is in the database' },
  countCalls: { fa: 'تماس‌ها', en: 'Calls' },
  countMeetings: { fa: 'جلسه‌های رزروشده', en: 'Booked meetings' },
  countReferrals: { fa: 'درخواست‌های معرفی', en: 'Referral asks' },
  meetings: { fa: 'جلسه‌ها', en: 'Meetings' },
  callsLog: { fa: 'تماس‌ها', en: 'Calls' },
  noBookings: { fa: 'هنوز جلسه‌ای رزرو نشده است.', en: 'No meetings booked yet.' },
  noCalls: { fa: 'هنوز تماسی ثبت نشده است.', en: 'No calls logged yet.' },
  scopedToLead: {
    fa: 'فهرست تماس‌ها فقط برای لید انتخاب‌شده است.',
    en: 'The call list is scoped to the selected lead.',
  },

  // due work
  dueKicker: { fa: 'کارهای سررسیده', en: 'Due work' },
  dueTitle: { fa: 'همین حالا اجرا کن', en: 'Run it now' },
  dueSub: { fa: 'یادآوری جلسه‌ها و درخواست‌های معرفی', en: 'Meeting reminders and referral asks' },
  dueRun: { fa: 'اجرای کارهای سررسیده', en: 'Run due work' },
  dueRunning: { fa: 'در حال اجرا…', en: 'Running…' },
  dueNote: {
    fa: 'کارگر پس‌زمینه خودش هر چند ثانیه یک‌بار همین را انجام می‌دهد؛ این دکمه فقط آن را به همین لحظه می‌آورد.',
    en: 'The background worker does this on its own every few seconds; this button only makes it immediate.',
  },

  // failures
  problem: { fa: 'خطا', en: 'problem' },
  failed: { fa: 'انجام نشد:', en: 'That did not go through:' },
  errorOffline: { fa: 'سرور در دسترس نیست. دوباره امتحان کن.', en: 'The server is unreachable. Try again.' },
  errorServer: { fa: 'درخواست روی سرور شکست خورد.', en: 'The request failed on the server.' },
} satisfies Record<string, Bi>

const ROUTE_LABEL: Record<string, Bi> = {
  hot: { fa: 'داغ', en: 'hot' },
  warm: { fa: 'گرم', en: 'warm' },
  cold: { fa: 'سرد', en: 'cold' },
}

const STAGE_LABEL: Record<string, Bi> = {
  new: { fa: 'تازه', en: 'new' },
  engaged: { fa: 'درگیر', en: 'engaged' },
  qualified: { fa: 'واجد شرایط', en: 'qualified' },
  meeting: { fa: 'جلسه', en: 'meeting' },
  checkout: { fa: 'پرداخت', en: 'checkout' },
  paid: { fa: 'پرداخت‌شده', en: 'paid' },
  delivered: { fa: 'تحویل‌شده', en: 'delivered' },
  advocate: { fa: 'معرف', en: 'advocate' },
  lost: { fa: 'ازدست‌رفته', en: 'lost' },
}

const CALL_STATUS: Record<string, Bi> = {
  dialled: { fa: 'شماره‌گیری شد', en: 'dialled' },
  simulated: { fa: 'شبیه‌سازی‌شده', en: 'simulated' },
  failed: { fa: 'ناموفق', en: 'failed' },
}

const BOOKING_STATUS: Record<string, Bi> = {
  booked: { fa: 'رزرو', en: 'booked' },
  cancelled: { fa: 'لغوشده', en: 'cancelled' },
  done: { fa: 'برگزارشده', en: 'done' },
}

/** 0 = Sunday, matching the server's working-day indices. */
const WEEKDAYS: Bi[] = [
  { fa: 'یکشنبه', en: 'Sunday' },
  { fa: 'دوشنبه', en: 'Monday' },
  { fa: 'سه‌شنبه', en: 'Tuesday' },
  { fa: 'چهارشنبه', en: 'Wednesday' },
  { fa: 'پنجشنبه', en: 'Thursday' },
  { fa: 'جمعه', en: 'Friday' },
  { fa: 'شنبه', en: 'Saturday' },
]

/** The stages a call is the obvious next move from; they sort to the top. */
const READY_STAGES = new Set(['qualified', 'meeting'])

const MINUTE_MS = 60_000

const labelOf = (table: Record<string, Bi>, key: string): Bi => table[key] ?? { fa: key, en: key }

/** Bookings are UTC ISO; the `calls` log is SQLite's zone-less UTC datetime. */
const parseInstant = (value: string) => Date.parse(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)

/**
 * The instant as the owner's working-day clock reads it. The offset comes from
 * the API rather than from this browser: the working window belongs to the
 * owner, and the reminder the lead receives is stamped with the same clock.
 */
function wallClock(value: string, offsetMinutes: number): { date: string; time: string; weekday: number } | null {
  const at = parseInstant(value)
  if (Number.isNaN(at)) return null
  const shifted = new Date(at + offsetMinutes * MINUTE_MS)
  const stamp = shifted.toISOString()
  return { date: stamp.slice(0, 10), time: stamp.slice(11, 16), weekday: shifted.getUTCDay() }
}

const clockOf = (minuteOfDay: number) =>
  `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`

const zoneOf = (offsetMinutes: number) => {
  const abs = Math.abs(offsetMinutes)
  return `UTC${offsetMinutes < 0 ? '-' : '+'}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
}

// Sentences that carry a number keep both languages together, so no half of a
// string is ever assembled at render time (rule 2).
const slotLengthLine = (minutes: string): Bi => ({
  fa: `هر جلسه ${minutes} دقیقه است.`,
  en: `Each meeting is ${minutes} minutes long.`,
})

const hoursLine = (from: string, to: string, zone: string): Bi => ({
  fa: `ساعت‌های کاری: ${from} تا ${to} به وقت ${zone}.`,
  en: `Working hours: ${from} to ${to}, ${zone}.`,
})

const zoneNote = (zone: string): Bi => ({
  fa: `همه‌ی زمان‌ها به وقت ${zone} است — همان ساعتی که سرور با آن رزرو می‌کند.`,
  en: `All times are ${zone}, the same clock the server books against.`,
})

const minutesLine = (minutes: string): Bi => ({ fa: `${minutes} دقیقه`, en: `${minutes} minutes` })

const dueResultLine = (reminders: string, referrals: string): Bi => ({
  fa: `${reminders} یادآوری و ${referrals} درخواست معرفی فرستاده شد.`,
  en: `Sent ${reminders} reminders and ${referrals} referral asks.`,
})

export default function Calls() {
  const { t, n, num } = useI18n()
  const [leadId, setLeadId] = useState<number | null>(null)
  const [slotStart, setSlotStart] = useState<string | null>(null)

  const desk = useCalls(leadId)
  const {
    leads,
    calls,
    bookings,
    counts,
    adapter,
    slots,
    slotMinutes,
    hours,
    online,
    loading,
    preparing,
    booking,
    running,
    prepared,
    lastBooking,
    lastRun,
    error,
  } = desk

  // With no working hours from the API there is nothing to shift by, so times
  // are shown in UTC and labelled UTC rather than guessed into a timezone.
  const offsetMinutes = hours?.offsetMinutes ?? 0
  const zone = zoneOf(offsetMinutes)

  const stamp = (value: string) => {
    const wall = wallClock(value, offsetMinutes)
    if (!wall) return value
    return `${t(WEEKDAYS[wall.weekday])} ${n(wall.date)} · ${n(wall.time)}`
  }

  const leadName = (id: number) => {
    const lead = leads.find((item) => item.id === id)
    return lead?.name?.trim() || (lead?.handle ? `@${lead.handle}` : null) || `#${num(id)}`
  }

  /** Callable leads first, then the strongest score — the order to work in. */
  const ordered = useMemo(
    () =>
      [...leads].sort((a, b) => {
        const ready = Number(READY_STAGES.has(b.stage)) - Number(READY_STAGES.has(a.stage))
        return ready !== 0 ? ready : b.score - a.score
      }),
    [leads],
  )

  const days = useMemo(() => {
    const groups = new Map<string, { weekday: number; slots: CallSlot[] }>()
    for (const slot of slots) {
      const wall = wallClock(slot.start, offsetMinutes)
      if (!wall) continue
      const group = groups.get(wall.date) ?? { weekday: wall.weekday, slots: [] }
      group.slots.push(slot)
      groups.set(wall.date, group)
    }
    return [...groups.entries()].map(([date, group]) => ({ date, ...group }))
  }, [slots, offsetMinutes])

  const selected = leadId === null ? null : (leads.find((lead) => lead.id === leadId) ?? null)
  const chosen = slots.find((slot) => slot.start === slotStart) ?? null

  // `live` is only known once a call has been prepared. Before that the one
  // honest reading is the adapter's own name — `brief-only` is the registry's
  // no-credentials voice adapter, which never dials.
  const dialLine = prepared
    ? prepared.live
      ? COPY.isLive
      : COPY.notLive
    : adapter === 'brief-only'
      ? COPY.notLive
      : COPY.dialUnknown

  const errorLine =
    error?.kind === 'offline' ? COPY.errorOffline : error?.kind === 'server' ? COPY.errorServer : COPY.failed

  const pickLead = (id: number) => {
    setLeadId((prev) => (prev === id ? null : id))
    setSlotStart(null)
  }

  const confirmBooking = async () => {
    if (leadId === null || !chosen) return
    const ok = await desk.book(leadId, chosen.start)
    if (ok) setSlotStart(null)
  }

  return (
    <AppShell>
      <PageBanner
        icon="Headphones"
        title={COPY.title}
        subtitle={COPY.subtitle}
        actions={
          <Link
            to="/sales-automation"
            aria-label={t(COPY.back)}
            title={t(COPY.back)}
            className="text-white/70 transition hover:text-white"
          >
            <Icon name="ChevronLeft" size={18} className="rtl:rotate-180" />
          </Link>
        }
      />

      {!online && (
        <div className="mt-3 rounded-xl border border-hairline bg-white/[0.03] px-3 py-2.5">
          <p className="text-[11.5px] text-white/45">{t(COPY.offline)}</p>
          <button
            type="button"
            onClick={() => void desk.refresh()}
            className="mt-2 rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/60 transition hover:border-accent/50 hover:text-white"
          >
            {t(COPY.retry)}
          </button>
        </div>
      )}

      {/* 1 — the lead every action on this page needs. */}
      <Card className="mt-4">
        <CardHead
          icon="Users"
          kicker={COPY.leadKicker}
          title={t(COPY.leadTitle)}
          subtitle={t(COPY.leadSub)}
        />

        {ordered.length === 0 ? (
          <p className="mt-3 text-[11.5px] text-white/30">{t(loading && online ? COPY.loading : COPY.leadNone)}</p>
        ) : (
          <ul className="mt-3 max-h-72 space-y-1 overflow-auto pe-1">
            {ordered.map((lead) => (
              <li key={lead.id}>
                <LeadButton lead={lead} selected={lead.id === leadId} onPick={() => pickLead(lead.id)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 2 — the brief, and an honest word about what dialling means here. */}
      <Card className="mt-3">
        <CardHead
          icon="MessageSquare"
          kicker={COPY.briefKicker}
          title={t(COPY.briefTitle)}
          subtitle={t(COPY.briefSub)}
        />

        <p className="mt-3 text-[11.5px] leading-relaxed text-white/55">{t(dialLine)}</p>
        {adapter && (
          <div className="mt-1.5">
            <Row label={t(COPY.voiceAdapter)} value={<span className="text-[11.5px] text-white/70">{adapter}</span>} />
          </div>
        )}

        <div className="mt-3">
          <PrimaryButton
            onClick={() => {
              if (leadId !== null) void desk.prepare(leadId)
            }}
            disabled={leadId === null || preparing || !online}
          >
            {t(preparing ? COPY.preparingNow : COPY.prepare)}
          </PrimaryButton>
          {leadId === null && <p className="mt-2 text-center text-[10.5px] text-white/30">{t(COPY.leadPickFirst)}</p>}
        </div>

        {prepared && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip tone={prepared.brief.producedBy === 'claude' ? 'accent' : 'neutral'}>
                {t(prepared.brief.producedBy === 'claude' ? COPY.byClaude : COPY.byTemplate)}
              </Chip>
              <Chip tone={prepared.call.status === 'failed' ? 'hot' : 'neutral'}>
                {t(labelOf(CALL_STATUS, prepared.call.status))}
              </Chip>
              {selected && <Chip>{leadName(selected.id)}</Chip>}
            </div>

            {/* The brief is content, so it is rendered in the language it was
                written in rather than translated at render time. */}
            <BriefBlock label={COPY.opening} text={prepared.brief.opening} />

            <div>
              <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">{t(COPY.objections)}</h3>
              <ul className="space-y-2">
                {prepared.brief.objections.map((entry, index) => (
                  <li key={index} className="rounded-xl border border-hairline bg-white/[0.03] px-3 py-2.5">
                    <p dir="auto" className="text-[12px] leading-relaxed text-white/85">
                      {entry.objection}
                    </p>
                    <p className="mt-1.5 text-[9.5px] uppercase tracking-[0.16em] text-white/25">{t(COPY.answer)}</p>
                    <p dir="auto" className="text-[11.5px] leading-relaxed text-white/60">
                      {entry.answer}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <BriefBlock label={COPY.ask} text={prepared.brief.ask} />
          </div>
        )}
      </Card>

      {/* 3 — the calendar side. */}
      <Card className="mt-3">
        <CardHead
          icon="Calendar"
          kicker={COPY.bookKicker}
          title={t(COPY.bookTitle)}
          subtitle={t(COPY.bookSub)}
        />

        <div className="mt-3 space-y-1 text-[10.5px] leading-relaxed text-white/35">
          {slotMinutes !== null && <p>{t(slotLengthLine(num(slotMinutes)))}</p>}
          {hours && <p>{t(hoursLine(n(clockOf(hours.start)), n(clockOf(hours.end)), n(zone)))}</p>}
          <p>{t(zoneNote(n(zone)))}</p>
        </div>

        {days.length === 0 ? (
          <p className="mt-3 text-[11.5px] text-white/30">{t(loading && online ? COPY.loading : COPY.bookNoSlots)}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {days.map((day) => (
              <div key={day.date}>
                <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">
                  {t(WEEKDAYS[day.weekday])} · {n(day.date)}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {day.slots.map((slot) => {
                    const wall = wallClock(slot.start, offsetMinutes)
                    const on = slot.start === slotStart
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSlotStart(on ? null : slot.start)}
                        className={`rounded-full px-3 py-1.5 text-[11px] tabular-nums transition ${
                          on
                            ? 'bg-accent text-white'
                            : 'border border-hairline bg-white/[0.03] text-white/55 hover:text-white/85'
                        }`}
                      >
                        {n(wall?.time ?? slot.start)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <PrimaryButton
            onClick={() => void confirmBooking()}
            disabled={leadId === null || !chosen || booking || !online}
          >
            {t(booking ? COPY.bookingNow : COPY.bookConfirm)}
          </PrimaryButton>
          {leadId === null && <p className="mt-2 text-center text-[10.5px] text-white/30">{t(COPY.leadPickFirst)}</p>}
          {chosen && (
            <p className="mt-2 text-center text-[10.5px] text-white/45">
              {stamp(chosen.start)}
              {selected ? ` · ${leadName(selected.id)}` : ''}
            </p>
          )}
        </div>

        {lastBooking && (
          <div className="mt-3 rounded-xl border border-success/40 bg-success/10 px-3 py-2.5">
            <p className="text-[11.5px] text-success">
              {t(COPY.booked)} · {stamp(lastBooking.booking.start_at)}
            </p>
            <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">{t(COPY.remindersLabel)}</p>
            {lastBooking.reminders.length === 0 ? (
              <p className="text-[11px] text-white/45">{t(COPY.remindersNone)}</p>
            ) : (
              <ul className="space-y-0.5 text-[11px] text-white/70">
                {lastBooking.reminders.map((due) => (
                  <li key={due}>{stamp(due)}</li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-[10.5px] text-white/35">{t(COPY.remindersNote)}</p>
          </div>
        )}
      </Card>

      {error && (
        <div className="mt-3 rounded-xl border border-hairline bg-white/[0.05] px-3 py-2.5">
          <p className="flex items-center gap-2 text-[11.5px] text-white/80">
            <Chip tone="hot">{t(COPY.problem)}</Chip>
            {t(errorLine)}
          </p>
          {error.messages.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-1 ps-4 text-[11.5px] text-white/70">
              {error.messages.map((message) => (
                <li key={message}>{t(explainCode(message, undefined, n))}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 4 — what is actually on the calendar and in the log. */}
      <Card className="mt-3">
        <CardHead
          icon="Clock"
          kicker={COPY.logKicker}
          title={t(COPY.logTitle)}
          subtitle={t(COPY.logSub)}
        />

        <div className="mt-2">
          <Row label={t(COPY.countCalls)} value={num(counts.calls)} />
          <Row label={t(COPY.countMeetings)} value={num(counts.meetings)} />
          <Row label={t(COPY.countReferrals)} value={num(counts.referralAsks)} />
        </div>

        <h3 className="mt-3 text-[10px] uppercase tracking-[0.16em] text-white/30">{t(COPY.meetings)}</h3>
        {bookings.length === 0 ? (
          <p className="mt-1.5 text-[11.5px] text-white/30">{t(loading && online ? COPY.loading : COPY.noBookings)}</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {bookings.map((entry) => (
              <BookingRow key={entry.id} booking={entry} who={leadName(entry.lead_id)} when={stamp(entry.start_at)} />
            ))}
          </ul>
        )}

        <h3 className="mt-4 text-[10px] uppercase tracking-[0.16em] text-white/30">{t(COPY.callsLog)}</h3>
        {leadId !== null && <p className="mt-1 text-[10.5px] text-white/30">{t(COPY.scopedToLead)}</p>}
        {calls.length === 0 ? (
          <p className="mt-1.5 text-[11.5px] text-white/30">{t(loading && online ? COPY.loading : COPY.noCalls)}</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {calls.map((call) => (
              <CallRow key={call.id} call={call} who={leadName(call.lead_id)} when={stamp(call.at)} />
            ))}
          </ul>
        )}
      </Card>

      {/* 5 — the worker's own pass, on demand. */}
      <Card className="mt-3">
        <CardHead
          icon="Zap"
          kicker={COPY.dueKicker}
          title={t(COPY.dueTitle)}
          subtitle={t(COPY.dueSub)}
        />

        <p className="mt-3 text-[11.5px] leading-relaxed text-white/55">{t(COPY.dueNote)}</p>

        <div className="mt-3">
          <PrimaryButton onClick={() => void desk.runDue()} disabled={running || !online}>
            {t(running ? COPY.dueRunning : COPY.dueRun)}
          </PrimaryButton>
          {lastRun && (
            <p className="mt-2 text-center text-[10.5px] text-white/45">
              {t(dueResultLine(num(lastRun.reminders), num(lastRun.referrals)))}
            </p>
          )}
        </div>
      </Card>
    </AppShell>
  )
}

function LeadButton({ lead, selected, onPick }: { lead: ApiLead; selected: boolean; onPick: () => void }) {
  const { t, num } = useI18n()
  const ready = READY_STAGES.has(lead.stage)

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPick}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-start transition ${
        selected ? 'border-accent/60 bg-accent/10' : 'border-hairline bg-white/[0.02] hover:border-accent/40'
      }`}
    >
      <NodeIcon icon={lead.source as IconKey} size={22} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-white/85">{lead.name ?? '—'}</span>
        <span className="block truncate text-[10px] text-white/35">
          {lead.handle ? `@${lead.handle}` : lead.source} · {t(COPY.score)} {num(lead.score)}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        {ready && <Chip tone="warm">{t(COPY.leadReady)}</Chip>}
        <Chip tone={lead.route === 'hot' ? 'hot' : lead.route === 'warm' ? 'warm' : 'cold'}>
          {t(labelOf(ROUTE_LABEL, lead.route))}
        </Chip>
        <Chip>{t(labelOf(STAGE_LABEL, lead.stage))}</Chip>
      </span>
    </button>
  )
}

/** One labelled paragraph of the brief. The text itself is left as written. */
function BriefBlock({ label, text }: { label: Bi; text: string }) {
  const { t } = useI18n()
  return (
    <div>
      <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/30">{t(label)}</h3>
      <p dir="auto" className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/80">
        {text}
      </p>
    </div>
  )
}

function BookingRow({ booking, who, when }: { booking: Booking; who: string; when: string }) {
  const { t, num } = useI18n()
  return (
    <li className="flex items-center gap-2 rounded-xl border border-hairline bg-white/[0.02] px-2.5 py-2 text-[11.5px]">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-white/80">{who}</span>
        <span className="block truncate text-[10px] text-white/35">
          {when} · {t(minutesLine(num(booking.minutes)))}
        </span>
      </span>
      <Chip tone={booking.status === 'booked' ? 'warm' : 'neutral'}>{t(labelOf(BOOKING_STATUS, booking.status))}</Chip>
    </li>
  )
}

function CallRow({ call, who, when }: { call: CallRecord; who: string; when: string }) {
  const { t } = useI18n()
  return (
    <li className="rounded-xl border border-hairline bg-white/[0.02] px-2.5 py-2 text-[11.5px]">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-white/80">{who}</span>
          <span className="block truncate text-[10px] text-white/35">
            {when} · {call.provider}
          </span>
        </span>
        <Chip tone={call.status === 'failed' ? 'hot' : 'neutral'}>{t(labelOf(CALL_STATUS, call.status))}</Chip>
      </div>
      <p dir="auto" className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-white/45">
        {call.brief.opening}
      </p>
    </li>
  )
}
