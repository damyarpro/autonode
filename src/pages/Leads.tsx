import { useCallback, useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import Chip from '../components/Chip'
import { NodeIcon } from '../components/icons'
import { getJson, postJson, type ApiEvent, type ApiLead, type ApiMessage } from '../api/client'
import { useI18n } from '../i18n/I18nProvider'
import type { Bi, IconKey } from '../data/types'

const ROUTE_LABEL: Record<string, Bi> = {
  hot: { en: 'hot', fa: 'داغ' },
  warm: { en: 'warm', fa: 'گرم' },
  cold: { en: 'cold', fa: 'سرد' },
}

const STAGE_LABEL: Record<string, Bi> = {
  new: { en: 'new', fa: 'تازه' },
  engaged: { en: 'engaged', fa: 'درگیر' },
  qualified: { en: 'qualified', fa: 'واجد شرایط' },
  meeting: { en: 'meeting', fa: 'جلسه' },
  checkout: { en: 'checkout', fa: 'پرداخت' },
  paid: { en: 'paid', fa: 'پرداخت‌شده' },
  delivered: { en: 'delivered', fa: 'تحویل‌شده' },
  advocate: { en: 'advocate', fa: 'معرف' },
  lost: { en: 'lost', fa: 'ازدست‌رفته' },
}

const COPY = {
  title: { en: 'Leads', fa: 'لیدها' },
  empty: { en: 'No leads yet. Send one to POST /api/leads.', fa: 'هنوز لیدی نیست. یکی به POST /api/leads بفرستید.' },
  offline: { en: 'API not reachable — start it with npm run dev:api', fa: 'API در دسترس نیست — با npm run dev:api اجرایش کنید' },
  all: { en: 'all', fa: 'همه' },
  search: { en: 'Search name or handle', fa: 'جستجوی نام یا شناسه' },
  score: { en: 'score', fa: 'امتیاز' },
  timeline: { en: 'Event timeline', fa: 'تایم‌لاین رویدادها' },
  messages: { en: 'Messages', fa: 'پیام‌ها' },
  bookMeeting: { en: 'Book meeting', fa: 'رزرو جلسه' },
  completeCall: { en: 'Complete call', fa: 'ثبت تماس' },
  checkout: { en: 'Create checkout', fa: 'ساخت لینک پرداخت' },
  close: { en: 'Close', fa: 'بستن' },
  openCheckout: { en: 'Open checkout page', fa: 'باز کردن صفحه پرداخت' },
}

type Detail = { lead: ApiLead; events: ApiEvent[]; messages: ApiMessage[] }

export default function Leads() {
  const { t, num } = useI18n()
  const [leads, setLeads] = useState<ApiLead[]>([])
  const [online, setOnline] = useState(true)
  const [route, setRoute] = useState<string>('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (route) params.set('route', route)
      if (query) params.set('q', query)
      const data = await getJson<{ leads: ApiLead[] }>(`/api/leads?${params}`)
      setLeads(data.leads)
      setOnline(true)
    } catch {
      setOnline(false)
    }
  }, [route, query])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 8000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (selected === null) return setDetail(null)
    void getJson<Detail>(`/api/leads/${selected}`).then(setDetail).catch(() => setDetail(null))
  }, [selected])

  const act = async (action: string) => {
    if (selected === null) return
    await postJson(`/api/leads/${selected}/${action}`)
    setDetail(await getJson<Detail>(`/api/leads/${selected}`))
    void load()
  }

  const makeCheckout = async () => {
    if (selected === null) return
    const result = await postJson<{ url: string }>(`/api/checkout/${selected}`)
    setCheckoutUrl(result.url)
    setDetail(await getJson<Detail>(`/api/leads/${selected}`))
    void load()
  }

  const rows = useMemo(() => leads, [leads])

  return (
    <div className="flex h-full flex-col bg-canvas">
      <AppHeader connected={online} />

      <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-panel/50 px-5 py-2.5">
        <div className="flex items-center gap-1 rounded-lg border border-hairline bg-black/40 p-0.5 text-[11px]">
          {['', 'hot', 'warm', 'cold'].map((value) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => setRoute(value)}
              className={`rounded-[6px] px-2.5 py-1 transition ${
                route === value ? 'bg-accent/25 text-white' : 'text-white/45 hover:text-white/80'
              }`}
            >
              {value ? t(ROUTE_LABEL[value]) : t(COPY.all)}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t(COPY.search)}
          className="w-56 rounded-lg border border-hairline bg-black/40 px-3 py-1.5 text-[12px] text-white/85 outline-none placeholder:text-white/25 focus:border-accent/50"
        />
        <span className="ms-auto text-[11px] text-white/35">
          {online ? num(rows.length) : t(COPY.offline)}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-[12px] text-white/30">{online ? t(COPY.empty) : t(COPY.offline)}</p>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <tbody>
              {rows.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelected(lead.id)}
                  className="cursor-pointer border-b border-hairline transition hover:bg-white/[0.03]"
                >
                  <td className="w-12 py-2.5 ps-5">
                    <NodeIcon icon={lead.source as IconKey} size={22} />
                  </td>
                  <td className="py-2.5 pe-4">
                    <div className="font-medium text-white/85">{lead.name ?? '—'}</div>
                    <div className="text-[10px] text-white/35">{lead.handle ? `@${lead.handle}` : lead.source}</div>
                  </td>
                  <td className="py-2.5 pe-4">
                    <Chip tone={lead.route}>{t(ROUTE_LABEL[lead.route])}</Chip>
                  </td>
                  <td className="py-2.5 pe-4">
                    <Chip>{t(STAGE_LABEL[lead.stage] ?? { en: lead.stage, fa: lead.stage })}</Chip>
                  </td>
                  <td className="py-2.5 pe-4 text-white/55 tabular-nums">
                    {t(COPY.score)} {num(lead.score)}
                  </td>
                  <td className="py-2.5 pe-5 text-end text-white/45 tabular-nums">
                    {lead.value_toman > 0 ? num(lead.value_toman, 'money') : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && (
        // In flow rather than an overlay, so the table keeps its own columns.
        <aside className="flex w-[min(420px,45vw)] shrink-0 flex-col border-s border-hairline bg-panel">
          <div className="flex items-center gap-3 border-b border-hairline px-5 py-3">
            <NodeIcon icon={detail.lead.source as IconKey} size={26} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{detail.lead.name ?? '—'}</div>
              <div className="text-[10px] text-white/35">
                {t(COPY.score)} {num(detail.lead.score)} · {t(ROUTE_LABEL[detail.lead.route])}
              </div>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="text-[11px] text-white/40 hover:text-white">
              {t(COPY.close)}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-hairline px-5 py-3 text-[11px]">
            <button type="button" onClick={() => act('book-meeting')} className="rounded-lg border border-hairline px-2.5 py-1 text-white/70 hover:border-accent/50 hover:text-white">
              {t(COPY.bookMeeting)}
            </button>
            <button type="button" onClick={() => act('complete-call')} className="rounded-lg border border-hairline px-2.5 py-1 text-white/70 hover:border-accent/50 hover:text-white">
              {t(COPY.completeCall)}
            </button>
            <button type="button" onClick={makeCheckout} className="rounded-lg border border-success/40 px-2.5 py-1 text-success hover:bg-success/10">
              {t(COPY.checkout)}
            </button>
            {checkoutUrl && (
              <a href={checkoutUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-success/15 px-2.5 py-1 text-success">
                {t(COPY.openCheckout)}
              </a>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
            <h2 className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/30">{t(COPY.timeline)}</h2>
            <ol className="mb-6 space-y-1.5">
              {detail.events.map((event) => (
                <li key={event.id} className="flex items-baseline gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                  <span className="text-white/70">{event.type}</span>
                  <span className="ms-auto text-[10px] text-white/25">{event.at}</span>
                </li>
              ))}
            </ol>

            <h2 className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/30">{t(COPY.messages)}</h2>
            <div className="space-y-2">
              {detail.messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-xl border px-3 py-2 text-[11.5px] ${
                    message.direction === 'in'
                      ? 'border-hairline bg-white/[0.04] text-white/80'
                      : 'border-accent/25 bg-accent/10 text-white/85'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <div className="mt-1 text-[9px] text-white/25">
                    {message.direction} · {message.status} · {message.at}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}
      </div>
    </div>
  )
}
