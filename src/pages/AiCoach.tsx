import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import PageBanner from '../components/PageBanner'
import { Icon } from '../components/Icon'
import { readyPrompts } from '../data/tools'
import { deleteJson, getJson, postJson, type CoachMessage } from '../api/client'
import { useI18n } from '../i18n/I18nProvider'

const COPY = {
  banner: { fa: 'AI کوچ', en: 'AI coach' },
  bannerSub: { fa: 'دستیار هوشمند شخصی', en: 'Your personal assistant' },
  placeholder: { fa: 'پیام خود را بنویسید...', en: 'Write your message…' },
  ready: { fa: '✨ پرامپت‌های آماده', en: '✨ Ready prompts' },
  empty: {
    fa: 'هر جای مسیر گیر کردی بپرس — از انتخاب ایده تا خودکارسازی.',
    en: 'Ask about any step of the path — from picking an idea to full automation.',
  },
  offline: { fa: 'API در دسترس نیست', en: 'API unreachable' },
  clear: { fa: 'پاک کردن گفتگو', en: 'Clear chat' },
  thinking: { fa: 'در حال نوشتن…', en: 'Writing…' },
  templateNote: {
    fa: 'پاسخ‌ها از قالب‌های آفلاین می‌آید. برای پاسخ مدل، ANTHROPIC_API_KEY را ست کنید.',
    en: 'Answers come from offline templates. Set ANTHROPIC_API_KEY for model answers.',
  },
}

export default function AiCoach() {
  const { t, locale } = useI18n()
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [adapter, setAdapter] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [online, setOnline] = useState(true)
  const [showPrompts, setShowPrompts] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const data = await getJson<{ messages: CoachMessage[]; adapter: string }>('/api/coach/history')
      setMessages(data.messages)
      setAdapter(data.adapter)
      setOnline(true)
    } catch {
      setOnline(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const send = async (text: string) => {
    const body = text.trim()
    if (!body || sending) return
    setShowPrompts(false)
    setDraft('')
    setSending(true)
    // Show the question immediately; the stored copy replaces it on reload.
    setMessages((prev) => [
      ...prev,
      { id: -Date.now(), role: 'user', content: body, at: new Date().toISOString() },
    ])
    try {
      await postJson('/api/coach', { message: body, locale })
      await load()
    } catch {
      setOnline(false)
    } finally {
      setSending(false)
    }
  }

  const clear = async () => {
    await deleteJson('/api/coach/history')
    setMessages([])
  }

  return (
    <AppShell flush>
      <div className="px-4 pt-4 lg:px-8 lg:pt-8">
        <PageBanner
          icon="Brain"
          title={COPY.banner}
          subtitle={COPY.bannerSub}
          actions={
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-black/30 px-2 py-1 text-[10px] text-white/70">
                {adapter ?? '—'}
              </span>
              <button
                type="button"
                onClick={clear}
                aria-label={t(COPY.clear)}
                title={t(COPY.clear)}
                className="text-white/60 transition hover:text-white"
              >
                <Icon name="Settings" size={16} />
              </button>
            </div>
          }
        />
      </div>

      {/*
        The transcript keeps its `max-w-2xl` at every width — a chat stretched to
        the full column is unreadable — so above `lg` the room beside it is spent
        on the ready prompts, which stop being a sheet you have to open, and the
        chat itself becomes a panel instead of running edge to edge.
      */}
      <div className="flex min-h-0 flex-1 lg:gap-5 lg:px-8 lg:pb-8 lg:pt-5">
        <div className="flex min-h-0 flex-1 flex-col lg:overflow-hidden lg:rounded-2xl lg:border lg:border-hairline lg:bg-panel/30">
          <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
            {messages.length === 0 && (
              <p className="mt-16 text-center text-[12px] text-white/25">
                {online ? t(COPY.empty) : t(COPY.offline)}
              </p>
            )}
            <div className="mx-auto flex max-w-2xl flex-col gap-2.5">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
                    message.role === 'user'
                      ? 'ms-auto border-accent/25 bg-accent/12 text-white/90'
                      : 'me-auto border-hairline bg-white/[0.05] text-white/85'
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {sending && (
                <div className="me-auto rounded-2xl border border-hairline bg-white/[0.05] px-3.5 py-2.5 text-[12px] text-white/40">
                  {t(COPY.thinking)}
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          {showPrompts && (
            <div className="border-t border-hairline bg-panel/70 px-4 py-3 lg:hidden">
              <div className="mx-auto flex max-w-2xl flex-wrap gap-2">
                {readyPrompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    onClick={() => send(t(prompt.prompt))}
                    className="rounded-full border border-hairline bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/70 transition hover:border-accent/50 hover:text-white"
                  >
                    {t(prompt.label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-hairline bg-panel/70 px-4 pb-3 pt-3">
            <div className="mx-auto max-w-2xl">
              {adapter === 'template' && (
                <p className="mb-2 text-center text-[10px] text-white/25">{t(COPY.templateNote)}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => send(draft)}
                  disabled={!draft.trim() || sending}
                  aria-label="send"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/25 text-white transition disabled:opacity-40"
                >
                  <Icon name="Send" size={16} />
                </button>
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && send(draft)}
                  placeholder={t(COPY.placeholder)}
                  className="h-10 flex-1 rounded-xl border border-hairline bg-black/40 px-3.5 text-[12.5px] text-white/85 outline-none placeholder:text-white/25 focus:border-accent/50"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowPrompts((open) => !open)}
                className="mt-2 w-full rounded-xl border border-hairline py-2 text-[11.5px] text-white/55 transition hover:text-white lg:hidden"
              >
                {t(COPY.ready)}
              </button>
            </div>
          </div>
        </div>

        <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto lg:flex">
          <h2 className="px-1 pb-2 text-[11px] font-semibold text-white/60">{t(COPY.ready)}</h2>
          <div className="flex flex-col gap-2">
            {readyPrompts.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                onClick={() => send(t(prompt.prompt))}
                className="rounded-xl border border-hairline bg-white/[0.04] px-3 py-2 text-start text-[11.5px] leading-relaxed text-white/70 transition hover:border-accent/50 hover:text-white"
              >
                {t(prompt.label)}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
