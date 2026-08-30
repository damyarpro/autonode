import type { Lead, LeadEventType } from '../types.ts'
import type { BusinessProfile } from './business.ts'

/**
 * Everything the sales call needs before it touches the database: when a
 * meeting can go, when its reminders are due, and what the caller should say.
 *
 * All instants are UTC. The owner's working day is expressed in local minutes
 * plus an explicit offset, so slot maths never reads the host clock's timezone
 * and a test in any environment gets the same answer.
 */

export const MINUTE_MS = 60_000
const DAY_MINUTES = 1440

export type WorkingHours = {
  /** Local weekdays that accept meetings, 0 = Sunday … 6 = Saturday. */
  days: number[]
  /** Minutes from local midnight when the bookable day opens and closes. */
  startMinute: number
  endMinute: number
  /** Minutes to add to UTC to get the owner's local time. Tehran is +210. */
  offsetMinutes: number
}

/** Saturday through Wednesday, 10:00–18:00 Tehran — the Iranian working week. */
export const DEFAULT_HOURS: WorkingHours = {
  days: [6, 0, 1, 2, 3],
  startMinute: 10 * 60,
  endMinute: 18 * 60,
  offsetMinutes: 210,
}

export const DEFAULT_SLOT_MINUTES = 30
/** A day before, then an hour before. */
export const DEFAULT_REMINDER_OFFSETS = [1440, 60]

/** A booked or candidate meeting: a UTC start and a length. */
export type Interval = { start: Date; minutes: number }
export type Slot = { start: Date; end: Date }

export const endOf = (interval: Interval): Date =>
  new Date(interval.start.getTime() + Math.max(0, interval.minutes) * MINUTE_MS)

/** Half-open on both sides, so a meeting may start exactly when another ends. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start.getTime() < endOf(b).getTime() && b.start.getTime() < endOf(a).getTime()
}

const localMinutes = (at: Date, offsetMinutes: number) =>
  Math.floor(at.getTime() / MINUTE_MS) + offsetMinutes

const instantAt = (dayIndex: number, minuteOfDay: number, offsetMinutes: number) =>
  new Date((dayIndex * DAY_MINUTES + minuteOfDay - offsetMinutes) * MINUTE_MS)

/** 1970-01-01 was a Thursday, so local day 0 is weekday 4. */
const weekdayOf = (dayIndex: number) => (((dayIndex + 4) % 7) + 7) % 7

/** True when the whole meeting fits inside one working day of the window. */
export function withinHours(start: Date, minutes: number, hours: WorkingHours = DEFAULT_HOURS): boolean {
  const local = localMinutes(start, hours.offsetMinutes)
  const dayIndex = Math.floor(local / DAY_MINUTES)
  const minuteOfDay = local - dayIndex * DAY_MINUTES
  if (!hours.days.includes(weekdayOf(dayIndex))) return false
  return minuteOfDay >= hours.startMinute && minuteOfDay + minutes <= hours.endMinute
}

export type SlotQuery = {
  from: Date
  count: number
  /** Meetings already on the calendar. Anything overlapping them is skipped. */
  taken?: Interval[]
  hours?: WorkingHours
  slotMinutes?: number
  /** How far ahead to look before giving up. */
  horizonDays?: number
}

/**
 * The next `count` free slots at or after `from`. Never returns a slot in the
 * past, outside the working window, or overlapping one that is taken; the
 * result is ordered and evenly spaced by `slotMinutes` within a day.
 */
export function nextFreeSlots(query: SlotQuery): Slot[] {
  const hours = query.hours ?? DEFAULT_HOURS
  const slotMinutes = Math.max(1, Math.round(query.slotMinutes ?? DEFAULT_SLOT_MINUTES))
  const count = Math.max(0, Math.round(query.count))
  const horizonDays = Math.max(1, Math.round(query.horizonDays ?? 21))
  const taken = query.taken ?? []
  const found: Slot[] = []
  if (count === 0 || hours.endMinute - hours.startMinute < slotMinutes || hours.days.length === 0) {
    return found
  }

  const firstDay = Math.floor(localMinutes(query.from, hours.offsetMinutes) / DAY_MINUTES)

  for (let day = firstDay; day < firstDay + horizonDays && found.length < count; day += 1) {
    if (!hours.days.includes(weekdayOf(day))) continue

    for (
      let minuteOfDay = hours.startMinute;
      minuteOfDay + slotMinutes <= hours.endMinute && found.length < count;
      minuteOfDay += slotMinutes
    ) {
      const start = instantAt(day, minuteOfDay, hours.offsetMinutes)
      if (start.getTime() < query.from.getTime()) continue
      const candidate: Interval = { start, minutes: slotMinutes }
      if (taken.some((booked) => overlaps(candidate, booked))) continue
      found.push({ start, end: endOf(candidate) })
    }
  }

  return found
}

/** Machine-readable, because the client turns it into a sentence (rule 11). */
export type SlotProblem = 'not_a_time' | 'past' | 'outside_hours' | 'taken'

/** The single reason this slot cannot be booked, or null when it can. */
export function slotProblem(check: {
  start: Date
  now: Date
  minutes?: number
  taken?: Interval[]
  hours?: WorkingHours
}): SlotProblem | null {
  const minutes = Math.max(1, Math.round(check.minutes ?? DEFAULT_SLOT_MINUTES))
  if (Number.isNaN(check.start.getTime())) return 'not_a_time'
  if (check.start.getTime() < check.now.getTime()) return 'past'
  if (!withinHours(check.start, minutes, check.hours ?? DEFAULT_HOURS)) return 'outside_hours'
  const candidate: Interval = { start: check.start, minutes }
  if ((check.taken ?? []).some((booked) => overlaps(candidate, booked))) return 'taken'
  return null
}

/**
 * When each reminder for a meeting is due. Offsets are minutes *before* the
 * start; duplicates and anything that would land at or after the meeting are
 * dropped, and the result is ordered earliest first.
 */
export function reminderTimes(slotStart: Date, offsetsMinutes: number[] = DEFAULT_REMINDER_OFFSETS): Date[] {
  const seen = new Set<number>()
  for (const offset of offsetsMinutes) {
    if (!Number.isFinite(offset) || offset <= 0) continue
    seen.add(slotStart.getTime() - Math.round(offset) * MINUTE_MS)
  }
  return [...seen].sort((a, b) => a - b).map((time) => new Date(time))
}

// ── the call brief ───────────────────────────────────────────────────────

export type CallObjection = { objection: string; answer: string }

/** What the owner (or the voice assistant) works from on the call. */
export type CallBrief = {
  opening: string
  /** Exactly two: the ones this lead's own history says are coming. */
  objections: CallObjection[]
  ask: string
  producedBy: 'claude' | 'template'
}

export type CallBriefInput = {
  lead: Lead
  business: BusinessProfile
  /** The lead's own event log, oldest first. */
  events: { type: LeadEventType; at: string }[]
  recentMessages: { direction: 'in' | 'out'; body: string }[]
  locale: 'fa' | 'en'
}

type Bi = { fa: string; en: string }
type BiObjection = { objection: Bi; answer: Bi }

const pick = (copy: Bi, locale: string) => (locale === 'en' ? copy.en : copy.fa)

const faDigits = (value: string) => value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])

const number = (value: number, locale: string) =>
  locale === 'en' ? value.toLocaleString('en-US') : faDigits(value.toLocaleString('en-US'))

const CHANNEL_NAME: Record<string, Bi> = {
  instagram: { fa: 'اینستاگرام', en: 'Instagram' },
  telegram: { fa: 'تلگرام', en: 'Telegram' },
  linkedin: { fa: 'لینکدین', en: 'LinkedIn' },
  youtube: { fa: 'یوتیوب', en: 'YouTube' },
  website: { fa: 'وب‌سایت', en: 'the website' },
}

/** The most recent thing the lead did, said back to them in their own terms. */
const LAST_ACTION: Partial<Record<LeadEventType, Bi>> = {
  captured: { fa: 'اولین بار پیدایتان کردیم', en: 'first reached us' },
  content_view: { fa: 'محتوای ما را دیدید', en: 'watched our content' },
  link_click: { fa: 'روی لینک ما زدید', en: 'clicked our link' },
  form_submit: { fa: 'فرم را پر کردید', en: 'filled in the form' },
  message_in: { fa: 'برای ما پیام گذاشتید', en: 'messaged us' },
  reply: { fa: 'به پیام ما جواب دادید', en: 'replied to us' },
  message_out: { fa: 'آخرین پیام ما را دریافت کردید', en: 'got our last message' },
  call_booked: { fa: 'یک جلسه رزرو کردید', en: 'booked a call' },
  call_completed: { fa: 'با ما جلسه داشتید', en: 'had a call with us' },
  checkout_started: { fa: 'پرداخت را شروع کردید', en: 'started the checkout' },
  paid: { fa: 'پرداخت کردید', en: 'paid' },
  delivered: { fa: 'سرویس را تحویل گرفتید', en: 'took delivery' },
  referred: { fa: 'ما را معرفی کردید', en: 'referred someone' },
  unsubscribed: { fa: 'از فهرست پیام‌ها خارج شدید', en: 'opted out of messages' },
}

type Signals = {
  counts: Partial<Record<LeadEventType, number>>
  replied: boolean
  startedCheckout: boolean
  paid: boolean
  noShow: boolean
  optedOut: boolean
  touches: number
}

const readSignals = (input: CallBriefInput): Signals => {
  const counts: Partial<Record<LeadEventType, number>> = {}
  for (const event of input.events) counts[event.type] = (counts[event.type] ?? 0) + 1
  const at = (type: LeadEventType) => counts[type] ?? 0
  return {
    counts,
    replied: at('reply') + at('message_in') > 0,
    startedCheckout: at('checkout_started') > 0,
    paid: at('paid') > 0,
    noShow: at('call_booked') > at('call_completed'),
    optedOut: at('unsubscribed') > 0,
    touches: at('content_view') + at('link_click') + at('form_submit'),
  }
}

/**
 * Ordered by how strongly the evidence points at each doubt. Two win. The
 * predicate reads only the lead's own log, so the brief is about this lead
 * rather than a generic script.
 */
const OBJECTIONS: { id: string; when: (s: Signals, input: CallBriefInput) => boolean; copy: BiObjection }[] = [
  {
    id: 'opted_out',
    when: (s) => s.optedOut,
    copy: {
      objection: { fa: 'گفتم دیگر پیام نفرستید.', en: 'I asked you to stop messaging me.' },
      answer: {
        fa: 'همین یک تماس است و بس. یک سؤال می‌پرسم؛ اگر جوابش «نه» بود، پرونده را می‌بندم.',
        en: 'This is the one call. I ask a single question, and if the answer is no I close the file.',
      },
    },
  },
  {
    id: 'price',
    when: (s) => s.startedCheckout && !s.paid,
    copy: {
      objection: { fa: 'مبلغش الان برای من زیاد است.', en: 'The price is too much for me right now.' },
      answer: {
        fa: 'عدد را کامل می‌گویم و به نتیجه‌اش گره می‌زنم: این هزینه در برابر لیدهایی است که همین حالا از دست می‌رود. اگر باز هم زیاد بود، از کوچک‌ترین قدم شروع می‌کنیم.',
        en: 'Say the full number and tie it to the outcome: it costs less than the leads going cold this month. If it is still too much, start with the smallest step.',
      },
    },
  },
  {
    id: 'no_show',
    when: (s) => s.noShow,
    copy: {
      objection: { fa: 'دفعه‌ی قبل نشد؛ سرم شلوغ است.', en: 'It did not happen last time — I am busy.' },
      answer: {
        fa: 'پانزده دقیقه کافی است و همین حالا دو زمان دقیق پیشنهاد می‌دهم تا انتخاب کند، نه اینکه خودش دنبال وقت بگردد.',
        en: 'Fifteen minutes is enough. Offer two exact times to choose between instead of asking when suits them.',
      },
    },
  },
  {
    id: 'fit',
    when: (s) => s.touches >= 3 && !s.replied,
    copy: {
      objection: { fa: 'مطمئن نیستم به درد کار من بخورد.', en: 'I am not sure this fits my business.' },
      answer: {
        fa: 'اول مخاطب خودش را برایش تعریف می‌کنم، بعد یک نتیجه‌ی مشخص از همان جنس کار. اگر جور نبود، خودم می‌گویم جور نیست.',
        en: 'Name their own audience back to them, then one concrete result from the same kind of business. If it does not fit, say so first.',
      },
    },
  },
  {
    id: 'timing',
    when: (s) => !s.replied,
    copy: {
      objection: { fa: 'الان وقتش نیست، بعداً.', en: 'Not now, maybe later.' },
      answer: {
        fa: '«بعداً» را به یک تاریخ تبدیل می‌کنم: می‌پرسم دقیقاً چه چیزی باید عوض شود تا وقتش برسد، و همان روز را رزرو می‌کنیم.',
        en: 'Turn "later" into a date: ask what has to change for it to be the right time, and book that day.',
      },
    },
  },
  {
    id: 'tried_before',
    when: (_s, input) => input.lead.route === 'hot' || input.lead.score >= 80,
    copy: {
      objection: { fa: 'قبلاً چیزی شبیه این را امتحان کرده‌ام و جواب نداد.', en: 'I tried something like this before and it did not work.' },
      answer: {
        fa: 'می‌پرسم دقیقاً کدام قسمتش شکست خورد، و فقط همان قسمت را نشان می‌دهم؛ بقیه‌اش را دوباره نمی‌فروشم.',
        en: 'Ask which part failed, then show only that part working. Do not re-sell the rest.',
      },
    },
  },
  {
    id: 'trust',
    when: () => true,
    copy: {
      objection: { fa: 'شما را نمی‌شناسم؛ از کجا مطمئن باشم؟', en: 'I do not know you — why should I trust this?' },
      answer: {
        fa: 'یک نمونه‌ی قابل بررسی می‌دهم و اجازه می‌دهم خودش چک کند. قول نمی‌دهم؛ نشان می‌دهم.',
        en: 'Give one checkable example and let them verify it. Do not promise, show.',
      },
    },
  },
  {
    // Always matches, so two objections are guaranteed however thin the log is.
    id: 'worth_it',
    when: () => true,
    copy: {
      objection: { fa: 'باید فکر کنم / با شریکم مشورت کنم.', en: 'I need to think about it / check with my partner.' },
      answer: {
        fa: 'می‌پرسم دقیقاً روی چه چیزی باید فکر کند، همان یک مورد را همین‌جا جواب می‌دهم و برای جواب نهایی یک تاریخ می‌گیرم.',
        en: 'Ask what exactly needs thinking about, answer that one thing on the call, and get a date for the answer.',
      },
    },
  },
]

const displayName = (lead: Lead, locale: string) =>
  lead.name?.trim() || lead.handle?.trim() || (locale === 'en' ? 'there' : 'دوست من')

const daysBetween = (from: string, now: Date) => {
  const at = Date.parse(from.includes('T') ? from : `${from.replace(' ', 'T')}Z`)
  if (Number.isNaN(at)) return 0
  return Math.max(0, Math.round((now.getTime() - at) / (24 * 60 * MINUTE_MS)))
}

const openingLine = (input: CallBriefInput, now: Date) => {
  const { lead, business, locale } = input
  const last = [...input.events].reverse().find((event) => LAST_ACTION[event.type])
  const action = last ? pick(LAST_ACTION[last.type]!, locale) : pick(LAST_ACTION.captured!, locale)
  const days = last ? daysBetween(last.at, now) : 0
  const channel = pick(CHANNEL_NAME[lead.source] ?? { fa: lead.source, en: lead.source }, locale)
  const who = business.name.trim() || (locale === 'en' ? 'our studio' : 'تیم ما')
  const when =
    days <= 0
      ? { fa: 'همین امروز', en: 'today' }
      : days === 1
        ? { fa: 'دیروز', en: 'yesterday' }
        : { fa: `${number(days, 'fa')} روز پیش`, en: `${number(days, 'en')} days ago` }

  return locale === 'en'
    ? `Hi ${displayName(lead, locale)}, this is ${who}. You ${action} on ${channel} ${pick(when, locale)} — that is why I am calling. Two minutes?`
    : `سلام ${displayName(lead, locale)}، از ${who} تماس می‌گیرم. شما ${pick(when, locale)} در ${channel} ${action} — برای همین زنگ زدم. دو دقیقه وقت دارید؟`
}

const theAsk = (input: CallBriefInput, signals: Signals) => {
  const { business, locale, lead } = input
  const link = business.ctaUrl ? (locale === 'en' ? ` Link: ${business.ctaUrl}` : ` لینک: ${business.ctaUrl}`) : ''
  const price =
    business.priceToman > 0
      ? locale === 'en'
        ? ` It is ${number(business.priceToman, 'en')} Toman.`
        : ` مبلغش ${number(business.priceToman, 'fa')} تومان است.`
      : ''

  if (signals.paid || lead.stage === 'delivered' || lead.stage === 'advocate') {
    return locale === 'en'
      ? `Ask for one sentence of feedback, then the name of one person with the same problem.${link}`
      : `یک جمله بازخورد بخواه، بعد اسم یک نفر که همین مشکل را دارد.${link}`
  }
  if (signals.startedCheckout) {
    return locale === 'en'
      ? `Ask them to finish the checkout on this call while you stay on the line.${price}${link}`
      : `همین حالا و پشت خط، از او بخواه پرداخت نیمه‌کاره را تمام کند.${price}${link}`
  }
  return locale === 'en'
    ? `Ask for a 30-minute setup call and name two exact times before hanging up.${price}${link}`
    : `قبل از قطع تماس، یک جلسه‌ی ۳۰ دقیقه‌ای بخواه و دو زمان دقیق پیشنهاد بده.${price}${link}`
}

/**
 * The deterministic brief. This is what makes the voice node real with no paid
 * account: the opening, the two doubts this lead's log predicts, and the exact
 * ask exist whether or not anything ever dials.
 */
export function composeBrief(input: CallBriefInput, now = new Date()): CallBrief {
  const signals = readSignals(input)
  const chosen = OBJECTIONS.filter((rule) => rule.when(signals, input)).slice(0, 2)
  // `trust` always matches, so there is never a brief with fewer than two.
  const objections = chosen.map((rule) => ({
    objection: pick(rule.copy.objection, input.locale),
    answer: pick(rule.copy.answer, input.locale),
  }))

  return {
    opening: openingLine(input, now),
    objections,
    ask: theAsk(input, signals),
    producedBy: 'template',
  }
}

/** A brief is only worth showing when every part of it says something. */
export const briefIsComplete = (brief: CallBrief): boolean =>
  brief.opening.trim().length > 0 &&
  brief.ask.trim().length > 0 &&
  brief.objections.length >= 2 &&
  brief.objections.every((entry) => entry.objection.trim() && entry.answer.trim())
