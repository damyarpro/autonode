import { useState } from 'react'
import AppShell from '../components/AppShell'
import PageBanner from '../components/PageBanner'
import { Card, ProgressBar } from '../components/Card'
import { Icon } from '../components/Icon'
import { finalGoal, levels, levelsHeading, TOTAL_STAGES } from '../data/levels'
import { postJson } from '../api/client'
import { useAppState } from '../api/useAppState'
import { useI18n } from '../i18n/I18nProvider'
import type { Progress } from '../api/client'

const COPY = {
  banner: { fa: 'مراحل یادگیری', en: 'Learning path' },
  bannerSub: { fa: 'مسیر پیشرفت و تسلط بر کسب‌وکار', en: 'Progress and business mastery' },
  markDone: { fa: 'ثبت یک مرحله', en: 'Mark a stage done' },
  offline: { fa: 'API در دسترس نیست؛ پیشرفت ذخیره نمی‌شود.', en: 'API unreachable — progress will not be saved.' },
}

export default function Levels() {
  const { t, num } = useI18n()
  const { progress, online, refresh } = useAppState()
  const [busy, setBusy] = useState<number | null>(null)

  const doneFor = (levelId: number) => progress?.levels.find((l) => l.levelId === levelId)?.stagesDone ?? 0
  const percent = progress?.percent ?? 0
  const current = progress?.currentLevel ?? 1

  const advance = async (levelId: number) => {
    setBusy(levelId)
    try {
      await postJson<Progress>(`/api/progress/${levelId}`)
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <AppShell>
      <PageBanner icon="Trophy" title={COPY.banner} subtitle={COPY.bannerSub} />

      <h1 className="mt-5 text-center text-[19px] font-bold text-white">{t(levelsHeading.title)}</h1>
      <p className="mb-4 text-center text-[11.5px] text-white/35">{t(levelsHeading.subtitle)}</p>

      <Card className="mb-5">
        <div className="mb-2.5 flex items-baseline justify-between">
          <span className="text-[11px] text-white/40">
            {t(levelsHeading.levelOf).replace('{n}', num(current))}
          </span>
          <h2 className="text-[13px] font-semibold text-white/90">{t(levelsHeading.overall)}</h2>
        </div>
        <ProgressBar percent={percent} />
        <div className="mt-2 flex items-center justify-between text-[10px] text-white/30">
          <span>{t(levelsHeading.mastery)}</span>
          <span>{t(levelsHeading.start)}</span>
        </div>
      </Card>

      {!online && <p className="mb-4 text-center text-[11px] text-white/30">{t(COPY.offline)}</p>}

      {/*
        The path reads as one vertical run on a phone, which is what the dashed
        connector between the cards draws. Wider than that the run is mostly empty
        gutter, so the cards wrap into a grid and the connector — which means
        something only in single file — goes with it.
      */}
      <ol className="md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {levels.map((level, index) => {
          const done = doneFor(level.id)
          const levelPercent = Math.round((done / level.stages) * 100)
          const complete = done >= level.stages
          return (
            <li key={level.id}>
              <Card className={`md:h-full ${complete ? 'border-success/35' : ''}`}>
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-[13px] text-white ${
                      complete ? 'bg-[linear-gradient(135deg,#059669,#34d399)]' : 'bg-[linear-gradient(135deg,#4c1d95,#7c3aed)]'
                    }`}
                  >
                    <Icon name={complete ? 'ShieldCheck' : level.icon} size={20} />
                  </span>
                  <div className="min-w-0 flex-1 text-end">
                    <div className="text-[10px] text-white/35">
                      {t(levelsHeading.level).replace('{n}', num(level.id))}
                    </div>
                    <h3 className="text-[14px] font-semibold text-white/90">{t(level.title)}</h3>
                  </div>
                </div>

                <p className="mt-2.5 text-[11.5px] leading-relaxed text-white/45">{t(level.description)}</p>

                <div className="mt-3 flex items-baseline justify-between text-[10px] text-white/35">
                  <span>{num(levelPercent)}٪</span>
                  <span>{t(levelsHeading.progress)}</span>
                </div>
                <div className="mt-1">
                  <ProgressBar percent={levelPercent} />
                </div>

                <div className="mt-2.5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => advance(level.id)}
                    disabled={!online || complete || busy === level.id}
                    className="text-[11px] text-accent transition hover:text-white disabled:text-white/20"
                  >
                    {complete ? t(levelsHeading.details) : t(COPY.markDone)}
                  </button>
                  <span className="text-[10.5px] text-white/35">
                    {t(levelsHeading.stages).replace('{n}', num(level.stages))}
                  </span>
                </div>
              </Card>

              {index < levels.length - 1 && (
                <div className="mx-auto my-1.5 h-6 w-px border-s border-dashed border-success/40 md:hidden" />
              )}
            </li>
          )
        })}
      </ol>

      <div className="mx-auto my-2 flex h-8 items-end justify-center md:hidden">
        <Icon name="ChevronLeft" size={16} className="-rotate-90 text-success/60" />
      </div>

      <div className="mx-auto flex w-fit items-center gap-2.5 rounded-2xl border border-hairline bg-white/[0.03] px-4 py-2.5 md:mt-6">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[linear-gradient(135deg,#4c1d95,#7c3aed)] text-white">
          <Icon name="Target" size={15} />
        </span>
        <span className="text-[12px] font-medium text-white/85">{t(finalGoal)}</span>
      </div>

      <p className="mt-4 text-center text-[10px] text-white/20">
        {num(progress?.stagesDone ?? 0)} / {num(TOTAL_STAGES)}
      </p>
    </AppShell>
  )
}
