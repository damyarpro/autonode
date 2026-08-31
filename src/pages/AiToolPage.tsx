import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PageBanner from '../components/PageBanner'
import { Card, CardHead, PrimaryButton, ProgressBar } from '../components/Card'
import Chip from '../components/Chip'
import { Icon } from '../components/Icon'
import { useToolRun } from '../api/useToolRun'
import { explainCode } from '../i18n/errors'
import { useI18n } from '../i18n/I18nProvider'
import {
  specById,
  type AiToolSpec,
  type Bi,
  type ToolField,
  type ToolRun,
  type ToolRunResult,
} from '../../shared/aiToolSpecs'

/**
 * The server reports validation failures as machine-readable `field:code`
 * strings precisely so the client — which already drew the form from the same
 * spec — can say them in the reader's language. Rendering the raw codes would
 * put untranslated text in front of the user.
 */
/** The tool's own field labels beat the generic dictionary in `explainCode`. */
const explainError = (code: string, spec: AiToolSpec, digits: (value: string) => string): Bi =>
  explainCode(code, spec.fields.find((field) => field.id === code.split(':')[0])?.label, digits)

const COPY = {
  notFoundTitle: { fa: 'ابزار پیدا نشد', en: 'Tool not found' },
  notFoundSub: { fa: 'این آدرس به هیچ ابزاری وصل نیست', en: 'This address matches no tool' },
  notFoundBody: {
    fa: 'ابزاری با این شناسه وجود ندارد. از فهرست ابزارها یکی را انتخاب کن.',
    en: 'No tool carries this id. Pick one from the tools list.',
  },
  backToTools: { fa: 'بازگشت به ابزارها', en: 'Back to tools' },

  formTitle: { fa: 'ورودی‌ها', en: 'Inputs' },
  formSub: { fa: 'هرچه دقیق‌تر بنویسی، پاسخ دقیق‌تر است', en: 'The more precise the input, the better the answer' },
  required: { fa: 'الزامی', en: 'required' },
  submit: { fa: 'اجرای ابزار', en: 'Run the tool' },
  runningNow: { fa: 'در حال اجرا…', en: 'Running…' },
  runningNote: {
    fa: 'اجرا ممکن است چند ثانیه طول بکشد.',
    en: 'A run can take a few seconds.',
  },
  fixErrors: { fa: 'اجرا انجام نشد:', en: 'The run was rejected:' },
  errorOffline: {
    fa: 'سرور در دسترس نیست. بعداً دوباره امتحان کن.',
    en: 'The server is unreachable. Try again later.',
  },
  errorNotFound: { fa: 'سرور این ابزار را نمی‌شناسد.', en: 'The server does not know this tool.' },
  errorServer: { fa: 'اجرای ابزار روی سرور شکست خورد.', en: 'The run failed on the server.' },

  answer: { fa: 'پاسخ', en: 'Answer' },
  answerSub: { fa: 'نتیجه‌ی آخرین اجرا', en: 'The most recent run' },
  byClaude: { fa: 'پاسخ مدل', en: 'Model answer' },
  byTemplate: { fa: 'قالب آفلاین', en: 'Offline template' },
  copy: { fa: 'کپی پاسخ', en: 'Copy answer' },
  copied: { fa: 'کپی شد', en: 'Copied' },
  summary: { fa: 'خلاصه', en: 'Summary' },

  history: { fa: 'اجراهای قبلی', en: 'Past runs' },
  historySub: { fa: 'ده اجرای آخر این ابزار', en: 'The last ten runs of this tool' },
  show: { fa: 'نمایش', en: 'Show' },
  hide: { fa: 'بستن', en: 'Hide' },
  historyEmpty: { fa: 'هنوز اجرایی ثبت نشده است.', en: 'No run has been recorded yet.' },
  historyOffline: {
    fa: 'API در دسترس نیست، بنابراین سابقه‌ی اجراها خالی است.',
    en: 'The API is unreachable, so the run history is empty.',
  },
  loading: { fa: 'در حال بارگذاری…', en: 'Loading…' },
  inputsOf: { fa: 'ورودی‌های این اجرا', en: 'Inputs of this run' },
  remove: { fa: 'حذف', en: 'Delete' },
  emptyValue: { fa: '—', en: '—' },
}

export default function AiToolPage() {
  const { toolId } = useParams<{ toolId: string }>()
  const spec = specById(toolId ?? '')
  if (!spec) return <NotFound />
  // Remount on a tool change so the form state starts from that tool's fields.
  return <ToolView key={spec.id} spec={spec} />
}

function NotFound() {
  const { t } = useI18n()
  return (
    <AppShell>
      <PageBanner icon="Wrench" title={COPY.notFoundTitle} subtitle={COPY.notFoundSub} />
      <Card className="mt-4">
        <p className="text-[12.5px] leading-relaxed text-white/60">{t(COPY.notFoundBody)}</p>
        <Link
          to="/tools"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 transition hover:border-accent/50"
        >
          <Icon name="ChevronLeft" size={14} className="text-accent rtl:rotate-180" />
          {t(COPY.backToTools)}
        </Link>
      </Card>
    </AppShell>
  )
}

const initialValues = (spec: AiToolSpec): Record<string, string> =>
  Object.fromEntries(
    spec.fields.map((field) => [field.id, field.type === 'select' ? (field.options?.[0]?.value ?? '') : '']),
  )

function ToolView({ spec }: { spec: AiToolSpec }) {
  const { t, num, n, locale } = useI18n()
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(spec))
  const { runs, latest, loading, running, online, error, run, remove } = useToolRun(spec.id, locale)

  const missingRequired = spec.fields.some((field) => field.required && !values[field.id]?.trim())

  const set = (id: string, value: string) => setValues((prev) => ({ ...prev, [id]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (running || missingRequired) return
    await run(values)
  }

  const errorLine =
    error?.kind === 'offline'
      ? COPY.errorOffline
      : error?.kind === 'notFound'
        ? COPY.errorNotFound
        : error?.kind === 'server'
          ? COPY.errorServer
          : COPY.fixErrors

  return (
    <AppShell>
      <PageBanner
        icon={spec.icon}
        title={spec.title}
        subtitle={spec.subtitle}
        actions={
          <Link to="/tools" aria-label={t(COPY.backToTools)} title={t(COPY.backToTools)} className="text-white/70 transition hover:text-white">
            <Icon name="ChevronLeft" size={18} className="rtl:rotate-180" />
          </Link>
        }
      />

      {/*
        Stacked on a phone, because the form is what you touch first. Above `lg`
        the answer stops being a scroll away: the inputs hold a sticky column of
        their own so a re-run is one glance from the result, and the answer keeps
        a column narrow enough to read rather than the full width of the page.
      */}
      <div className="mt-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
        <div className="lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto">
          <Card>
            <CardHead
              icon={spec.icon}
              gradient={spec.gradient}
              title={t(COPY.formTitle)}
              subtitle={t(COPY.formSub)}
            />

            <form className="mt-4 flex flex-col gap-4" onSubmit={submit}>
              {spec.fields.map((field) => (
                <Field key={field.id} field={field} value={values[field.id] ?? ''} onChange={set} />
              ))}

              {error && (
                <div className="rounded-xl border border-[#ff6b3d]/40 bg-[#ff6b3d]/10 px-3 py-2.5">
                  <p className="text-[11.5px] text-[#ff9a76]">{t(errorLine)}</p>
                  {error.messages.length > 0 && (
                    <ul className="mt-1.5 list-disc space-y-1 ps-4 text-[11.5px] text-white/70 marker:text-[#ff9a76]">
                      {error.messages.map((message) => (
                        <li key={message}>{t(explainError(message, spec, n))}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <PrimaryButton type="submit" disabled={running || missingRequired}>
                  {running ? t(COPY.runningNow) : t(COPY.submit)}
                </PrimaryButton>
                {running && <p className="mt-2 text-center text-[10.5px] text-white/30">{t(COPY.runningNote)}</p>}
              </div>
            </form>
          </Card>
        </div>

        <div className="mt-4 min-w-0 lg:mt-0">
          {!online && (
            <p className="mt-3 rounded-xl border border-hairline bg-white/[0.03] px-3 py-2.5 text-[11.5px] text-white/40 first:mt-0">
              {t(COPY.historyOffline)}
            </p>
          )}

          {latest && (
            <Card className="mt-4 first:mt-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[14px] font-semibold text-white/90">{t(COPY.answer)}</h2>
                  <p className="text-[10.5px] text-white/35">{t(COPY.answerSub)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip tone={latest.result.producedBy === 'claude' ? 'accent' : 'neutral'}>
                    {t(latest.result.producedBy === 'claude' ? COPY.byClaude : COPY.byTemplate)}
                  </Chip>
                  <CopyButton spec={spec} result={latest.result} />
                </div>
              </div>
              <Answer spec={spec} result={latest.result} />
            </Card>
          )}

          <Card className="mt-4 first:mt-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[14px] font-semibold text-white/90">
                  {t(COPY.history)} <span className="text-white/35">{num(runs.length)}</span>
                </h2>
                <p className="text-[10.5px] text-white/35">{t(COPY.historySub)}</p>
              </div>
            </div>

            {loading ? (
              <p className="mt-3 text-[11.5px] text-white/30">{t(COPY.loading)}</p>
            ) : runs.length === 0 ? (
              <p className="mt-3 text-[11.5px] text-white/30">{t(online ? COPY.historyEmpty : COPY.historyOffline)}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {runs.map((item) => (
                  <li key={item.id}>
                    <HistoryRow spec={spec} run={item} onRemove={() => void remove(item.id)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  )
}

function Field({
  field,
  value,
  onChange,
}: {
  field: ToolField
  value: string
  onChange: (id: string, value: string) => void
}) {
  const { t, num } = useI18n()
  const inputId = `tool-field-${field.id}`
  const shell =
    'w-full rounded-xl border border-hairline bg-black/40 px-3.5 py-2.5 text-[12.5px] text-white/85 outline-none placeholder:text-white/25 focus:border-accent/50'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-[11.5px] text-white/70">
          {t(field.label)}
        </label>
        {field.required && (
          <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-[9px] text-white/70">{t(COPY.required)}</span>
        )}
      </div>

      {field.type === 'textarea' && (
        <>
          <textarea
            id={inputId}
            rows={4}
            value={value}
            maxLength={field.maxLength}
            placeholder={field.placeholder ? t(field.placeholder) : undefined}
            onChange={(event) => onChange(field.id, event.target.value)}
            className={`${shell} mt-1.5 resize-none leading-relaxed`}
          />
          {field.maxLength && (
            <div className="mt-1.5">
              <ProgressBar percent={(value.length / field.maxLength) * 100} />
              <p className="mt-1 text-end text-[9.5px] text-white/25">
                {num(value.length)} / {num(field.maxLength)}
              </p>
            </div>
          )}
        </>
      )}

      {field.type === 'text' && (
        <input
          id={inputId}
          value={value}
          maxLength={field.maxLength}
          placeholder={field.placeholder ? t(field.placeholder) : undefined}
          onChange={(event) => onChange(field.id, event.target.value)}
          className={`${shell} mt-1.5`}
        />
      )}

      {field.type === 'select' && (
        <div id={inputId} className="mt-1.5 flex flex-wrap gap-1.5">
          {(field.options ?? []).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(field.id, option.value)}
              className={`rounded-full px-3 py-1.5 text-[11px] transition ${
                value === option.value
                  ? 'bg-accent text-white'
                  : 'border border-hairline bg-white/[0.03] text-white/50 hover:text-white/85'
              }`}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** The spec's sections, in the spec's order, each rendered by its kind. */
function Answer({ spec, result }: { spec: AiToolSpec; result: ToolRunResult }) {
  const { t, num } = useI18n()
  return (
    <div className="mt-3 flex flex-col gap-4">
      {result.summary && (
        <div className="rounded-xl border border-hairline bg-white/[0.03] px-3 py-2.5">
          <div className="text-[10px] text-white/35">{t(COPY.summary)}</div>
          <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-white/85">{result.summary}</p>
        </div>
      )}

      {spec.sections.map((section) => {
        const block = result.sections.find((candidate) => candidate.id === section.id)
        const items = block?.items.filter((item) => item.trim().length > 0) ?? []
        if (items.length === 0) return null
        return (
          <div key={section.id}>
            <h3 className="text-[11.5px] font-semibold text-accent/90">{t(section.label)}</h3>

            {section.kind === 'text' && (
              <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-white/80">
                {items.join('\n')}
              </p>
            )}

            {section.kind === 'list' && (
              <ul className="mt-1.5 list-disc space-y-1.5 ps-4 text-[12.5px] leading-relaxed text-white/80 marker:text-accent">
                {items.map((item, index) => (
                  <li key={`${section.id}-${index}`}>{item}</li>
                ))}
              </ul>
            )}

            {/* Numbered by hand so the digits follow the locale like every other number. */}
            {section.kind === 'steps' && (
              <ol className="mt-1.5 flex flex-col gap-2">
                {items.map((item, index) => (
                  <li key={`${section.id}-${index}`} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/20 text-[10px] text-white/80">
                      {num(index + 1)}
                    </span>
                    <span className="text-[12.5px] leading-relaxed text-white/80">{item}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )
      })}
    </div>
  )
}

function plainText(spec: AiToolSpec, result: ToolRunResult, label: (value: { fa: string; en: string }) => string) {
  const lines: string[] = [result.summary]
  for (const section of spec.sections) {
    const block = result.sections.find((candidate) => candidate.id === section.id)
    const items = block?.items.filter((item) => item.trim().length > 0) ?? []
    if (items.length === 0) continue
    lines.push('', label(section.label))
    for (const item of items) lines.push(section.kind === 'text' ? item : `- ${item}`)
  }
  return lines.join('\n')
}

function CopyButton({ spec, result }: { spec: AiToolSpec; result: ToolRunResult }) {
  const { t } = useI18n()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => setDone(false), 1600)
    return () => window.clearTimeout(timer)
  }, [done])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText(spec, result, t))
      setDone(true)
    } catch {
      // Clipboard access can be denied; the answer stays on screen either way.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={t(COPY.copy)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white/[0.04] px-2 py-1 text-[10px] text-white/60 transition hover:text-white"
    >
      <Icon name="ClipboardList" size={12} />
      {t(done ? COPY.copied : COPY.copy)}
    </button>
  )
}

function HistoryRow({ spec, run, onRemove }: { spec: AiToolSpec; run: ToolRun; onRemove: () => void }) {
  const { t, n, locale } = useI18n()
  const [open, setOpen] = useState(false)

  const stamp = useMemo(() => {
    const date = new Date(run.at)
    if (Number.isNaN(date.getTime())) return run.at
    return n(date.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }))
  }, [run.at, locale, n])

  return (
    <div className="rounded-xl border border-hairline bg-white/[0.02]">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="min-w-0 flex-1 text-start text-[11.5px] text-white/70 transition hover:text-white"
        >
          <span className="text-white/40">{stamp}</span>
          <span className="ms-2 text-white/25">{t(open ? COPY.hide : COPY.show)}</span>
        </button>
        <Chip tone={run.result.producedBy === 'claude' ? 'accent' : 'neutral'}>
          {t(run.result.producedBy === 'claude' ? COPY.byClaude : COPY.byTemplate)}
        </Chip>
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
          <div className="text-[10px] text-white/35">{t(COPY.inputsOf)}</div>
          <dl className="mt-1.5 flex flex-col gap-1">
            {spec.fields.map((field) => {
              const raw = run.inputs[field.id] ?? ''
              const option = field.options?.find((candidate) => candidate.value === raw)
              return (
                <div key={field.id} className="flex items-baseline gap-2 text-[11.5px]">
                  <dt className="shrink-0 text-white/35">{t(field.label)}</dt>
                  <dd className="min-w-0 flex-1 whitespace-pre-wrap text-white/75">
                    {option ? t(option.label) : raw.trim() || t(COPY.emptyValue)}
                  </dd>
                </div>
              )
            })}
          </dl>
          <Answer spec={spec} result={run.result} />
        </div>
      )}
    </div>
  )
}
