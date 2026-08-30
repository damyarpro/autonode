import { useEffect, useRef, useState } from 'react'
import { KpiIcon } from './icons'
import { kpis, timeline } from '../data/pipeline'
import { useI18n } from '../i18n/I18nProvider'
import type { SlotFormat } from '../data/types'

/** Counts a value up from where it last sat, so live updates animate too. */
function useCountUp(target: number, duration = 800): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)

  useEffect(() => {
    const start = performance.now()
    const origin = from.current
    let frame = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(origin + (target - origin) * eased)
      if (p < 1) frame = requestAnimationFrame(step)
      else from.current = target
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return shown
}

function KpiValue({ value, format }: { value: number; format: SlotFormat }) {
  const { num } = useI18n()
  const shown = useCountUp(value)
  // Money and counts read badly mid-tween at full precision; percent needs one.
  const rounded = format === 'percent' ? Math.round(shown * 10) / 10 : Math.round(shown)
  return <span className="text-[19px] font-semibold tracking-tight text-white">{num(rounded, format)}</span>
}

export default function KpiBar({ metrics }: { metrics: Record<string, number> }) {
  const { t } = useI18n()

  return (
    <div className="border-b border-hairline bg-panel/70">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-2.5 text-[10px] text-white/35">
        <span>{t(timeline.start)}</span>
        {timeline.marks.map((mark) => (
          <span key={mark.en}>{t(mark)}</span>
        ))}
        <span className="ms-auto inline-flex items-center gap-1.5 text-white/55">
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden className="text-accent">
            <path d="M4 17l5-6 4 3 6-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t(timeline.highlight)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px border-t border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) => (
          <div
            key={kpi.id}
            className="rise-in flex items-center gap-3 bg-panel px-5 py-3.5"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <KpiIcon icon={kpi.icon} />
            <div className="min-w-0">
              <div className="truncate text-[10px] text-white/40">{t(kpi.label)}</div>
              <KpiValue value={metrics[kpi.metric] ?? kpi.value} format={kpi.format} />
              <div className="truncate text-[9.5px] text-white/30">{t(kpi.caption)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
