/**
 * The content pipeline's pure half: what a piece is, which kind belongs on
 * which channel, when each one goes out, and the no-credentials copy. Nothing
 * here touches the database, the clock or a model, so every rule below is
 * testable on its own.
 */
import { CHANNELS, type Channel } from '../types.ts'
import type { BusinessProfile, Tone } from './business.ts'

export const CONTENT_KINDS = ['voice', 'video', 'copy'] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

/** Same vocabulary a message carries, so a piece's outcome reads the same way. */
export const CONTENT_STATUSES = ['pending', 'sent', 'simulated', 'failed'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

/** The five frames a piece can take. Rotating them keeps a batch from repeating itself. */
export const CONTENT_ANGLES = ['problem', 'offer', 'objection', 'start', 'question'] as const
export type ContentAngle = (typeof CONTENT_ANGLES)[number]

export type ContentLocale = 'fa' | 'en'

/** Where the words came from. `none` is an empty plan — nothing was written. */
export type ContentSource = 'claude' | 'template' | 'none'

/** What the producer is asked for: one piece per brief, in this order. */
export type ContentBrief = { channel: Channel; kind: ContentKind; angle: ContentAngle }

/** What a producer hands back for one brief. */
export type ContentWritten = { title: string; body: string }

export type ContentDraft = ContentBrief & ContentWritten

export type PlannedPiece = ContentDraft & { dueAt: Date }

export type ContentPlan = {
  pieces: PlannedPiece[]
  locale: ContentLocale
  producedBy: ContentSource
  /** `field:code` for the client when the plan is empty. Empty when it is not. */
  blockedBy: string[]
}

/** One stored piece, as the API returns it. */
export type ContentRecord = {
  id: number
  kind: ContentKind
  channel: Channel
  title: string
  body: string
  locale: string
  angle: string | null
  target: string | null
  status: ContentStatus
  dueAt: string
  publishedAt: string | null
  producedBy: string
  note: string | null
  createdAt: string
}

export const DEFAULT_COUNT = 6
export const MAX_COUNT = 24
export const DEFAULT_PER_DAY = 2
export const MAX_PER_DAY = 24
export const MAX_BODY = 4000

const DAY_MINUTES = 24 * 60

/** A piece counts towards the board once it actually left, however it left. */
export const isPublished = (status: ContentStatus): boolean => status === 'sent' || status === 'simulated'

// ── briefs ───────────────────────────────────────────────────────────────

/**
 * A voiceover has nowhere to go on LinkedIn and a written post is not what
 * YouTube wants, so each channel gets its own rotation rather than one kind.
 */
const KINDS_BY_CHANNEL: Record<Channel, ContentKind[]> = {
  instagram: ['video', 'voice', 'copy'],
  youtube: ['video', 'voice'],
  telegram: ['copy', 'voice'],
  linkedin: ['copy'],
  website: ['copy'],
}

export function kindFor(channel: Channel, index: number): ContentKind {
  const kinds = KINDS_BY_CHANNEL[channel]
  return kinds[Math.abs(Math.trunc(index)) % kinds.length]
}

export const angleFor = (index: number): ContentAngle =>
  CONTENT_ANGLES[Math.abs(Math.trunc(index)) % CONTENT_ANGLES.length]

/**
 * Deals `count` pieces round-robin across the channels, so asking for at least
 * one per channel gets one per channel, and no channel gets the same kind twice
 * before the others have had one.
 */
export function briefsFor(channels: Channel[], count: number): ContentBrief[] {
  const list = channels.length > 0 ? channels : [...CHANNELS]
  const seen = new Map<Channel, number>()
  const briefs: ContentBrief[] = []

  for (let index = 0; index < Math.max(0, Math.trunc(count)); index += 1) {
    const channel = list[index % list.length]
    const nth = seen.get(channel) ?? 0
    seen.set(channel, nth + 1)
    briefs.push({ channel, kind: kindFor(channel, nth), angle: angleFor(index) })
  }
  return briefs
}

// ── schedule ─────────────────────────────────────────────────────────────

export const clampPerDay = (perDay: number): number =>
  Number.isFinite(perDay) ? Math.min(MAX_PER_DAY, Math.max(1, Math.trunc(perDay))) : DEFAULT_PER_DAY

/**
 * Spreads pieces over the calendar at `perDay` a day, evenly inside each day.
 * `speed` scales the spacing exactly as `planSteps` scales a nurture delay: 1 is
 * real time, 0 makes every piece due immediately, which is what the tests and
 * the end-to-end script run on.
 */
export function planSchedule(
  pieces: ContentDraft[],
  from: Date,
  perDay: number = DEFAULT_PER_DAY,
  speed = 1,
): PlannedPiece[] {
  const spacing = Math.round(DAY_MINUTES / clampPerDay(perDay))
  const scale = Number.isFinite(speed) && speed > 0 ? speed : 0

  return pieces.map((piece, index) => ({
    ...piece,
    dueAt: new Date(from.getTime() + index * spacing * scale * 60_000),
  }))
}

// ── validation ───────────────────────────────────────────────────────────

/** `field:code`, the way the rest of the server reports a bad value. */
export function draftErrors(draft: Partial<ContentDraft>): string[] {
  const errors: string[] = []
  if (!draft.title?.trim()) errors.push('title:required')
  if (!draft.body?.trim()) errors.push('body:required')
  if (draft.body && draft.body.length > MAX_BODY) errors.push(`body:too_long:${MAX_BODY}`)
  if (!draft.channel || !CHANNELS.includes(draft.channel)) errors.push('channel:not_an_option')
  if (!draft.kind || !CONTENT_KINDS.includes(draft.kind)) errors.push('kind:not_an_option')
  return errors
}

export const isDraft = (draft: Partial<ContentDraft>): draft is ContentDraft => draftErrors(draft).length === 0

/**
 * Attaches each written piece to the brief that asked for it. A producer never
 * gets to change the channel or the kind, and a batch that came back short or
 * blank is rejected whole — a half-written plan is never blended with the
 * fallback, so `producedBy` stays truthful.
 */
export function mergeDrafts(briefs: ContentBrief[], written: ContentWritten[]): ContentDraft[] {
  if (written.length !== briefs.length) return []
  const drafts = briefs.map((brief, index) => ({
    ...brief,
    title: (written[index]?.title ?? '').trim(),
    body: (written[index]?.body ?? '').trim(),
  }))
  return drafts.every(isDraft) ? drafts : []
}

export type ContentRequest = {
  count: number
  channels: Channel[]
  locale: ContentLocale
  perDay: number
}

export type RequestResult = { ok: true; request: ContentRequest } | { ok: false; errors: string[] }

/** Validates and clamps a produce request. Pure, so the route stays thin. */
export function normalizeRequest(raw: unknown): RequestResult {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const errors: string[] = []

  let count = DEFAULT_COUNT
  if (body.count !== undefined) {
    const asked = Number(body.count)
    if (!Number.isFinite(asked) || asked < 1) errors.push('count:not_a_number')
    else count = Math.min(MAX_COUNT, Math.trunc(asked))
  }

  let perDay = DEFAULT_PER_DAY
  if (body.perDay !== undefined) {
    const asked = Number(body.perDay)
    if (!Number.isFinite(asked) || asked < 1) errors.push('perDay:not_a_number')
    else perDay = clampPerDay(asked)
  }

  let channels: Channel[] = []
  if (body.channels !== undefined) {
    if (!Array.isArray(body.channels)) errors.push('channels:not_a_list')
    else {
      const asked = body.channels as unknown[]
      if (asked.some((channel) => !CHANNELS.includes(channel as Channel))) errors.push('channels:not_an_option')
      else channels = [...new Set(asked as Channel[])]
    }
  }

  const locale: ContentLocale = body.locale === 'en' ? 'en' : 'fa'
  return errors.length > 0 ? { ok: false, errors } : { ok: true, request: { count, channels, locale, perDay } }
}

export const isStatus = (value: unknown): value is ContentStatus =>
  CONTENT_STATUSES.includes(value as ContentStatus)

// ── the offline copy ─────────────────────────────────────────────────────

type T = (fa: string, en: string) => string

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

const grouped = (value: number) => Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const money = (value: number, locale: ContentLocale) =>
  locale === 'en'
    ? `${grouped(value)} Toman`
    : `${grouped(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)])} تومان`

/** Long free text reads badly inside a sentence, so quote only the opening. */
const clip = (text: string, max: number): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`
}

type Words = {
  name: string
  offer: string
  audience: string
  price: string | null
  cta: string | null
}

const wordsOf = (business: BusinessProfile, locale: ContentLocale, t: T): Words => ({
  name: business.name.trim() || t('همین کسب‌وکار', 'this business'),
  offer: clip(business.whatWeSell, 120),
  audience: clip(business.audience, 70),
  price: business.priceToman > 0 ? money(business.priceToman, locale) : null,
  cta: business.ctaUrl?.trim() || null,
})

const DELIVERY: Record<Tone, [fa: string, en: string]> = {
  friendly: ['گرم و ساده، انگار با یک نفر حرف می‌زنید', 'warm and plain, like talking to one person'],
  expert: ['آرام و دقیق؛ توضیح بده، ادعا نکن', 'calm and precise; explain, do not claim'],
  direct: ['کوتاه و بی‌مقدمه؛ جمله‌ها کوتاه', 'short and blunt; keep the sentences short'],
  playful: ['سبک و انسانی، اما نه شوخی با پول', 'light and human, never silly about money'],
}

const ANGLE_TITLE: Record<ContentAngle, [fa: string, en: string]> = {
  problem: ['قلاب مشکل', 'Problem hook'],
  offer: ['پیشنهاد روشن', 'Plain offer'],
  objection: ['پاسخ به تردید', 'Answering the doubt'],
  start: ['اولین قدم', 'First step'],
  question: ['سؤال از مخاطب', 'Question to the audience'],
}

const KIND_TITLE: Record<ContentKind, [fa: string, en: string]> = {
  voice: ['متن گویندگی', 'Voiceover'],
  video: ['ویدیوی کوتاه', 'Short video'],
  copy: ['پست', 'Post'],
}

/**
 * Three lines per angle, all of them built out of the owner's own words. Every
 * claim here is either something the profile states or an invitation — nothing
 * asserts a result, a number or a customer the owner never told us about.
 */
function lines(angle: ContentAngle, w: Words, t: T): { hook: string; body: string; close: string } {
  const here = t('همین‌جا پیام بدهید', 'write here')
  const link = w.cta ? t(` یا از ${w.cta} شروع کنید`, ` or start at ${w.cta}`) : ''

  switch (angle) {
    case 'problem':
      return {
        hook: t(`اگر جزو ${w.audience} هستید، این یکی را می‌شناسید.`, `If you are one of ${w.audience}, you know this one.`),
        body: t(
          `کاری که «${w.offer}» انجام می‌دهد خودش انجام نمی‌شود: یا وقت خودتان را می‌گیرد، یا هر هفته عقب می‌افتد.`,
          `The work "${w.offer}" covers does not do itself: it either takes your own hours, or it slips another week.`,
        ),
        close: t(`اگر می‌خواهید از فهرست کارهایتان بیرون برود، ${here}${link}.`, `If you want it off your list, ${here}${link}.`),
      }
    case 'offer':
      return {
        hook: t(`${w.name} برای ${w.audience}: ${w.offer}.`, `${w.name} for ${w.audience}: ${w.offer}.`),
        body: w.price
          ? t(
              `قیمت از ${w.price} شروع می‌شود و پیش از شروع دقیقاً می‌دانید چه چیزی و کِی تحویل می‌گیرید.`,
              `It starts at ${w.price}, and you know exactly what you get and when before anything begins.`,
            )
          : t(
              'پیش از شروع دقیقاً می‌دانید چه چیزی و کِی تحویل می‌گیرید؛ دامنه‌ی کار همان اول روشن می‌شود.',
              'You know exactly what you get and when before anything begins; the scope is settled up front.',
            ),
        close: w.cta
          ? t(`جزئیات و شروع: ${w.cta}`, `Details and first step: ${w.cta}`)
          : t('برای شروع همین‌جا پیام بدهید.', 'Message here to start.'),
      }
    case 'objection':
      return {
        hook: t('«الان وقتش هست؟» — سؤال درستی است.', '"Is now the right time?" — fair question.'),
        body: t(
          `اگر «${w.offer}» را الان لازم ندارید، لازمش ندارید. اما اگر جزو ${w.audience} هستید و همین کار ماه‌هاست عقب می‌افتد، صبر کردن ارزان‌ترش نمی‌کند.`,
          `If you do not need "${w.offer}" right now, you do not need it. But if you are one of ${w.audience} and this has been slipping for months, waiting does not make it cheaper.`,
        ),
        close: t(
          'یک سؤال بپرسید؛ اگر جواب «فعلاً نه» باشد، همان را می‌گویم.',
          'Ask one question; if the answer is "not yet", I will say so.',
        ),
      }
    case 'start':
      return {
        hook: t('شروع کردن یک پیام است، نه یک پروژه.', 'Getting started is one message, not a project.'),
        body: t(
          `بگویید الان کجای کار هستید و کدام بخش «${w.offer}» برایتان مهم‌تر است؛ بعد می‌گویم چه چیزی لازم است و چه چیزی لازم نیست.`,
          `Tell me where you are now and which part of "${w.offer}" matters most; I will tell you what you need and what you do not.`,
        ),
        close: w.cta ? t(`شروع از ${w.cta}.`, `Start at ${w.cta}.`) : t(`${here}.`, `${here}.`),
      }
    case 'question':
      return {
        hook: t(`یک سؤال از ${w.audience}:`, `A question for ${w.audience}:`),
        body: t(
          `اگر می‌شد فقط یک تکه از کاری که «${w.offer}» پوشش می‌دهد را از این هفته‌تان حذف کنید، کدام را حذف می‌کردید؟`,
          `If you could take just one piece of what "${w.offer}" covers out of your week, which piece would you drop?`,
        ),
        close: t(
          'جوابتان را بنویسید — همین تصمیم می‌گیرد بعدی چه بسازم.',
          'Reply with yours — it decides what I build next.',
        ),
      }
  }
}

/** Wraps the three lines in the shape the channel expects for that kind. */
function shape(kind: ContentKind, part: { hook: string; body: string; close: string }, tone: Tone, t: T): string {
  const delivery = t(...DELIVERY[tone])

  if (kind === 'copy') return `${part.hook}\n\n${part.body}\n\n${part.close}`

  if (kind === 'video') {
    return t(
      [
        `۰–۳ ثانیه | قلاب: ${part.hook}`,
        `۳–۱۵ ثانیه | متن: ${part.body}`,
        `۱۵–۲۵ ثانیه | دعوت: ${part.close}`,
        `اجرا: ${delivery}. یک برداشت، بدون تدوین اضافه.`,
      ].join('\n'),
      [
        `0–3s | hook: ${part.hook}`,
        `3–15s | body: ${part.body}`,
        `15–25s | call to action: ${part.close}`,
        `Delivery: ${delivery}. One take, no extra editing.`,
      ].join('\n'),
    )
  }

  return t(
    [
      `متن گویندگی — حدود ۳۰ ثانیه. لحن: ${delivery}.`,
      `۱) ${part.hook}`,
      '   (مکث کوتاه)',
      `۲) ${part.body}`,
      `۳) ${part.close}`,
    ].join('\n'),
    [
      `Voiceover script — about 30 seconds. Delivery: ${delivery}.`,
      `1) ${part.hook}`,
      '   (short pause)',
      `2) ${part.body}`,
      `3) ${part.close}`,
    ].join('\n'),
  )
}

/**
 * The no-credentials producer. Deterministic, and every sentence is built from
 * what the owner wrote in their profile — never filler, and never a fact they
 * did not give us. An unusable profile has nothing to build from, so it writes
 * nothing rather than inventing an offer.
 */
export function templateContent(
  business: BusinessProfile,
  briefs: ContentBrief[],
  locale: ContentLocale,
): ContentWritten[] {
  const t: T = (fa, en) => (locale === 'en' ? en : fa)
  const w = wordsOf(business, locale, t)
  if (!w.offer || !w.audience) return []

  return briefs.map((brief) => ({
    title: `${t(...ANGLE_TITLE[brief.angle])} — ${t(...KIND_TITLE[brief.kind])}`,
    body: shape(brief.kind, lines(brief.angle, w, t), business.tone, t),
  }))
}
