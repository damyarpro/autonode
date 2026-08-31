import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PageBanner from '../components/PageBanner'
import { Card, CardHead, PrimaryButton, ProgressBar, Row } from '../components/Card'
import Chip, { type ChipTone } from '../components/Chip'
import { Icon } from '../components/Icon'
import { NodeIcon } from '../components/icons'
import {
  MEDIA_LIMITS,
  isLiveAdapter,
  mediaHref,
  useMedia,
  videoOutput,
  voiceOutput,
  type MediaFailure,
  type MediaFilter,
  type MediaJob,
  type MediaStatus,
  type Shot,
  type Storyboard,
  type TimedScript,
} from '../api/useMedia'
import { explainCode } from '../i18n/errors'
import { useI18n } from '../i18n/I18nProvider'
import type { Bi, Locale } from '../data/types'

/**
 * The studio: the screen that drives the ELEVENLABS and HIGGSFIELD nodes of the
 * sales board.
 *
 * Without credentials neither node renders a file, and this page says so — but
 * what they do produce, a timed script and a shot list, is the work an owner
 * would otherwise do by hand, so it is rendered as the deliverable it is rather
 * than as a failure.
 */

const COPY = {
  title: { fa: 'استودیو', en: 'Studio' },
  subtitle: { fa: 'گویندگی و ویدیوی تبلیغاتی', en: 'Voice-over and ad video' },
  backToBoard: { fa: 'بازگشت به برد فروش', en: 'Back to the sales board' },

  // What is actually running
  live: { fa: 'وضعیت', en: 'Status' },
  liveTitle: { fa: 'الان کدام آداپتور اجرا می‌شود', en: 'Which adapter is running' },
  liveSub: { fa: 'همان چیزی که سرور گزارش می‌کند', en: 'Exactly what the server reports' },
  liveVoice: { fa: 'گویندگی', en: 'Voice-over' },
  liveVideo: { fa: 'ویدیوی تبلیغاتی', en: 'Ad video' },
  liveOn: { fa: 'سرویس واقعی', en: 'live service' },
  liveOff: { fa: 'محلی', en: 'local' },
  liveBody: {
    fa: 'بدون ELEVENLABS_API_KEY هیچ صدایی ساخته نمی‌شود؛ چیزی که می‌گیری متن زمان‌بندی‌شده است — تله‌پرامپتری که خودت می‌خوانی. بدون HIGGSFIELD_API_KEY هیچ ویدیویی رندر نمی‌شود؛ چیزی که می‌گیری فهرست پلان‌هاست.',
    en: 'With no ELEVENLABS_API_KEY no audio is produced; what you get is a timed script — a teleprompter you read yourself. With no HIGGSFIELD_API_KEY no video is rendered; what you get is the shot list.',
  },
  liveHow: {
    fa: 'برای صدای واقعی به یک حساب ElevenLabs و برای ویدیوی واقعی به یک حساب Higgsfield نیاز است؛ کلید هرکدام در فایل .env گذاشته می‌شود.',
    en: 'Real audio needs an ElevenLabs account and real video a Higgsfield account; each key goes in the .env file.',
  },
  liveUnverified: {
    fa: 'این دو تماس تا امروز از این پروژه با سرویس واقعی اجرا نشده‌اند. کد بر پایه‌ی مستندات نوشته شده و آزموده نشده است.',
    en: 'Neither of those two calls has ever been run against the live service from this project. The code follows the published documentation and is unverified.',
  },

  // Voice
  voiceKicker: { fa: 'ELEVENLABS', en: 'ELEVENLABS' },
  voiceTitle: { fa: 'تولید صدای برند', en: 'Brand voice production' },
  scriptLabel: { fa: 'متن گویندگی', en: 'Script' },
  scriptPlaceholder: {
    fa: 'همان چیزی که باید خوانده شود؛ خط‌های خودت حفظ می‌شوند.',
    en: 'Exactly what should be read out; your own line breaks are kept.',
  },
  scriptHint: {
    fa: 'متن به خط‌های قابل‌خواندن در یک نفس تقسیم می‌شود و هر خط از روی تعداد کلمه‌هایش زمان می‌خورد.',
    en: 'The text is split into lines a narrator can read in one breath, each timed from its word count.',
  },
  voiceIdLabel: { fa: 'شناسه‌ی صدا (اختیاری)', en: 'Voice id (optional)' },
  voiceIdPlaceholder: { fa: '21m00Tcm4TlvDq8ikWAM', en: '21m00Tcm4TlvDq8ikWAM' },
  voiceIdHint: {
    fa: 'شناسه‌ی صدای ElevenLabs. بدون کلید فقط ثبت می‌شود تا رندر بعدی با همان صدا باشد.',
    en: 'An ElevenLabs voice id. With no key it is only recorded, so a later real render matches it.',
  },
  voiceSubmit: { fa: 'ساخت گویندگی', en: 'Produce voice-over' },
  voiceBusy: { fa: 'در حال ساخت…', en: 'Producing…' },
  voiceBlocked: { fa: 'اول متن گویندگی را بنویس.', en: 'Write the script first.' },
  voiceLatest: { fa: 'آخرین گویندگی', en: 'Latest voice-over' },
  audioReady: { fa: 'فایل صوتی رندر شده و از همین سرور پخش می‌شود.', en: 'The audio was rendered and plays from this server.' },
  noAudioYet: {
    fa: 'فایل صوتی وجود ندارد؛ آنچه ساخته شده متن زمان‌بندی‌شده‌ی زیر است.',
    en: 'There is no audio file; what exists is the timed script below.',
  },
  totalWords: { fa: 'تعداد کلمه', en: 'Words' },
  totalTime: { fa: 'زمان کل', en: 'Total time' },
  pace: { fa: 'سرعت خواندن (کلمه در دقیقه)', en: 'Reading pace (words per minute)' },
  askedVoice: { fa: 'صدای درخواستی', en: 'Requested voice' },

  // Video
  videoKicker: { fa: 'HIGGSFIELD', en: 'HIGGSFIELD' },
  videoTitle: { fa: 'ساخت ویدیوی تبلیغاتی', en: 'Ad video production' },
  briefLabel: { fa: 'خلاصه‌ی ویدیو', en: 'Video brief' },
  briefPlaceholder: {
    fa: 'چه چیزی، برای چه کسی، و در پایان چه بخواهد؛ فقط از همین کلمه‌ها پلان ساخته می‌شود.',
    en: 'What, for whom, and what to ask at the end; the shots are built only from these words.',
  },
  briefHint: {
    fa: 'خلاصه به پلان‌ها تقسیم می‌شود: اولی قلاب، آخری دعوت به اقدام، و هر پلان به اندازه‌ی متنش نگه داشته می‌شود.',
    en: 'The brief is split into shots: the first is the hook, the last the call to action, each held as long as its text needs.',
  },
  styleLabel: { fa: 'سبک (اختیاری)', en: 'Style (optional)' },
  styleHint: {
    fa: 'مثل «سینمایی» یا «موبایل، دوربین روی دست». در استوری‌بورد ثبت می‌شود.',
    en: 'Such as “cinematic” or “handheld phone”. It is recorded on the storyboard.',
  },
  videoSubmit: { fa: 'ساخت ویدیو', en: 'Produce ad video' },
  videoBusy: { fa: 'در حال ساخت…', en: 'Producing…' },
  videoBlocked: { fa: 'اول خلاصه‌ی ویدیو را بنویس.', en: 'Write the brief first.' },
  videoLatest: { fa: 'آخرین ویدیو', en: 'Latest ad video' },
  videoReady: { fa: 'ویدیوی رندرشده روی سرویس ارائه‌دهنده است.', en: 'The rendered video sits on the provider.' },
  openVideo: { fa: 'باز کردن ویدیو', en: 'Open the video' },
  noVideoYet: {
    fa: 'ویدیویی وجود ندارد؛ آنچه ساخته شده استوری‌بورد زیر است.',
    en: 'There is no video; what exists is the storyboard below.',
  },
  stillRendering: {
    fa: 'کار روی Higgsfield ثبت شده اما هنوز رندر تمام نشده است. تا وقتی نشانی ویدیو نیامده، چیزی برای دیدن نیست.',
    en: 'A Higgsfield job was accepted but the render has not finished. Until a video URL comes back there is nothing to watch.',
  },
  jobId: { fa: 'شناسه‌ی کار روی سرویس', en: 'Provider job id' },
  shots: { fa: 'تعداد پلان', en: 'Shots' },
  styleUsed: { fa: 'سبک ثبت‌شده', en: 'Recorded style' },
  onScreen: { fa: 'روی تصویر', en: 'On screen' },
  captionText: { fa: 'زیرنویس', en: 'Caption' },

  // Library
  libraryKicker: { fa: 'کتابخانه', en: 'Library' },
  libraryTitle: { fa: 'هرچه تا حالا ساخته شده', en: 'Everything produced so far' },
  librarySub: { fa: 'تازه‌ترین در بالا', en: 'Newest first' },
  all: { fa: 'همه', en: 'All' },
  empty: { fa: 'هنوز چیزی ساخته نشده.', en: 'Nothing has been produced yet.' },
  loading: { fa: 'در حال بارگذاری…', en: 'Loading…' },
  show: { fa: 'نمایش', en: 'show' },
  hide: { fa: 'بستن', en: 'hide' },
  remove: { fa: 'حذف', en: 'delete' },
  inputTitle: { fa: 'ورودی', en: 'Input' },
  adapterRow: { fa: 'آداپتور', en: 'Adapter' },
  localeRow: { fa: 'زبان', en: 'Language' },
  durationRow: { fa: 'مدت', en: 'Duration' },
  madeAt: { fa: 'زمان ساخت', en: 'Produced at' },

  // Failure and offline
  rejected: { fa: 'درخواست پذیرفته نشد:', en: 'The request was rejected:' },
  errorOffline: { fa: 'سرور در دسترس نیست. بعداً دوباره امتحان کن.', en: 'The server is unreachable. Try again later.' },
  errorServer: { fa: 'ساخت روی سرور شکست خورد.', en: 'The run failed on the server.' },
  errorNotFound: { fa: 'این مورد پیدا نشد.', en: 'That item was not found.' },
  offline: {
    fa: 'API در دسترس نیست، بنابراین چیزی ساخته نمی‌شود و کتابخانه خالی است.',
    en: 'The API is unreachable, so nothing can be produced and the library is empty.',
  },
  retry: { fa: 'تلاش دوباره', en: 'Try again' },
  reasonLabel: { fa: 'دلیل ثبت‌شده', en: 'Recorded reason' },
  none: { fa: '—', en: '—' },
} satisfies Record<string, Bi>

const STATUS: Record<MediaStatus, { label: Bi; tone: ChipTone }> = {
  rendered: { label: { fa: 'رندر شد', en: 'rendered' }, tone: 'warm' },
  scripted: { label: { fa: 'متن زمان‌بندی‌شده', en: 'timed script' }, tone: 'accent' },
  storyboarded: { label: { fa: 'استوری‌بورد', en: 'storyboard' }, tone: 'accent' },
  failed: { label: { fa: 'ناموفق', en: 'failed' }, tone: 'hot' },
}

const KIND_LABEL: Record<'voice' | 'video', Bi> = {
  voice: COPY.liveVoice,
  video: COPY.liveVideo,
}

const LOCALE_LABEL: Record<string, Bi> = {
  fa: { fa: 'فارسی', en: 'Persian' },
  en: { fa: 'انگلیسی', en: 'English' },
}

const ROLE_LABEL: Record<Shot['role'], Bi> = {
  hook: { fa: 'قلاب', en: 'hook' },
  beat: { fa: 'ضربه', en: 'beat' },
  cta: { fa: 'دعوت به اقدام', en: 'cta' },
}

/**
 * The adapters record a short machine-readable reason, the same contract as a
 * validation code (rule 11), so the sentence is written here.
 */
const REASONS: Record<string, Bi> = {
  'elevenlabs:unavailable': {
    fa: 'تماس با ElevenLabs انجام نشد، بنابراین به‌جای صدا متن زمان‌بندی‌شده ثبت شد.',
    en: 'The ElevenLabs call did not go through, so the timed script was recorded instead of audio.',
  },
  'higgsfield:unavailable': {
    fa: 'تماس با Higgsfield انجام نشد، بنابراین به‌جای ویدیو استوری‌بورد ثبت شد.',
    en: 'The Higgsfield call did not go through, so the storyboard was recorded instead of a video.',
  },
  'higgsfield:still_rendering': COPY.stillRendering,
  'script:empty': { fa: 'در متن هیچ کلمه‌ای پیدا نشد.', en: 'No words were found in the script.' },
  'brief:empty': { fa: 'در خلاصه هیچ کلمه‌ای پیدا نشد.', en: 'No words were found in the brief.' },
}

function explainReason(reason: string): Bi {
  const known = REASONS[reason]
  if (known) return known
  if (reason.endsWith(':threw')) {
    const adapter = reason.slice(0, -':threw'.length)
    return { fa: `آداپتور «${adapter}» خطا داد.`, en: `The “${adapter}” adapter threw.` }
  }
  // An unknown reason is still better shown than swallowed.
  return { fa: reason, en: reason }
}

const SHELL =
  'w-full rounded-xl border border-hairline bg-black/40 px-3.5 py-2.5 text-[12.5px] text-white/85 outline-none placeholder:text-white/25 focus:border-accent/50'

export default function Studio() {
  const { t, n, num, locale } = useI18n()
  const media = useMedia()
  const { adapters, error, latestVoice, latestVideo, online } = media

  const [script, setScript] = useState('')
  const [voice, setVoice] = useState('')
  const [voiceLocale, setVoiceLocale] = useState<Locale>(locale)
  const [brief, setBrief] = useState('')
  const [style, setStyle] = useState('')
  const [videoLocale, setVideoLocale] = useState<Locale>(locale)

  /** Seconds as a running clock, so a line's start reads like a teleprompter. */
  const clock = (seconds: number) => {
    const whole = Math.max(0, Math.round(seconds))
    const minutes = Math.floor(whole / 60)
    return n(`${minutes}:${String(whole % 60).padStart(2, '0')}`)
  }

  const secs = (seconds: number) => t({ fa: `${num(seconds)} ثانیه`, en: `${num(seconds)}s` })

  const submitVoice = async (event: FormEvent) => {
    event.preventDefault()
    if (media.voicing || !script.trim()) return
    await media.renderVoice({ script: script.trim(), locale: voiceLocale, voice: voice.trim() })
  }

  const submitVideo = async (event: FormEvent) => {
    event.preventDefault()
    if (media.filming || !brief.trim()) return
    await media.renderVideo({ brief: brief.trim(), locale: videoLocale, style: style.trim() })
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
            aria-label={t(COPY.backToBoard)}
            title={t(COPY.backToBoard)}
            className="text-white/70 transition hover:text-white"
          >
            <Icon name="ChevronLeft" size={18} className="rtl:rotate-180" />
          </Link>
        }
      />

      <Card className="mt-4">
        <CardHead
          icon="Cpu"
          kicker={COPY.live}
          title={t(COPY.liveTitle)}
          subtitle={t(COPY.liveSub)}
          gradient={['#4c1d95', '#8b5cf6']}
        />
        {adapters ? (
          <div className="mt-3">
            <AdapterRow label={COPY.liveVoice} name={adapters.voiceover} />
            <AdapterRow label={COPY.liveVideo} name={adapters.adVideo} />
          </div>
        ) : (
          <p className="mt-3 text-[11.5px] text-white/30">{t(media.loading ? COPY.loading : COPY.offline)}</p>
        )}
        {/* Prose, not layout: past about seventy characters a line stops being
            read, and this card is the full width of the page. */}
        <div className="max-w-3xl">
          <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">{t(COPY.liveBody)}</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-white/70">{t(COPY.liveHow)}</p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-white/40">{t(COPY.liveUnverified)}</p>
        </div>
      </Card>

      {!online && (
        <div className="mt-3 rounded-xl border border-hairline bg-white/[0.03] px-3 py-2.5">
          <p className="text-[11.5px] text-white/45">{t(COPY.offline)}</p>
          <button
            type="button"
            onClick={() => void media.refresh()}
            className="mt-2 rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/60 transition hover:border-accent/50 hover:text-white"
          >
            {t(COPY.retry)}
          </button>
        </div>
      )}

      {/* Two independent generators. They are the same shape and neither
          feeds the other, so on a wide screen they sit abreast. */}
      <div className="mt-3 grid grid-cols-1 items-start gap-3 lg:grid-cols-2 lg:gap-5">
        <Card>
          <BrandHead kind="voice" kicker={COPY.voiceKicker} title={COPY.voiceTitle} adapter={adapters?.voiceover} />

          <form className="mt-4 flex flex-col gap-4" onSubmit={submitVoice}>
            <Field label={COPY.scriptLabel} htmlFor="studio-script" hint={COPY.scriptHint}>
              <Counted
                id="studio-script"
                rows={6}
                value={script}
                limit={MEDIA_LIMITS.script}
                placeholder={t(COPY.scriptPlaceholder)}
                onChange={(next) => {
                  media.clearError()
                  setScript(next)
                }}
              />
            </Field>

            <Field label={COPY.voiceIdLabel} htmlFor="studio-voice" hint={COPY.voiceIdHint}>
              <input
                id="studio-voice"
                dir="ltr"
                value={voice}
                maxLength={MEDIA_LIMITS.voice}
                placeholder={t(COPY.voiceIdPlaceholder)}
                onChange={(event) => setVoice(event.target.value)}
                className={`${SHELL} mt-1.5 text-start`}
              />
            </Field>

            <LocalePicker id="studio-voice-locale" value={voiceLocale} onChange={setVoiceLocale} />

            <div>
              <PrimaryButton type="submit" disabled={media.voicing || !script.trim()}>
                {t(media.voicing ? COPY.voiceBusy : COPY.voiceSubmit)}
              </PrimaryButton>
              {!script.trim() && <p className="mt-2 text-center text-[10.5px] text-white/30">{t(COPY.voiceBlocked)}</p>}
            </div>
          </form>

          {latestVoice && (
            <div className="mt-4 border-t border-hairline pt-3">
              <div className="text-[10px] text-white/35">{t(COPY.voiceLatest)}</div>
              <VoiceAnswer job={latestVoice} clock={clock} secs={secs} />
            </div>
          )}
        </Card>

        <Card>
          <BrandHead kind="video" kicker={COPY.videoKicker} title={COPY.videoTitle} adapter={adapters?.adVideo} />

          <form className="mt-4 flex flex-col gap-4" onSubmit={submitVideo}>
            <Field label={COPY.briefLabel} htmlFor="studio-brief" hint={COPY.briefHint}>
              <Counted
                id="studio-brief"
                rows={5}
                value={brief}
                limit={MEDIA_LIMITS.brief}
                placeholder={t(COPY.briefPlaceholder)}
                onChange={(next) => {
                  media.clearError()
                  setBrief(next)
                }}
              />
            </Field>

            <Field label={COPY.styleLabel} htmlFor="studio-style" hint={COPY.styleHint}>
              <input
                id="studio-style"
                value={style}
                maxLength={MEDIA_LIMITS.style}
                onChange={(event) => setStyle(event.target.value)}
                className={`${SHELL} mt-1.5`}
              />
            </Field>

            <LocalePicker id="studio-video-locale" value={videoLocale} onChange={setVideoLocale} />

            <div>
              <PrimaryButton type="submit" disabled={media.filming || !brief.trim()}>
                {t(media.filming ? COPY.videoBusy : COPY.videoSubmit)}
              </PrimaryButton>
              {!brief.trim() && <p className="mt-2 text-center text-[10.5px] text-white/30">{t(COPY.videoBlocked)}</p>}
            </div>
          </form>

          {latestVideo && (
            <div className="mt-4 border-t border-hairline pt-3">
              <div className="text-[10px] text-white/35">{t(COPY.videoLatest)}</div>
              <VideoAnswer job={latestVideo} secs={secs} />
            </div>
          )}
        </Card>
      </div>

      {error && <ErrorBox failure={error} />}

      <Card className="mt-3">
        <CardHead
          icon="FolderOpen"
          kicker={COPY.libraryKicker}
          title={t(COPY.libraryTitle)}
          subtitle={t(COPY.librarySub)}
          gradient={['#6d28d9', '#8b5cf6']}
        />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(['all', 'voice', 'video'] as MediaFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={media.filter === value}
              onClick={() => media.setFilter(value)}
              className={`rounded-full px-3 py-1.5 text-[11px] transition ${
                media.filter === value
                  ? 'bg-accent text-white'
                  : 'border border-hairline bg-white/[0.03] text-white/50 hover:text-white/85'
              }`}
            >
              {t(value === 'all' ? COPY.all : KIND_LABEL[value])}
            </button>
          ))}
        </div>

        {media.loading ? (
          <p className="mt-3 text-[11.5px] text-white/30">{t(COPY.loading)}</p>
        ) : media.jobs.length === 0 ? (
          <p className="mt-3 text-[11.5px] text-white/30">{t(online ? COPY.empty : COPY.offline)}</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 items-start gap-2 xl:grid-cols-2">
            {media.jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                clock={clock}
                secs={secs}
                onRemove={() => void media.remove(job.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  )
}

/** Which adapter one node runs, and whether that adapter calls a paid service. */
function AdapterRow({ label, name }: { label: Bi; name: string }) {
  const { t } = useI18n()
  const live = isLiveAdapter(name)
  return (
    <Row
      label={t(label)}
      value={
        <span className="inline-flex items-center gap-2">
          <span className="font-mono text-[11px] text-white/70">{name}</span>
          <Chip tone={live ? 'warm' : 'neutral'}>{t(live ? COPY.liveOn : COPY.liveOff)}</Chip>
        </span>
      }
    />
  )
}

/** The node's own tile, so the screen matches the card on the board. */
function BrandHead({
  kind,
  kicker,
  title,
  adapter,
}: {
  kind: 'voice' | 'video'
  kicker: Bi
  title: Bi
  adapter?: string
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-start gap-3">
      <NodeIcon icon={kind === 'voice' ? 'elevenlabs' : 'higgsfield'} size={44} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-white/35">{t(kicker)}</div>
        <h2 className="truncate text-[14px] font-semibold text-white/90">{t(title)}</h2>
        {adapter && <p className="truncate font-mono text-[10.5px] text-accent/80">{adapter}</p>}
      </div>
    </div>
  )
}

function ErrorBox({ failure }: { failure: MediaFailure }) {
  const { t, n } = useI18n()
  const line =
    failure.kind === 'offline'
      ? COPY.errorOffline
      : failure.kind === 'server'
        ? COPY.errorServer
        : failure.kind === 'notFound'
          ? COPY.errorNotFound
          : COPY.rejected

  return (
    <div className="mt-3 rounded-xl border border-[#ff6b3d]/40 bg-[#ff6b3d]/10 px-3 py-2.5">
      <p className="text-[11.5px] text-[#ff9a76]">{t(line)}</p>
      {failure.messages.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-1 ps-4 text-[11.5px] text-white/70 marker:text-[#ff9a76]">
          {failure.messages.map((message) => (
            <li key={message}>{t(explainCode(message, undefined, n))}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Status, adapter and the reason the adapter recorded, if it recorded one. */
function AnswerHead({ job }: { job: MediaJob }) {
  const { t } = useI18n()
  const reason = (job.output as { reason?: string }).reason
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip tone={STATUS[job.status].tone}>{t(STATUS[job.status].label)}</Chip>
        <Chip>{job.adapter}</Chip>
        <Chip>{t(LOCALE_LABEL[job.locale] ?? { fa: job.locale, en: job.locale })}</Chip>
      </div>
      {reason && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-white/45">
          <span className="text-white/30">{t(COPY.reasonLabel)}: </span>
          {t(explainReason(reason))}
        </p>
      )}
    </>
  )
}

function VoiceAnswer({
  job,
  clock,
  secs,
}: {
  job: MediaJob
  clock: (seconds: number) => string
  secs: (seconds: number) => string
}) {
  const { t } = useI18n()
  const output = voiceOutput(job)
  const rendered = job.status === 'rendered' && Boolean(job.url)

  return (
    <div className="mt-1">
      <AnswerHead job={job} />

      {rendered && job.url ? (
        <div className="mt-3">
          <p className="text-[11.5px] text-success/80">{t(COPY.audioReady)}</p>
          {/* The only audio this page will play is a file this server wrote. */}
          <audio controls preload="none" src={mediaHref(job.url)} className="mt-2 w-full" />
        </div>
      ) : (
        output?.script && <p className="mt-3 text-[11.5px] text-white/45">{t(COPY.noAudioYet)}</p>
      )}

      {output?.script && <ScriptLines script={output.script} clock={clock} secs={secs} />}
    </div>
  )
}

/** The teleprompter: every line with its clock, its own hold, and the total. */
function ScriptLines({
  script,
  clock,
  secs,
}: {
  script: TimedScript
  clock: (seconds: number) => string
  secs: (seconds: number) => string
}) {
  const { t, num } = useI18n()
  return (
    <div className="mt-3">
      <ol className="flex flex-col gap-1.5">
        {script.lines.map((line) => (
          <li key={line.index} className="flex items-start gap-2 rounded-xl border border-hairline bg-white/[0.02] px-3 py-2">
            <span className="w-9 shrink-0 pt-0.5 text-[10px] tabular-nums text-white/30">{clock(line.startSec)}</span>
            {/* Generated content, in one language — rendered as written. */}
            <p dir="auto" className="min-w-0 flex-1 text-start text-[12.5px] leading-relaxed text-white/85">
              {line.text}
            </p>
            <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-white/30">{secs(line.seconds)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-2">
        <Row label={t(COPY.totalWords)} value={num(script.words)} />
        <Row label={t(COPY.totalTime)} value={secs(script.durationSec)} />
        <Row label={t(COPY.pace)} value={num(script.wordsPerMinute)} />
        <Row
          label={t(COPY.askedVoice)}
          value={script.voice ? <span className="font-mono text-[11px]">{script.voice}</span> : t(COPY.none)}
        />
      </div>
    </div>
  )
}

function VideoAnswer({ job, secs }: { job: MediaJob; secs: (seconds: number) => string }) {
  const { t } = useI18n()
  const output = videoOutput(job)
  const rendered = job.status === 'rendered' && Boolean(job.url)

  return (
    <div className="mt-1">
      <AnswerHead job={job} />

      {rendered && job.url ? (
        <div className="mt-3">
          <p className="text-[11.5px] text-success/80">{t(COPY.videoReady)}</p>
          <a
            href={mediaHref(job.url)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-success/40 px-2.5 py-1 text-[11px] text-success transition hover:bg-success/10"
          >
            <Icon name="ExternalLink" size={12} />
            {t(COPY.openVideo)}
          </a>
        </div>
      ) : (
        output?.storyboard && <p className="mt-3 text-[11.5px] text-white/45">{t(COPY.noVideoYet)}</p>
      )}

      {/* A job id without a URL is a render in flight, never a finished video. */}
      {!rendered && job.externalId && (
        <div className="mt-2">
          <Row label={t(COPY.jobId)} value={<span className="font-mono text-[11px]">{job.externalId}</span>} />
        </div>
      )}

      {output?.storyboard && <Shots storyboard={output.storyboard} secs={secs} />}
    </div>
  )
}

/** The shot list: role, direction, caption and hold, shot by shot. */
function Shots({ storyboard, secs }: { storyboard: Storyboard; secs: (seconds: number) => string }) {
  const { t, num } = useI18n()
  return (
    <div className="mt-3">
      <ol className="flex flex-col gap-2">
        {storyboard.shots.map((shot) => (
          <li key={shot.index} className="rounded-xl border border-hairline bg-white/[0.02] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-accent-soft text-[10px] tabular-nums text-white/80">
                {num(shot.index)}
              </span>
              <Chip tone={shot.role === 'cta' ? 'warm' : shot.role === 'hook' ? 'accent' : 'neutral'}>
                {t(ROLE_LABEL[shot.role])}
              </Chip>
              <span className="ms-auto text-[10px] tabular-nums text-white/30">{secs(shot.seconds)}</span>
            </div>
            <div className="mt-2 text-[10px] text-white/30">{t(COPY.onScreen)}</div>
            {/* Generated direction, in one language — rendered as written. */}
            <p dir="auto" className="text-start text-[12.5px] leading-relaxed text-white/85">
              {shot.onScreen}
            </p>
            <div className="mt-1.5 text-[10px] text-white/30">{t(COPY.captionText)}</div>
            <p dir="auto" className="text-start text-[12px] leading-relaxed text-accent/80">
              {shot.caption}
            </p>
          </li>
        ))}
      </ol>
      <div className="mt-2">
        <Row label={t(COPY.shots)} value={num(storyboard.shots.length)} />
        <Row label={t(COPY.totalTime)} value={secs(storyboard.durationSec)} />
        <Row label={t(COPY.styleUsed)} value={storyboard.style ?? t(COPY.none)} />
      </div>
    </div>
  )
}

/** One row of the library: what it is, when it was made, and what it produced. */
function JobRow({
  job,
  clock,
  secs,
  onRemove,
}: {
  job: MediaJob
  clock: (seconds: number) => string
  secs: (seconds: number) => string
  onRemove: () => void
}) {
  const { t, n, locale } = useI18n()
  const [open, setOpen] = useState(false)

  const stamp = useMemo(() => {
    const date = new Date(job.at)
    if (Number.isNaN(date.getTime())) return job.at
    return n(date.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }))
  }, [job.at, locale, n])

  const source = job.kind === 'voice' ? job.input.script : job.input.brief
  const text = typeof source === 'string' ? source : ''

  return (
    <div className="rounded-xl border border-hairline bg-white/[0.02]">
      <div className="flex items-center gap-2 px-3 py-2">
        <NodeIcon icon={job.kind === 'voice' ? 'elevenlabs' : 'higgsfield'} size={22} />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="min-w-0 flex-1 text-start text-[11.5px] text-white/70 transition hover:text-white"
        >
          <span className="text-white/40">{stamp}</span>
          <span className="ms-2 text-white/25">{t(open ? COPY.hide : COPY.show)}</span>
        </button>
        <Chip tone={STATUS[job.status].tone}>{t(STATUS[job.status].label)}</Chip>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-lg border border-hairline px-2 py-1 text-[10px] text-white/40 transition hover:border-[#ff6b3d]/40 hover:text-[#ff9a76]"
        >
          {t(COPY.remove)}
        </button>
      </div>

      {open && (
        <div className="border-t border-hairline px-3 py-3">
          <Row label={t(COPY.adapterRow)} value={<span className="font-mono text-[11px]">{job.adapter}</span>} />
          <Row label={t(COPY.localeRow)} value={t(LOCALE_LABEL[job.locale] ?? { fa: job.locale, en: job.locale })} />
          <Row
            label={t(COPY.durationRow)}
            value={job.durationSec === null ? t(COPY.none) : secs(job.durationSec)}
          />
          <Row label={t(COPY.madeAt)} value={stamp} />

          <div className="mt-2 text-[10px] text-white/35">{t(COPY.inputTitle)}</div>
          {/* The owner's own words, in whichever language they wrote them. */}
          <p dir="auto" className="whitespace-pre-wrap text-start text-[12px] leading-relaxed text-white/70">
            {text}
          </p>

          {job.kind === 'voice' ? (
            <VoiceAnswer job={job} clock={clock} secs={secs} />
          ) : (
            <VideoAnswer job={job} secs={secs} />
          )}
        </div>
      )}
    </div>
  )
}

function LocalePicker({
  id,
  value,
  onChange,
}: {
  id: string
  value: Locale
  onChange: (next: Locale) => void
}) {
  const { t } = useI18n()
  return (
    <Field label={COPY.localeRow} htmlFor={id}>
      <div id={id} className="mt-1.5 flex flex-wrap gap-1.5">
        {(['fa', 'en'] as Locale[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={`rounded-full px-3 py-1.5 text-[11px] transition ${
              value === option
                ? 'bg-accent text-white'
                : 'border border-hairline bg-white/[0.03] text-white/50 hover:text-white/85'
            }`}
          >
            {t(LOCALE_LABEL[option]!)}
          </button>
        ))}
      </div>
    </Field>
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

/** A textarea that counts down to the same limit the route refuses at. */
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
