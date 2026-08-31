import { useCallback, useEffect, useState } from 'react'
import AppHeader from '../components/AppHeader'
import AppShell from '../components/AppShell'
import Chip from '../components/Chip'
import { Icon } from '../components/Icon'
import { NodeIcon } from '../components/icons'
import { getJson, postJson, type ApiConversation, type ApiLead, type ApiMessage } from '../api/client'
import { useI18n } from '../i18n/I18nProvider'
import type { IconKey } from '../data/types'

const COPY = {
  empty: { en: 'No conversations yet.', fa: 'هنوز گفتگویی نیست.' },
  back: { en: 'Conversations', fa: 'گفتگوها' },
  pick: { en: 'Pick a conversation', fa: 'یک گفتگو را انتخاب کنید' },
  placeholder: { en: 'Write a reply…', fa: 'پاسخ بنویسید…' },
  send: { en: 'Send', fa: 'ارسال' },
  simulated: {
    en: 'This channel has no credentials, so replies are recorded but not delivered.',
    fa: 'این کانال کلید ندارد؛ پاسخ‌ها ثبت می‌شوند ولی ارسال نمی‌شوند.',
  },
}

export default function Inbox() {
  const { t, num } = useI18n()
  const [conversations, setConversations] = useState<ApiConversation[]>([])
  const [online, setOnline] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  // A phone has room for one pane, so the list stands in for the thread until a
  // conversation is opened. Both panes are on screen from `md` up and this is
  // never read.
  const [reading, setReading] = useState(false)
  const [thread, setThread] = useState<{ lead: ApiLead; messages: ApiMessage[] } | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [lastStatus, setLastStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await getJson<{ conversations: ApiConversation[] }>('/api/conversations')
      setConversations(data.conversations)
      setOnline(true)
      setSelected((current) => current ?? data.conversations[0]?.id ?? null)
    } catch {
      setOnline(false)
    }
  }, [])

  const loadThread = useCallback(async (id: number) => {
    const data = await getJson<{ lead: ApiLead; messages: ApiMessage[] }>(`/api/leads/${id}`)
    setThread({ lead: data.lead, messages: data.messages })
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 8000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (selected !== null) void loadThread(selected).catch(() => setThread(null))
  }, [selected, loadThread])

  const send = async () => {
    if (selected === null || !draft.trim() || sending) return
    setSending(true)
    try {
      const result = await postJson<{ status: string }>(`/api/leads/${selected}/messages`, { body: draft })
      setLastStatus(result.status)
      setDraft('')
      await loadThread(selected)
      await load()
    } finally {
      setSending(false)
    }
  }

  return (
    <AppShell flush>
      <AppHeader connected={online} />

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(240px,320px)_1fr] lg:grid-cols-[minmax(300px,360px)_1fr]">
        <aside
          className={`min-h-0 overflow-auto border-hairline bg-panel/40 md:block md:border-e ${
            reading ? 'hidden' : ''
          }`}
        >
          {conversations.length === 0 && (
            <p className="p-6 text-center text-[12px] text-white/30">{t(COPY.empty)}</p>
          )}
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => {
                setSelected(conversation.id)
                setReading(true)
              }}
              className={`flex w-full items-start gap-2.5 border-b border-hairline px-4 py-3 text-start transition ${
                selected === conversation.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
              }`}
            >
              <NodeIcon icon={conversation.source as IconKey} size={22} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[12px] font-medium text-white/85">{conversation.name ?? '—'}</span>
                  <Chip tone={conversation.route}>{num(conversation.score)}</Chip>
                </div>
                <p className="truncate text-[11px] text-white/35">{conversation.last_body}</p>
              </div>
            </button>
          ))}
        </aside>

        <section className={`min-h-0 flex-col md:flex ${reading ? 'flex' : 'hidden'}`}>
          {!thread ? (
            <p className="m-auto text-[12px] text-white/30">{t(COPY.pick)}</p>
          ) : (
            <>
              {/* The list is off screen on a phone, so the thread says whose it
                  is and how to get back to it. */}
              <div className="flex items-center gap-2 border-b border-hairline bg-panel/60 px-3 py-2 md:hidden">
                <button
                  type="button"
                  onClick={() => setReading(false)}
                  className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-[11px] text-white/60 transition hover:border-accent/50 hover:text-white"
                >
                  <Icon name="ChevronLeft" size={13} className="rtl:rotate-180" />
                  {t(COPY.back)}
                </button>
                <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">{thread.lead.name ?? '—'}</span>
                <NodeIcon icon={thread.lead.source as IconKey} size={20} />
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
                  {thread.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[72%] rounded-2xl border px-3.5 py-2 text-[12px] ${
                        message.direction === 'in'
                          ? 'me-auto border-hairline bg-white/[0.05] text-white/85'
                          : 'ms-auto border-accent/25 bg-accent/12 text-white/90'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <div className="mt-1 text-[9px] text-white/25">
                        {message.status} · {message.at}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-hairline bg-panel/60 p-3">
                <div className="mx-auto w-full max-w-3xl">
                  {lastStatus === 'simulated' && (
                    <p className="mb-2 text-[10px] text-white/30">{t(COPY.simulated)}</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && send()}
                      placeholder={t(COPY.placeholder)}
                      className="flex-1 rounded-xl border border-hairline bg-black/40 px-3.5 py-2 text-[12px] text-white/85 outline-none placeholder:text-white/25 focus:border-accent/50"
                    />
                    <button
                      type="button"
                      onClick={send}
                      disabled={sending || !draft.trim()}
                      className="rounded-xl bg-accent/25 px-4 py-2 text-[12px] text-white transition disabled:opacity-40"
                    >
                      {t(COPY.send)}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  )
}
