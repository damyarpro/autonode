import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PageBanner from '../components/PageBanner'
import { Card, CardHead, PrimaryButton, Row } from '../components/Card'
import Chip, { type ChipTone } from '../components/Chip'
import { Icon } from '../components/Icon'
import { NodeIcon } from '../components/icons'
import {
  CONTENT_CHANNELS,
  CONTENT_DEFAULTS,
  CONTENT_LIMITS,
  useContent,
  type ContentChannel,
  type ContentPiece,
  type ContentStatus,
} from '../api/useContent'
import { explainCode } from '../i18n/errors'
import { useI18n } from '../i18n/I18nProvider'
import type { Bi } from '../data/types'

const COPY = {
  title: { fa: 'کارخانه‌ی محتوا', en: 'Content factory' },
  subtitle: { fa: 'یک بَچ محتوا بنویس و زمان‌بندی کن', en: 'Write a batch and put it on the calendar' },
  backToBoard: { fa: 'بازگشت به بورد فروش', en: 'Back to the sales board' },

  // how the node works
  how: { fa: 'این گره چه می‌کند', en: 'What this node does' },
  howTitle: { fa: 'از پروفایل بیزینس تا پنج کانال', en: 'From the business profile to five channels' },
  howSub: { fa: 'همان گره‌ی «کارخانه‌ی محتوا» روی بورد', en: 'The same “content factory” node on the board' },
  howBody: {
    fa: 'هر تکه از روی پروفایل بیزینس نوشته می‌شود، برای کانالی که انتخاب می‌کنی، و روی تقویم می‌نشیند. تا وقتی زمانش نرسیده «در نوبت» می‌ماند؛ با دکمه‌ی انتشار، همه‌ی نوبت‌های رسیده همین حالا از کانال خودشان بیرون می‌روند.',
    en: 'Each piece is written from the business profile, for the channel you pick, and lands on the calendar. Until its hour comes it stays pending; the publish button sends everything already due out through its own channel, right now.',
  },

  // delivery honesty
  delivery: { fa: 'تحویل واقعی', en: 'Real delivery' },
  deliveryTitle: { fa: 'کدام کانال واقعاً می‌فرستد', en: 'Which channel really sends' },
  deliverySub: { fa: 'خوانده‌شده از وضعیت خود سرور', en: 'Read from the server’s own status' },
  deliveryBody: {
    fa: 'کانالی که کلید و تنظیمات دارد واقعاً تحویل می‌دهد و تکه «فرستاده‌شده» ثبت می‌شود. بقیه فقط ثبت می‌شوند و برچسبشان «شبیه‌سازی» است — یعنی جایی منتشر نشده‌اند. در عمل امروز فقط تلگرام است که با توکن واقعاً می‌فرستد.',
    en: 'A channel with credentials really delivers, and the piece is recorded as sent. The others only record the piece and are labelled simulated — nothing was published anywhere. In practice only Telegram, with a token, delivers for real today.',
  },
  deliveryUnknown: {
    fa: 'تا وقتی API در دسترس نیست، وضعیت تحویل کانال‌ها معلوم نیست.',
    en: 'While the API is unreachable, the channels’ delivery status is unknown.',
  },
  live: { fa: 'تحویل واقعی', en: 'delivers' },
  simulated: { fa: 'فقط ثبت', en: 'records only' },

  // the 409
  blockedKicker: { fa: 'قبل از هر چیز', en: 'First things first' },
  blockedTitle: { fa: 'پروفایل بیزینس هنوز کامل نیست', en: 'The business profile is not complete yet' },
  blockedSub: { fa: 'موضوع محتوا از همان‌جا می‌آید', en: 'That is where the subject comes from' },
  blockedBody: {
    fa: 'چیزی ساخته نشد، چون کارخانه از خودش کسب‌وکاری اختراع نمی‌کند. این‌ها هنوز خالی‌اند:',
    en: 'Nothing was produced, because the factory does not invent a business of its own. These are still empty:',
  },
  blockedCta: { fa: 'رفتن به پروفایل بیزینس', en: 'Go to the business profile' },
  blockedAfter: {
    fa: 'بعد از پر کردنشان همین‌جا برگرد و دوباره بساز.',
    en: 'Fill them in, come back here and produce again.',
  },

  // produce form
  produce: { fa: 'ساخت بَچ', en: 'Produce a batch' },
  produceTitle: { fa: 'چند تکه، برای کدام کانال', en: 'How many pieces, for which channels' },
  produceSub: { fa: 'زمان‌بندی خودکار انجام می‌شود', en: 'The schedule is laid out for you' },
  countLabel: { fa: 'چند تکه', en: 'How many pieces' },
  countHint: { fa: 'بین ۱ تا {max} تکه در هر بَچ.', en: 'Between 1 and {max} pieces per batch.' },
  perDayLabel: { fa: 'چند تا در روز', en: 'How many a day' },
  perDayHint: {
    fa: 'تکه‌ها با همین آهنگ روی روزهای بعد پخش می‌شوند.',
    en: 'The pieces are spread over the coming days at this rate.',
  },
  channelsLabel: { fa: 'کانال‌ها', en: 'Channels' },
  channelsHint: {
    fa: 'اگر هیچ‌کدام را انتخاب نکنی، کانال‌های پروفایل بیزینس استفاده می‌شوند.',
    en: 'Pick none and the channels from your business profile are used.',
  },
  localeNote: {
    fa: 'متن‌ها به زبانی نوشته می‌شوند که برنامه الان نشان می‌دهد.',
    en: 'The pieces are written in the language the app is showing right now.',
  },
  produceNow: { fa: 'بنویس و زمان‌بندی کن', en: 'Write and schedule' },
  producingNow: { fa: 'در حال نوشتن…', en: 'Writing…' },
  producedLine: { fa: 'ساخته‌شده در آخرین بَچ', en: 'Made in the last batch' },
  producedByLabel: { fa: 'نویسنده', en: 'Written by' },

  // publish
  publish: { fa: 'انتشار', en: 'Publishing' },
  publishTitle: { fa: 'همین حالا منتشر کن', en: 'Publish what is due' },
  publishSub: { fa: 'یک دور کامل روی نوبت‌های رسیده', en: 'One pass over everything already due' },
  publishNow: { fa: 'انتشار نوبت‌های رسیده', en: 'Publish due pieces' },
  publishingNow: { fa: 'در حال انتشار…', en: 'Publishing…' },
  publishedCount: { fa: 'در آخرین دور بیرون رفت', en: 'Went out on the last pass' },
  pendingCount: { fa: 'هنوز در نوبت', en: 'Still pending' },
  publishNote: {
    fa: 'تکه‌ای که زمانش نرسیده در نوبت می‌ماند؛ این دکمه زمان‌بندی را جلو نمی‌اندازد.',
    en: 'A piece whose hour has not come stays pending; this button does not pull the schedule forward.',
  },

  // list
  list: { fa: 'تکه‌ها', en: 'The pieces' },
  listTitle: { fa: 'چیزی که ساخته و زمان‌بندی شده', en: 'What is written and scheduled' },
  listSub: { fa: 'تازه‌ترین‌ها اول', en: 'Newest first' },
  all: { fa: 'همه', en: 'all' },
  filterStatus: { fa: 'وضعیت', en: 'Status' },
  filterChannel: { fa: 'کانال', en: 'Channel' },
  empty: { fa: 'هنوز تکه‌ای ساخته نشده.', en: 'Nothing has been produced yet.' },
  emptyFiltered: { fa: 'با این فیلتر چیزی نیست.', en: 'Nothing matches this filter.' },
  loading: { fa: 'در حال بارگذاری…', en: 'Loading…' },
  due: { fa: 'زمان انتشار', en: 'Due' },
  publishedAt: { fa: 'منتشر شده در', en: 'Published' },
  overdue: { fa: 'زمانش رسیده', en: 'due now' },
  read: { fa: 'خواندن متن', en: 'Read the piece' },
  hide: { fa: 'بستن متن', en: 'Hide the piece' },
  remove: { fa: 'حذف', en: 'Delete' },
  reference: { fa: 'کد پیگیری کانال', en: 'Channel reference' },
  failedNote: { fa: 'دلیل شکست', en: 'Why it failed' },

  // failures
  offline: {
    fa: 'API در دسترس نیست، بنابراین فهرست خالی است و چیزی ساخته یا منتشر نمی‌شود.',
    en: 'The API is unreachable, so the list is empty and nothing can be produced or published.',
  },
  retry: { fa: 'تلاش دوباره', en: 'Try again' },
  errorValidation: { fa: 'درخواست پذیرفته نشد:', en: 'The request was rejected:' },
  errorServer: { fa: 'سرور نتوانست این کار را انجام دهد.', en: 'The server could not do that.' },
  errorOffline: { fa: 'سرور در دسترس نیست. بعداً دوباره امتحان کن.', en: 'The server is unreachable. Try again later.' },
} satisfies Record<string, Bi>

const CHANNEL_LABEL: Record<ContentChannel, Bi> = {
  instagram: { fa: 'اینستاگرام', en: 'Instagram' },
  telegram: { fa: 'تلگرام', en: 'Telegram' },
  linkedin: { fa: 'لینکدین', en: 'LinkedIn' },
  youtube: { fa: 'یوتیوب', en: 'YouTube' },
  website: { fa: 'وب‌سایت', en: 'Website' },
}

const STATUS_LABEL: Record<ContentStatus, Bi> = {
  pending: { fa: 'در نوبت', en: 'pending' },
  sent: { fa: 'فرستاده‌شده', en: 'sent' },
  simulated: { fa: 'شبیه‌سازی', en: 'simulated' },
  failed: { fa: 'ناموفق', en: 'failed' },
}

const STATUS_TONE: Record<ContentStatus, ChipTone> = {
  pending: 'neutral',
  sent: 'warm',
  simulated: 'accent',
  failed: 'hot',
}

const KIND_LABEL: Record<string, Bi> = {
  voice: { fa: 'گویندگی', en: 'voiceover' },
  video: { fa: 'ویدیو', en: 'video' },
  copy: { fa: 'پست', en: 'post' },
}

const ANGLE_LABEL: Record<string, Bi> = {
  problem: { fa: 'قلاب مشکل', en: 'problem hook' },
  offer: { fa: 'پیشنهاد', en: 'offer' },
  objection: { fa: 'پاسخ به تردید', en: 'objection' },
  start: { fa: 'اولین قدم', en: 'first step' },
  question: { fa: 'سؤال', en: 'question' },
}

/** `producedBy` decides whether the reader is looking at model copy or a template. */
const SOURCE_LABEL: Record<string, Bi> = {
  claude: { fa: 'نوشته‌ی مدل', en: 'written by Claude' },
  template: { fa: 'قالب آماده', en: 'from a template' },
}

/** A `field:code` note names a field the built-in dictionary does not carry. */
const NOTE_LABEL: Record<string, Bi> = {
  target: { fa: 'مقصد انتشار در کانال', en: 'Publishing target on the channel' },
}

const bi = (map: Record<string, Bi>, key: string | null): Bi =>
  (key && map[key]) || { fa: key ?? '', en: key ?? '' }

/** Persian and Arabic keyboards produce their own digits; the API wants ASCII. */
const toLatinDigits = (input: string) =>
  input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const fa = '۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)
    return String(fa >= 0 ? fa : '٠١٢٣٤٥٦٧٨٩'.indexOf(ch))
  })

/** A stored timestamp, in the reader's digits. Dates are data, spacing is chrome. */
function stamp(iso: string | null, digits: (value: string) => string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return digits(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return digits(
    `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
  )
}

const SHELL =
  'w-full rounded-xl border border-hairline bg-black/40 px-3.5 py-2.5 text-[12.5px] text-white/85 outline-none placeholder:text-white/25 focus:border-accent/50'

/**
 * The content factory: the page behind the `factory` node and the five channel
 * nodes on the sales board. It produces a batch, shows what is scheduled, and
 * runs one publishing pass. The interesting case is the 409 — an empty business
 * profile is not an error to display, it is a form to go and fill in.
 */
export default function Content() {
  const { t, n, num, locale } = useI18n()
  const {
    pieces,
    pending,
    statuses,
    delivery,
    filter,
    loading,
    producing,
    publishing,
    online,
    error,
    lastProduced,
    lastPublished,
    setFilter,
    produce,
    publishNow,
    remove,
    refresh,
    clearError,
  } = useContent()

  const [count, setCount] = useState(String(CONTENT_DEFAULTS.count))
  const [perDay, setPerDay] = useState(String(CONTENT_DEFAULTS.perDay))
  const [channels, setChannels] = useState<ContentChannel[]>([])
  const [opened, setOpened] = useState<number | null>(null)

  const toggleChannel = (channel: ContentChannel) => {
    clearError()
    setChannels((prev) => (prev.includes(channel) ? prev.filter((item) => item !== channel) : [...prev, channel]))
  }

  const clamp = (raw: string, max: number) => {
    const digits = toLatinDigits(raw).replace(/\D/g, '').slice(0, 2)
    if (!digits) return ''
    return String(Math.min(max, Math.max(1, Number(digits))))
  }

  const askedCount = Number(count) || CONTENT_DEFAULTS.count
  const askedPerDay = Number(perDay) || CONTENT_DEFAULTS.perDay

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (producing || !online) return
    await produce({ count: askedCount, perDay: askedPerDay, channels, locale })
  }

  const blocked = error?.kind === 'incomplete'
  const plainError =
    error?.kind === 'validation'
      ? COPY.errorValidation
      : error?.kind === 'server'
        ? COPY.errorServer
        : error?.kind === 'offline'
          ? COPY.errorOffline
          : null

  const filtered = Boolean(filter.status || filter.channel)

  return (
    <AppShell>
      <PageBanner
        icon="Factory"
        title={COPY.title}
        subtitle={COPY.subtitle}
        actions={
          <Link
            to="/sales-automation"
            aria-label={t(COPY.backToBoard)}
            title={t(COPY.backToBoard)}
            className="text-white/70 transition hover:text-white"
          >
            <Icon name="ChevronLeft" size={18} className="rtl:rotate-180" />
          </Link>
        }
      />

      {/* The 409 comes first: nothing else on this page can work until it is gone. */}
      {blocked && (
        <Card className="mt-4">
          <CardHead
            icon="Briefcase"
            kicker={COPY.blockedKicker}
            title={t(COPY.blockedTitle)}
            subtitle={t(COPY.blockedSub)}
            gradient={['#7c2d12', '#ff6b3d']}
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">{t(COPY.blockedBody)}</p>
          <ul className="mt-2 list-disc space-y-1 ps-4 text-[12px] text-white/80 marker:text-[#ff9a76]">
            {error.messages.map((code) => (
              <li key={code}>{t(explainCode(code, undefined, n))}</li>
            ))}
          </ul>
          <Link
            to="/business"
            className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(100deg,#4c1d95,#7c3aed)] py-2.5 text-[12.5px] font-medium text-white transition hover:brightness-110"
          >
            <Icon name="ArrowUpRight" size={14} />
            {t(COPY.blockedCta)}
          </Link>
          <p className="mt-2 text-center text-[10.5px] text-white/35">{t(COPY.blockedAfter)}</p>
        </Card>
      )}

      {!online && (
        <div className="mt-4 rounded-xl border border-hairline bg-white/[0.03] px-3 py-2.5">
          <p className="text-[11.5px] text-white/45">{t(COPY.offline)}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-2 rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/60 transition hover:border-accent/50 hover:text-white"
          >
            {t(COPY.retry)}
          </button>
        </div>
      )}

      <Card className="mt-3">
        <CardHead
          icon="Workflow"
          kicker={COPY.how}
          title={t(COPY.howTitle)}
          subtitle={t(COPY.howSub)}
          gradient={['#4c1d95', '#8b5cf6']}
        />
        <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">{t(COPY.howBody)}</p>
      </Card>

      <Card className="mt-3">
        <CardHead
          icon="Shield"
          kicker={COPY.delivery}
          title={t(COPY.deliveryTitle)}
          subtitle={t(COPY.deliverySub)}
          gradient={['#155e75', '#22d3ee']}
        />
        <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">{t(COPY.deliveryBody)}</p>
        {Object.keys(delivery).length === 0 ? (
          <p className="mt-2 text-[11px] text-white/30">{t(COPY.deliveryUnknown)}</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {CONTENT_CHANNELS.filter((channel) => delivery[channel]).map((channel) => (
              <li key={channel} className="flex items-center gap-2.5">
                <NodeIcon icon={channel} size={22} />
                <span className="text-[12px] text-white/70">{t(CHANNEL_LABEL[channel])}</span>
                <span className="ms-auto">
                  <Chip tone={delivery[channel] === 'live' ? 'warm' : 'accent'}>
                    {t(delivery[channel] === 'live' ? COPY.live : COPY.simulated)}
                  </Chip>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-3">
        <CardHead
          icon="Pencil"
          kicker={COPY.produce}
          title={t(COPY.produceTitle)}
          subtitle={t(COPY.produceSub)}
          gradient={['#6d28d9', '#8b5cf6']}
        />

        <form className="mt-4 flex flex-col gap-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={COPY.countLabel}
              htmlFor="content-count"
              hint={{
                fa: COPY.countHint.fa.replace('{max}', n(String(CONTENT_LIMITS.count))),
                en: COPY.countHint.en.replace('{max}', String(CONTENT_LIMITS.count)),
              }}
            >
              <input
                id="content-count"
                inputMode="numeric"
                value={n(count)}
                onChange={(event) => {
                  clearError()
                  setCount(clamp(event.target.value, CONTENT_LIMITS.count))
                }}
                className={`${SHELL} mt-1.5 text-start`}
              />
            </Field>

            <Field label={COPY.perDayLabel} htmlFor="content-per-day" hint={COPY.perDayHint}>
              <input
                id="content-per-day"
                inputMode="numeric"
                value={n(perDay)}
                onChange={(event) => {
                  clearError()
                  setPerDay(clamp(event.target.value, CONTENT_LIMITS.perDay))
                }}
                className={`${SHELL} mt-1.5 text-start`}
              />
            </Field>
          </div>

          <Field label={COPY.channelsLabel} htmlFor="content-channels" hint={COPY.channelsHint}>
            <div id="content-channels" className="mt-1.5 flex flex-wrap gap-1.5">
              {CONTENT_CHANNELS.map((channel) => {
                const on = channels.includes(channel)
                return (
                  <button
                    key={channel}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleChannel(channel)}
                    className={`inline-flex items-center gap-1.5 rounded-full py-1 pe-3 ps-1 text-[11px] transition ${
                      on ? 'bg-accent text-white' : 'border border-hairline bg-white/[0.03] text-white/50 hover:text-white/85'
                    }`}
                  >
                    <NodeIcon icon={channel} size={20} />
                    {t(CHANNEL_LABEL[channel])}
                  </button>
                )
              })}
            </div>
          </Field>

          <p className="text-[10.5px] text-white/30">{t(COPY.localeNote)}</p>

          {plainError && (
            <div className="rounded-xl border border-[#ff6b3d]/40 bg-[#ff6b3d]/10 px-3 py-2.5">
              <p className="text-[11.5px] text-[#ff9a76]">{t(plainError)}</p>
              {error && error.messages.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-1 ps-4 text-[11.5px] text-white/70 marker:text-[#ff9a76]">
                  {error.messages.map((code) => (
                    <li key={code}>{t(explainCode(code, undefined, n))}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <PrimaryButton type="submit" disabled={producing || !online}>
              {t(producing ? COPY.producingNow : COPY.produceNow)}
            </PrimaryButton>
            {lastProduced && (
              <div className="mt-2">
                <Row label={t(COPY.producedLine)} value={num(lastProduced.count)} />
                <Row
                  label={t(COPY.producedByLabel)}
                  value={t(bi(SOURCE_LABEL, lastProduced.producedBy))}
                />
              </div>
            )}
          </div>
        </form>
      </Card>

      <Card className="mt-3">
        <CardHead
          icon="Send"
          kicker={COPY.publish}
          title={t(COPY.publishTitle)}
          subtitle={t(COPY.publishSub)}
          gradient={['#065f46', '#34d399']}
        />
        <div className="mt-3">
          <Row label={t(COPY.pendingCount)} value={online ? num(pending) : '—'} />
          {lastPublished && <Row label={t(COPY.publishedCount)} value={num(lastPublished.published)} />}
        </div>
        <p className="mt-1 text-[10.5px] leading-relaxed text-white/30">{t(COPY.publishNote)}</p>
        <div className="mt-3">
          <PrimaryButton onClick={() => void publishNow()} disabled={publishing || !online}>
            {t(publishing ? COPY.publishingNow : COPY.publishNow)}
          </PrimaryButton>
        </div>
      </Card>

      <Card className="mt-3">
        <CardHead
          icon="Layers"
          kicker={COPY.list}
          title={t(COPY.listTitle)}
          subtitle={t(COPY.listSub)}
          gradient={['#3730a3', '#6366f1']}
        />

        <div className="mt-3 space-y-2">
          <FilterRow label={COPY.filterStatus}>
            <FilterButton on={filter.status === ''} onClick={() => setFilter({ status: '' })}>
              {t(COPY.all)}
            </FilterButton>
            {statuses.map((status) => (
              <FilterButton
                key={status}
                on={filter.status === status}
                onClick={() => setFilter({ status })}
              >
                {t(STATUS_LABEL[status] ?? { fa: status, en: status })}
              </FilterButton>
            ))}
          </FilterRow>

          <FilterRow label={COPY.filterChannel}>
            <FilterButton on={filter.channel === ''} onClick={() => setFilter({ channel: '' })}>
              {t(COPY.all)}
            </FilterButton>
            {CONTENT_CHANNELS.map((channel) => (
              <FilterButton
                key={channel}
                on={filter.channel === channel}
                onClick={() => setFilter({ channel })}
              >
                {t(CHANNEL_LABEL[channel])}
              </FilterButton>
            ))}
          </FilterRow>
        </div>

        <div className="mt-3 space-y-2">
          {loading ? (
            <p className="py-4 text-center text-[11.5px] text-white/30">{t(COPY.loading)}</p>
          ) : pieces.length === 0 ? (
            <p className="py-4 text-center text-[11.5px] text-white/30">
              {t(!online ? COPY.offline : filtered ? COPY.emptyFiltered : COPY.empty)}
            </p>
          ) : (
            pieces.map((piece) => (
              <PieceRow
                key={piece.id}
                piece={piece}
                open={opened === piece.id}
                onToggle={() => setOpened((prev) => (prev === piece.id ? null : piece.id))}
                onRemove={() => void remove(piece.id)}
              />
            ))
          )}
        </div>
      </Card>
    </AppShell>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: Bi
  htmlFor: string
  hint?: Bi
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <div>
      <label htmlFor={htmlFor} className="text-[11.5px] text-white/70">
        {t(label)}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/30">{t(hint)}</p>}
    </div>
  )
}

function FilterRow({ label, children }: { label: Bi; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="me-1 text-[10px] text-white/30">{t(label)}</span>
      {children}
    </div>
  )
}

function FilterButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[10.5px] transition ${
        on ? 'bg-accent/25 text-white' : 'border border-hairline bg-white/[0.03] text-white/45 hover:text-white/85'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * One scheduled piece. The chrome around it is bilingual; the title and the
 * body are the generated content itself, in whichever language it was written,
 * so they are rendered raw the way a message body is.
 */
function PieceRow({
  piece,
  open,
  onToggle,
  onRemove,
}: {
  piece: ContentPiece
  open: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const { t, n } = useI18n()
  const overdue = piece.status === 'pending' && new Date(piece.dueAt).getTime() <= Date.now()

  // A failed piece carries the reason as a `field:code`; the server writes no prose.
  const noteCode = piece.status === 'failed' && piece.note?.includes(':') ? piece.note : null
  const noteField = noteCode?.split(':')[0] ?? ''

  return (
    <article className="rounded-xl border border-hairline bg-white/[0.02] p-3">
      <div className="flex items-start gap-2.5">
        <NodeIcon icon={piece.channel} size={26} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[12.5px] font-medium leading-snug text-white/90">{piece.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip tone={STATUS_TONE[piece.status]}>{t(STATUS_LABEL[piece.status])}</Chip>
            <Chip>{t(bi(KIND_LABEL, piece.kind))}</Chip>
            {piece.angle && <Chip>{t(bi(ANGLE_LABEL, piece.angle))}</Chip>}
            <Chip tone={piece.producedBy === 'claude' ? 'accent' : 'neutral'}>
              {t(bi(SOURCE_LABEL, piece.producedBy))}
            </Chip>
            {overdue && <Chip tone="hot">{t(COPY.overdue)}</Chip>}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[10.5px] text-white/35">
        <span>
          {t(COPY.due)} <span className="text-white/55 tabular-nums">{stamp(piece.dueAt, n)}</span>
        </span>
        {piece.publishedAt && (
          <span>
            {t(COPY.publishedAt)}{' '}
            <span className="text-white/55 tabular-nums">{stamp(piece.publishedAt, n)}</span>
          </span>
        )}
      </div>

      {noteCode && (
        <p className="mt-2 text-[11px] text-[#ff9a76]">
          {t(COPY.failedNote)}: {t(explainCode(noteCode, NOTE_LABEL[noteField] ?? CHANNEL_LABEL[noteField as ContentChannel], n))}
        </p>
      )}

      {open && (
        <>
          <p className="mt-2.5 whitespace-pre-wrap rounded-lg border border-hairline bg-black/30 px-3 py-2.5 text-[12px] leading-relaxed text-white/80">
            {piece.body}
          </p>
          {piece.note && !noteCode && (
            <p className="mt-1.5 text-[10px] text-white/25">
              {t(COPY.reference)}: <span dir="ltr">{piece.note}</span>
            </p>
          )}
        </>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/60 transition hover:border-accent/50 hover:text-white"
        >
          {t(open ? COPY.hide : COPY.read)}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="ms-auto rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/40 transition hover:border-[#ff6b3d]/50 hover:text-[#ff9a76]"
        >
          {t(COPY.remove)}
        </button>
      </div>
    </article>
  )
}
