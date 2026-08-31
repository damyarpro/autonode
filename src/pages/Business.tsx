import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PageBanner from '../components/PageBanner'
import { Card, CardHead, PrimaryButton, ProgressBar, Row } from '../components/Card'
import Chip from '../components/Chip'
import { Icon } from '../components/Icon'
import { NodeIcon } from '../components/icons'
import {
  BUSINESS_CHANNELS,
  BUSINESS_LIMITS,
  BUSINESS_TONES,
  DESTINATION_LIMIT,
  emptyDestinations,
  useBusiness,
  type BusinessChannel,
  type BusinessProfile,
  type BusinessTone,
  type ChannelDestinations,
} from '../api/useBusiness'
import { toLatinDigits } from '../i18n/format'
import { useI18n } from '../i18n/I18nProvider'
import type { Bi } from '../data/types'

const COPY = {
  title: { fa: 'پروفایل بیزینس', en: 'Business profile' },
  subtitle: { fa: 'پایه‌ی هر متنی که هوش مصنوعی می‌نویسد', en: 'The base for everything the AI writes' },
  backToProfile: { fa: 'بازگشت به پروفایل', en: 'Back to profile' },

  why: { fa: 'چرا مهم است', en: 'Why it matters' },
  whyTitle: { fa: 'یک بار پر کن، همه‌جا خوانده می‌شود', en: 'Fill it once, it is read everywhere' },
  whySub: { fa: 'مربی، ابزارها و متن‌های پیگیری', en: 'The coach, the tools and the outreach copy' },
  whyBody: {
    fa: 'مربی، هفت ابزار هوش مصنوعی و متن‌های پیگیری، پیش از نوشتن هر جمله همین پروفایل را می‌خوانند. تا وقتی خالی باشد فقط می‌توانند کلی حرف بزنند؛ با پر شدنش، هر خروجی درباره‌ی همین کسب‌وکار و همین مخاطب نوشته می‌شود.',
    en: 'The coach, the seven AI tools and the outreach copy all read this profile before they write a line. While it is empty they can only stay general; once it is filled every output is about this business and this audience.',
  },

  status: { fa: 'وضعیت', en: 'Status' },
  statusTitle: { fa: 'کامل بودن پروفایل', en: 'Profile completeness' },
  statusSub: { fa: 'بر اساس آخرین چیزی که ذخیره شده', en: 'Based on what is stored right now' },
  ready: { fa: 'کامل', en: 'Complete' },
  incomplete: { fa: 'ناقص', en: 'Incomplete' },
  readyBody: {
    fa: 'پروفایل کامل است و در هر خروجی هوش مصنوعی استفاده می‌شود.',
    en: 'The profile is complete and is used in every AI output.',
  },
  incompleteBody: {
    fa: 'تا این‌ها پر نشوند، پاسخ‌ها کلی می‌مانند:',
    en: 'Until these are filled in, the answers stay generic:',
  },
  requiredCount: { fa: 'فیلدهای الزامی', en: 'Required fields' },

  form: { fa: 'اطلاعات کسب‌وکار', en: 'Business details' },
  formTitle: { fa: 'فرم پروفایل', en: 'The profile form' },
  formSub: { fa: 'هرچه دقیق‌تر، خروجی دقیق‌تر', en: 'The more precise, the better the output' },
  required: { fa: 'الزامی', en: 'required' },

  nameLabel: { fa: 'نام کسب‌وکار', en: 'Business name' },
  namePlaceholder: { fa: 'نامی که مشتری با آن می‌شناسدت', en: 'The name your buyers know you by' },
  sellLabel: { fa: 'چه می‌فروشی؟', en: 'What do you sell?' },
  sellPlaceholder: {
    fa: 'محصول یا خدمت، و نتیجه‌ای که به مشتری می‌دهد',
    en: 'The product or service, and the result it gives the buyer',
  },
  sellHint: {
    fa: 'همان جمله‌ای که سر یک قرار می‌گویی؛ مدل عیناً از همین می‌سازد.',
    en: 'The sentence you would say on a call; the model builds on exactly this.',
  },
  audienceLabel: { fa: 'مخاطبت کیست؟', en: 'Who is it for?' },
  audiencePlaceholder: {
    fa: 'چه کسی، با چه مشکلی، در چه مرحله‌ای',
    en: 'Who they are, what problem they have, where they are',
  },
  toneLabel: { fa: 'لحن نوشتن', en: 'Writing voice' },
  toneHint: {
    fa: 'هر متنی که تولید می‌شود با همین لحن نوشته می‌شود.',
    en: 'Everything generated is written in this voice.',
  },
  priceLabel: { fa: 'قیمت معمول (تومان)', en: 'Typical price (Toman)' },
  priceHint: {
    fa: 'عدد را به تومان بنویس؛ خالی یعنی هنوز قیمتی اعلام نشده.',
    en: 'Enter the amount in Toman; empty means no price is quoted yet.',
  },
  priceShown: { fa: 'نمایش در برنامه', en: 'Shown in the app as' },
  channelsLabel: { fa: 'کانال‌های فعال', en: 'Active channels' },
  channelsHint: {
    fa: 'جایی که واقعاً منتشر می‌کنی؛ محتوا برای همین‌ها نوشته می‌شود.',
    en: 'Where you actually publish; the copy is written for these.',
  },
  channelsNone: { fa: 'هنوز کانالی انتخاب نشده.', en: 'No channel picked yet.' },

  destinations: { fa: 'مقصد انتشار هر کانال', en: 'Where each channel publishes' },
  destinationsWhy: {
    fa: 'کانالی که مقصد ندارد نمی‌تواند منتشر کند: محتوایش با خطای «مقصد انتشار» ناموفق می‌ماند. هر کدام اختیاری است و هر وقت خواستی می‌توانی پرش کنی.',
    en: 'A channel with no destination cannot publish: its pieces fail with a publishing-target error. Each one is optional and can be filled in whenever you like.',
  },
  ctaLabel: { fa: 'لینک دعوت به اقدام', en: 'Call-to-action link' },
  ctaPlaceholder: { fa: 'https://…', en: 'https://…' },
  ctaHint: {
    fa: 'باید با http یا https شروع شود؛ همین لینک ته پیام‌ها می‌آید.',
    en: 'Must start with http or https; this is the link the messages end on.',
  },
  notesLabel: { fa: 'نکته‌های دیگر', en: 'Other notes' },
  notesPlaceholder: {
    fa: 'هرچه مدل باید بداند: محدودیت‌ها، رقبا، کلمه‌هایی که نباید به کار برود',
    en: 'Anything the model should know: limits, rivals, words to avoid',
  },

  save: { fa: 'ذخیره‌ی پروفایل', en: 'Save profile' },
  savingNow: { fa: 'در حال ذخیره…', en: 'Saving…' },
  savedNow: { fa: 'ذخیره شد', en: 'Saved' },
  saveBlocked: { fa: 'برای ذخیره، سه فیلد الزامی را پر کن.', en: 'Fill the three required fields to save.' },
  saveRejected: { fa: 'ذخیره انجام نشد:', en: 'The save was rejected:' },
  errorOffline: {
    fa: 'سرور در دسترس نیست. بعداً دوباره امتحان کن.',
    en: 'The server is unreachable. Try again later.',
  },
  errorServer: { fa: 'ذخیره روی سرور شکست خورد.', en: 'The save failed on the server.' },
  offline: {
    fa: 'API در دسترس نیست، بنابراین فرم خالی است و ذخیره ممکن نیست.',
    en: 'The API is unreachable, so the form is empty and nothing can be saved.',
  },
  retry: { fa: 'تلاش دوباره', en: 'Try again' },
  loading: { fa: 'در حال بارگذاری…', en: 'Loading…' },
} satisfies Record<string, Bi>

const TONE_COPY: Record<BusinessTone, { label: Bi; hint: Bi }> = {
  friendly: {
    label: { fa: 'صمیمی', en: 'Friendly' },
    hint: { fa: 'گرم و ساده، مثل یک همکار کمک‌حال', en: 'Warm and plain-spoken, like a helpful peer' },
  },
  expert: {
    label: { fa: 'تخصصی', en: 'Expert' },
    hint: { fa: 'دقیق و مستند، بدون لحن تبلیغاتی', en: 'Precise and evidence-led, never salesy' },
  },
  direct: {
    label: { fa: 'مستقیم', en: 'Direct' },
    hint: { fa: 'کوتاه و صریح؛ قدم بعدی را در یک خط بگو', en: 'Short and blunt; the next action in one line' },
  },
  playful: {
    label: { fa: 'شوخ', en: 'Playful' },
    hint: { fa: 'سبک و انسانی، اما نه سرسری درباره‌ی پول', en: 'Light and human, but never silly about money' },
  },
}

const CHANNEL_LABEL: Record<BusinessChannel, Bi> = {
  instagram: { fa: 'اینستاگرام', en: 'Instagram' },
  telegram: { fa: 'تلگرام', en: 'Telegram' },
  linkedin: { fa: 'لینکدین', en: 'LinkedIn' },
  youtube: { fa: 'یوتیوب', en: 'YouTube' },
  website: { fa: 'وب‌سایت', en: 'Website' },
}

/**
 * What each channel wants as an address. The server deliberately checks none of
 * these shapes — a guessed pattern would reject a value that works — so this
 * copy is the only place the owner is told what to paste in.
 */
const DESTINATION_COPY: Record<BusinessChannel, { label: Bi; hint: Bi; placeholder: Bi }> = {
  instagram: {
    label: { fa: 'مقصد اینستاگرام', en: 'Instagram destination' },
    hint: { fa: 'شناسه‌ی اکانت بیزینسی اینستاگرام', en: 'The Instagram business account id' },
    placeholder: { fa: '۱۷۸۴۱…', en: '17841…' },
  },
  telegram: {
    label: { fa: 'مقصد تلگرام', en: 'Telegram destination' },
    hint: { fa: '@نام کانال، یا شناسه‌ی عددی چت', en: 'The channel @name, or the numeric chat id' },
    placeholder: { fa: '@نام‌کانال', en: '@yourchannel' },
  },
  linkedin: {
    label: { fa: 'مقصد لینکدین', en: 'LinkedIn destination' },
    hint: { fa: 'شناسه‌ی URN سازمان یا شخصی که پست از طرف او می‌رود', en: 'The organization or person URN you post as' },
    placeholder: { fa: 'urn:li:organization:…', en: 'urn:li:organization:…' },
  },
  youtube: {
    label: { fa: 'مقصد یوتیوب', en: 'YouTube destination' },
    hint: { fa: 'شناسه‌ی کانال یوتیوب', en: 'The YouTube channel id' },
    placeholder: { fa: 'UC…', en: 'UC…' },
  },
  website: {
    label: { fa: 'مقصد وب‌سایت', en: 'Website destination' },
    hint: { fa: 'نشانی‌ای که سایتت مطلب را روی آن منتشر می‌کند', en: 'The URL your site publishes to' },
    placeholder: { fa: 'https://…', en: 'https://…' },
  },
}

const FIELD_LABEL: Record<string, Bi> = {
  name: COPY.nameLabel,
  whatWeSell: COPY.sellLabel,
  audience: COPY.audienceLabel,
  tone: COPY.toneLabel,
  priceToman: COPY.priceLabel,
  channels: COPY.channelsLabel,
  ctaUrl: COPY.ctaLabel,
  notes: COPY.notesLabel,
  // A rejected destination names its channel as the field, so `telegram:too_long:200`
  // reads as a sentence about that channel's destination and not about the channel.
  ...Object.fromEntries(BUSINESS_CHANNELS.map((channel) => [channel, DESTINATION_COPY[channel].label])),
}

/**
 * The server answers with machine-readable `field:code` strings — both the
 * `missing` list and the validation errors — precisely so the client, which
 * drew the form, can say them in the reader's language.
 */
function explainCode(code: string, digits: (value: string) => string): Bi {
  const [fieldId, rule, arg] = code.split(':')
  const label = FIELD_LABEL[fieldId ?? ''] ?? { fa: fieldId ?? '', en: fieldId ?? '' }

  switch (rule) {
    case 'required':
      return { fa: `«${label.fa}» را پر کن.`, en: `“${label.en}” is still empty.` }
    case 'too_long':
      return {
        fa: `«${label.fa}» از ${digits(arg ?? '')} نویسه بلندتر است.`,
        en: `“${label.en}” is longer than ${arg ?? ''} characters.`,
      }
    case 'not_a_url':
      return {
        fa: `«${label.fa}» باید یک نشانی کامل با http یا https باشد.`,
        en: `“${label.en}” must be a full address starting with http or https.`,
      }
    case 'not_an_option':
      return {
        fa: `مقدار انتخاب‌شده برای «${label.fa}» معتبر نیست.`,
        en: `That is not a valid option for “${label.en}”.`,
      }
    case 'not_a_number':
      return { fa: `«${label.fa}» باید یک عدد مثبت باشد.`, en: `“${label.en}” must be a positive number.` }
    case 'not_text':
      return { fa: `«${label.fa}» باید متن باشد.`, en: `“${label.en}” must be text.` }
    default:
      // An unknown code is still better shown than swallowed.
      return { fa: code, en: code }
  }
}

type Form = {
  name: string
  whatWeSell: string
  audience: string
  tone: BusinessTone
  price: string
  channels: BusinessChannel[]
  ctaUrl: string
  notes: string
  /** Empty string is "not set"; the route stores that as null. */
  destinations: Record<BusinessChannel, string>
}

const formOf = (business: BusinessProfile): Form => ({
  name: business.name,
  whatWeSell: business.whatWeSell,
  audience: business.audience,
  tone: business.tone,
  price: business.priceToman > 0 ? String(business.priceToman) : '',
  channels: business.channels,
  ctaUrl: business.ctaUrl ?? '',
  notes: business.notes ?? '',
  destinations: Object.fromEntries(
    BUSINESS_CHANNELS.map((channel) => [channel, business.destinations?.[channel] ?? '']),
  ) as Record<BusinessChannel, string>,
})

/** Persian and Arabic keyboards produce their own digits; the API wants ASCII. */
const REQUIRED_TOTAL = 3

/**
 * What the route stores: trimmed, and blank cleared to null rather than kept as
 * an empty string a publisher would read as an address.
 */
const trimmedDestinations = (destinations: Record<BusinessChannel, string>): ChannelDestinations => {
  const next = emptyDestinations()
  for (const channel of BUSINESS_CHANNELS) next[channel] = destinations[channel].trim() || null
  return next
}

export default function Business() {
  const { t, n, num } = useI18n()
  const { business, missing, loading, saving, savedAt, online, error, save, refresh, clearError } = useBusiness()

  const [form, setForm] = useState<Form>(() => formOf(business))
  const [justSaved, setJustSaved] = useState(false)

  // The profile object only changes when the server answers, so re-seeding here
  // never overwrites something the owner is still typing.
  useEffect(() => {
    setForm(formOf(business))
  }, [business])

  useEffect(() => {
    if (!savedAt) return
    setJustSaved(true)
    const timer = window.setTimeout(() => setJustSaved(false), 2400)
    return () => window.clearTimeout(timer)
  }, [savedAt])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    clearError()
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleChannel = (channel: BusinessChannel) =>
    set(
      'channels',
      form.channels.includes(channel)
        ? form.channels.filter((item) => item !== channel)
        : [...form.channels, channel],
    )

  const setDestination = (channel: BusinessChannel, value: string) =>
    set('destinations', { ...form.destinations, [channel]: value })

  const price = Number(form.price) || 0
  const blocked = !form.name.trim() || !form.whatWeSell.trim() || !form.audience.trim()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || blocked) return
    // Every field goes in every save, so the route never sees an empty patch.
    await save({
      name: form.name.trim(),
      whatWeSell: form.whatWeSell.trim(),
      audience: form.audience.trim(),
      tone: form.tone,
      priceToman: price,
      channels: form.channels,
      ctaUrl: form.ctaUrl.trim(),
      notes: form.notes.trim(),
      destinations: trimmedDestinations(form.destinations),
    })
  }

  const errorLine =
    error?.kind === 'offline' ? COPY.errorOffline : error?.kind === 'server' ? COPY.errorServer : COPY.saveRejected

  const filled = Math.max(0, REQUIRED_TOTAL - missing.length)

  return (
    <AppShell>
      <PageBanner
        icon="Briefcase"
        title={COPY.title}
        subtitle={COPY.subtitle}
        actions={
          <Link
            to="/profile"
            aria-label={t(COPY.backToProfile)}
            title={t(COPY.backToProfile)}
            className="text-white/70 transition hover:text-white"
          >
            <Icon name="ChevronLeft" size={18} className="rtl:rotate-180" />
          </Link>
        }
      />

      {/* Why the form exists and how far it has got is context, not work: on a
          wide screen it rides beside the form instead of pushing it down. */}
      <div className="mt-4 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,330px)] lg:gap-5">
        <div className="space-y-3 lg:sticky lg:top-8 lg:order-2">
          <Card>
            <CardHead
              icon="Sparkles"
              kicker={COPY.why}
              title={t(COPY.whyTitle)}
              subtitle={t(COPY.whySub)}
              gradient={['#4c1d95', '#8b5cf6']}
            />
            <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">{t(COPY.whyBody)}</p>
          </Card>

          {!online && (
            <div className="rounded-xl border border-hairline bg-white/[0.03] px-3 py-2.5">
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

      {online && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] text-white/35">{t(COPY.status)}</div>
              <h2 className="text-[14px] font-semibold text-white/90">{t(COPY.statusTitle)}</h2>
              <p className="text-[10.5px] text-white/35">{t(COPY.statusSub)}</p>
            </div>
            <Chip tone={missing.length === 0 ? 'warm' : 'hot'}>
              {t(missing.length === 0 ? COPY.ready : COPY.incomplete)}
            </Chip>
          </div>

          <div className="mt-3">
            <ProgressBar percent={(filled / REQUIRED_TOTAL) * 100} />
            <div className="mt-1.5">
              <Row
                label={t(COPY.requiredCount)}
                value={`${num(filled)} / ${num(REQUIRED_TOTAL)}`}
              />
            </div>
          </div>

          {loading ? (
            <p className="mt-1 text-[11.5px] text-white/30">{t(COPY.loading)}</p>
          ) : missing.length === 0 ? (
            <p className="mt-1 text-[11.5px] leading-relaxed text-success/80">{t(COPY.readyBody)}</p>
          ) : (
            <>
              <p className="mt-1 text-[11.5px] leading-relaxed text-white/55">{t(COPY.incompleteBody)}</p>
              <ul className="mt-1.5 list-disc space-y-1 ps-4 text-[11.5px] text-white/70 marker:text-[#ff9a76]">
                {missing.map((code) => (
                  <li key={code}>{t(explainCode(code, n))}</li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

        </div>

        <Card className="lg:order-1">
          <CardHead
            icon="Pencil"
            kicker={COPY.form}
            title={t(COPY.formTitle)}
            subtitle={t(COPY.formSub)}
            gradient={['#6d28d9', '#8b5cf6']}
          />

          <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submit}>
            <Field label={COPY.nameLabel} htmlFor="business-name" required className="md:col-span-2">
              <input
                id="business-name"
                value={form.name}
                maxLength={BUSINESS_LIMITS.name}
                placeholder={t(COPY.namePlaceholder)}
                onChange={(event) => set('name', event.target.value)}
                className={`${SHELL} mt-1.5`}
              />
            </Field>

            <Field label={COPY.sellLabel} htmlFor="business-sell" required hint={COPY.sellHint}>
              <Counted
                id="business-sell"
                rows={4}
                value={form.whatWeSell}
                limit={BUSINESS_LIMITS.whatWeSell}
                placeholder={t(COPY.sellPlaceholder)}
                onChange={(value) => set('whatWeSell', value)}
              />
            </Field>

            <Field label={COPY.audienceLabel} htmlFor="business-audience" required>
              <Counted
                id="business-audience"
                rows={3}
                value={form.audience}
                limit={BUSINESS_LIMITS.audience}
                placeholder={t(COPY.audiencePlaceholder)}
                onChange={(value) => set('audience', value)}
              />
            </Field>

            <Field label={COPY.toneLabel} htmlFor="business-tone" hint={TONE_COPY[form.tone].hint}>
              <div id="business-tone" className="mt-1.5 flex flex-wrap gap-1.5">
                {BUSINESS_TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    aria-pressed={form.tone === tone}
                    onClick={() => set('tone', tone)}
                    className={`rounded-full px-3 py-1.5 text-[11px] transition ${
                      form.tone === tone
                        ? 'bg-accent text-white'
                        : 'border border-hairline bg-white/[0.03] text-white/50 hover:text-white/85'
                    }`}
                  >
                    {t(TONE_COPY[tone].label)}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={COPY.priceLabel} htmlFor="business-price" hint={COPY.priceHint}>
              <input
                id="business-price"
                inputMode="numeric"
                value={n(form.price)}
                placeholder={n('0')}
                onChange={(event) => set('price', toLatinDigits(event.target.value).replace(/\D/g, '').slice(0, 12))}
                className={`${SHELL} mt-1.5`}
              />
              {price > 0 && (
                <p className="mt-1.5 text-[10.5px] text-white/35">
                  {t(COPY.priceShown)} <span className="text-accent/90">{num(price, 'money')}</span>
                </p>
              )}
            </Field>

            <Field
              label={COPY.channelsLabel}
              htmlFor="business-channels"
              hint={COPY.channelsHint}
              className="md:col-span-2"
            >
              <div id="business-channels" className="mt-1.5 flex flex-wrap gap-1.5">
                {BUSINESS_CHANNELS.map((channel) => {
                  const on = form.channels.includes(channel)
                  return (
                    <button
                      key={channel}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleChannel(channel)}
                      className={`inline-flex items-center gap-1.5 rounded-full py-1 pe-3 ps-1 text-[11px] transition ${
                        on
                          ? 'bg-accent text-white'
                          : 'border border-hairline bg-white/[0.03] text-white/50 hover:text-white/85'
                      }`}
                    >
                      <NodeIcon icon={channel} size={20} />
                      {t(CHANNEL_LABEL[channel])}
                    </button>
                  )
                })}
              </div>
              {form.channels.length === 0 && (
                <p className="mt-1.5 text-[10.5px] text-white/30">{t(COPY.channelsNone)}</p>
              )}
            </Field>

            <div className="rounded-xl border border-hairline bg-white/[0.02] p-3 md:col-span-2">
              <div className="text-[11.5px] text-white/70">{t(COPY.destinations)}</div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-white/40">{t(COPY.destinationsWhy)}</p>

              <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {BUSINESS_CHANNELS.map((channel) => (
                  <Field
                    key={channel}
                    label={DESTINATION_COPY[channel].label}
                    htmlFor={`business-destination-${channel}`}
                    hint={DESTINATION_COPY[channel].hint}
                  >
                    <input
                      id={`business-destination-${channel}`}
                      // An address is never Persian text, so it reads left to
                      // right inside a page that otherwise mirrors.
                      dir="ltr"
                      value={form.destinations[channel]}
                      maxLength={DESTINATION_LIMIT}
                      placeholder={t(DESTINATION_COPY[channel].placeholder)}
                      onChange={(event) => setDestination(channel, event.target.value)}
                      className={`${SHELL} mt-1.5 text-start`}
                    />
                  </Field>
                ))}
              </div>
            </div>

            <Field label={COPY.ctaLabel} htmlFor="business-cta" hint={COPY.ctaHint}>
              <input
                id="business-cta"
                type="url"
                dir="ltr"
                value={form.ctaUrl}
                placeholder={t(COPY.ctaPlaceholder)}
                onChange={(event) => set('ctaUrl', event.target.value)}
                className={`${SHELL} mt-1.5 text-start`}
              />
            </Field>

            <Field label={COPY.notesLabel} htmlFor="business-notes">
              <Counted
                id="business-notes"
                rows={3}
                value={form.notes}
                limit={BUSINESS_LIMITS.notes}
                placeholder={t(COPY.notesPlaceholder)}
                onChange={(value) => set('notes', value)}
              />
            </Field>

            {error && (
              <div className="rounded-xl border border-[#ff6b3d]/40 bg-[#ff6b3d]/10 px-3 py-2.5 md:col-span-2">
                <p className="text-[11.5px] text-[#ff9a76]">{t(errorLine)}</p>
                {error.messages.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-1 ps-4 text-[11.5px] text-white/70 marker:text-[#ff9a76]">
                    {error.messages.map((message) => (
                      <li key={message}>{t(explainCode(message, n))}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="md:col-span-2 md:mx-auto md:w-full md:max-w-xs">
              <PrimaryButton type="submit" disabled={saving || blocked}>
                {t(saving ? COPY.savingNow : COPY.save)}
              </PrimaryButton>
              {blocked ? (
                <p className="mt-2 text-center text-[10.5px] text-white/30">{t(COPY.saveBlocked)}</p>
              ) : justSaved ? (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[10.5px] text-success">
                  <Icon name="ShieldCheck" size={12} />
                  {t(COPY.savedNow)}
                </p>
              ) : null}
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  )
}

const SHELL =
  'w-full rounded-xl border border-hairline bg-black/40 px-3.5 py-2.5 text-[12.5px] text-white/85 outline-none placeholder:text-white/25 focus:border-accent/50'

function Field({
  label,
  htmlFor,
  required,
  hint,
  className = '',
  children,
}: {
  label: Bi
  htmlFor: string
  required?: boolean
  hint?: Bi
  className?: string
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[11.5px] text-white/70">
          {t(label)}
        </label>
        {required && (
          <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-[9px] text-white/70">{t(COPY.required)}</span>
        )}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/30">{t(hint)}</p>}
    </div>
  )
}

/** A textarea that counts down to the same limit the route trims at. */
function Counted({
  id,
  rows,
  value,
  limit,
  placeholder,
  onChange,
}: {
  id: string
  rows: number
  value: string
  limit: number
  placeholder: string
  onChange: (value: string) => void
}) {
  const { num } = useI18n()
  return (
    <>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={limit}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${SHELL} mt-1.5 resize-none leading-relaxed`}
      />
      <div className="mt-1.5">
        <ProgressBar percent={(value.length / limit) * 100} />
        <p className="mt-1 text-end text-[9.5px] text-white/25">
          {num(value.length)} / {num(limit)}
        </p>
      </div>
    </>
  )
}
