import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { Card, PrimaryButton, ProgressBar, SoonBadge } from '../components/Card'
import { Icon, IconTile } from '../components/Icon'
import { brand } from '../data/brand'
import { aiTools } from '../data/tools'
import { TOTAL_STAGES } from '../data/levels'
import { patchJson } from '../api/client'
import { useAppState } from '../api/useAppState'
import { useI18n } from '../i18n/I18nProvider'

const COPY = {
  freePlan: { fa: 'اشتراک رایگان', en: 'Free plan' },
  income: { fa: 'درآمد ماهانه', en: 'Monthly income' },
  growth: { fa: '+۱۲٪ رشد', en: '+12% growth' },
  onTrack: { fa: 'در مسیر موفقیت', en: 'On track' },
  path: { fa: 'مسیر پیشرفت', en: 'Progress path' },
  stageOf: { fa: 'مرحله {done} از {total}', en: 'Stage {done} of {total}' },
  completed: { fa: '{n}٪ تکمیل شده', en: '{n}% complete' },
  continue: { fa: 'ادامه مسیر', en: 'Continue' },
  toolsTitle: { fa: 'ابزارهای AI هوشمند', en: 'Smart AI tools' },
  toolsSubtitle: { fa: 'ابزارهای قدرتمند کسب‌وکار', en: 'Powerful business tools' },
  coachTitle: { fa: 'AI کوچ شخصی', en: 'Personal AI coach' },
  coachSubtitle: { fa: 'مربی هوشمند شما', en: 'Your smart mentor' },
  coach: { fa: 'AI کوچ', en: 'AI coach' },
  ready: { fa: 'آماده کمک', en: 'Ready to help' },
  online: { fa: 'آنلاین', en: 'Online' },
  startChat: { fa: 'شروع گفتگو', en: 'Start a chat' },
  offline: { fa: 'API در دسترس نیست', en: 'API unreachable' },
}

/** The income headline is free text the user edits in place. */
function HeadlineField({ value, onSave }: { value: string; onSave: (next: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  useEffect(() => setDraft(value), [value])

  const commit = () => {
    setEditing(false)
    if (draft.trim() && draft !== value) onSave(draft.trim())
  }

  return (
    <div className="relative mt-3 rounded-xl border border-hairline bg-black/35 px-4 py-3.5">
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && commit()}
          className="w-full bg-transparent text-center text-[15px] font-semibold text-white outline-none"
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="block w-full text-center">
          <span className="text-[15px] font-semibold text-white">{value}</span>
          <span className="ms-1 inline-block h-4 w-px animate-pulse bg-success align-middle" />
        </button>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="edit"
        className="absolute end-2 top-2 text-white/25 transition hover:text-white/70"
      >
        <Icon name="Pencil" size={13} />
      </button>
    </div>
  )
}

export default function Dashboard() {
  const { t, num } = useI18n()
  const { profile, progress, online, refresh } = useAppState()

  const done = progress?.stagesDone ?? 0
  const total = progress?.totalStages ?? TOTAL_STAGES
  const percent = progress?.percent ?? 0

  const saveHeadline = async (headline: string) => {
    await patchJson('/api/profile', { headline })
    await refresh()
  }

  return (
    <AppShell>
      {/*
        One column on a phone, in the order written here. Above `lg` the status
        cards — who you are, what you earn, how far along you are — narrow into an
        aside and the two things you act on, the tools and the coach, take the
        wide column, so neither of them starts below the fold.
      */}
      <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-5">
        <aside className="lg:order-2">
          <Card className="mb-3 !py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-hairline bg-white/[0.05] text-accent">
                <Icon name="User" size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-white/90">{t(brand.name)}</div>
                <span className="mt-0.5 inline-block rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] text-white/45">
                  {t(COPY.freePlan)}
                </span>
              </div>
              <Link to="/profile" aria-label="settings" className="text-white/35 transition hover:text-white">
                <Icon name="Settings" size={18} />
              </Link>
            </div>
          </Card>

          <Card className="mb-3 border-success/20 bg-[linear-gradient(160deg,rgba(16,40,32,0.85),rgba(10,14,14,0.9))]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-hairline bg-black/40 text-success">
                <Icon name="DollarSign" size={19} />
              </span>
              <div className="min-w-0 flex-1 text-end">
                <div className="text-[12px] text-white/70">{t(COPY.income)} 💰</div>
                <div className="text-[10.5px] text-success">{t(COPY.growth)}</div>
              </div>
            </div>
            <HeadlineField value={profile?.headline ?? '—'} onSave={saveHeadline} />
            <p className="mt-2 flex items-center justify-end gap-1 text-[10.5px] text-white/35">
              {t(COPY.onTrack)} <Icon name="TrendingUp" size={12} />
            </p>
          </Card>

          <Card className="mb-4">
            <h2 className="text-center text-[13px] font-semibold text-white/90">{t(COPY.path)}</h2>
            <div className="my-3">
              <ProgressBar percent={percent} />
            </div>
            <div className="mb-3 flex items-center justify-between text-[10.5px] text-white/40">
              <span>{t(COPY.completed).replace('{n}', num(percent))}</span>
              <span>{t(COPY.stageOf).replace('{done}', num(done)).replace('{total}', num(total))}</span>
            </div>
            <Link to="/levels" className="block">
              <PrimaryButton>{t(COPY.continue)}</PrimaryButton>
            </Link>
          </Card>
        </aside>

        <div className="lg:order-1 lg:col-span-2">
          <h2 className="text-center text-[15px] font-semibold text-white/90">{t(COPY.toolsTitle)}</h2>
          <p className="mb-3 text-center text-[11px] text-white/35">{t(COPY.toolsSubtitle)}</p>
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {aiTools.map((tool) => {
              const body = (
                <>
                  <span
                    className="block h-0.5 w-7 rounded-full"
                    style={{ background: `linear-gradient(90deg, ${tool.gradient[0]}, ${tool.gradient[1]})` }}
                  />
                  <span className="mt-3 block text-center text-[12.5px] font-medium text-white/90">{t(tool.title)}</span>
                  <span className="mt-2 flex items-center justify-end">
                    {tool.to ? (
                      <Icon name="ArrowUpRight" size={13} className="text-accent" />
                    ) : (
                      <SoonBadge />
                    )}
                  </span>
                </>
              )
              return tool.to ? (
                <Link
                  key={tool.id}
                  to={tool.to}
                  className="rounded-2xl border border-hairline bg-white/[0.03] p-3 transition hover:border-accent/40"
                >
                  {body}
                </Link>
              ) : (
                <div key={tool.id} className="rounded-2xl border border-hairline bg-white/[0.03] p-3">
                  {body}
                </div>
              )
            })}
          </div>

          <h2 className="text-center text-[15px] font-semibold text-white/90">{t(COPY.coachTitle)}</h2>
          <p className="mb-3 text-center text-[11px] text-white/35">{t(COPY.coachSubtitle)}</p>
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <IconTile name="Brain" gradient={['#6d28d9', '#8b5cf6']} size={40} />
              <div className="min-w-0 flex-1 text-end">
                <div className="text-[13px] font-semibold text-white/90">{t(COPY.coach)}</div>
                <div className="text-[10.5px] text-white/35">{t(COPY.ready)}</div>
              </div>
              <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[9.5px] text-success">
                {online ? t(COPY.online) : t(COPY.offline)}
              </span>
            </div>
            <Link to="/ai-coach" className="block">
              <PrimaryButton>
                <span className="inline-flex items-center gap-2">
                  <Icon name="MessageCircle" size={14} />
                  {t(COPY.startChat)}
                </span>
              </PrimaryButton>
            </Link>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
