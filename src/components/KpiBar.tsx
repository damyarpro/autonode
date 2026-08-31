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
  return <span className="text-[17px] font-semibold tracking-tight text-white lg:text-[19px]">{num(rounded, format)}</span>
}

/**
 * The four headline numbers above the board.
 *
 * On a phone they are two by two and the canvas keeps the rest of the screen:
 * four stacked cards ate more than a third of the height and left the board a
 * letterbox. The tile drops its glyph and its caption below `sm` — the label and
 * the number are the part that has to survive a 195px column — and everything
 * comes back from `lg`, where four across fit on one line.
 */
export default function KpiBar({ metrics }: { metrics: Record<string, number> }) {
  const { t } = useI18n()

  return (
    <div className="border-b border-hairline bg-panel/70">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-[10px] text-white/35 lg:gap-x-8 lg:px-5 lg:py-2.5">
        <span>{t(timeline.start)}</span>
        {/* The rail between the marks is context, not a measurement; a narrow
            screen spends its width on the numbers instead. */}
        {timeline.marks.map((mark) => (
          <span key={mark.en} className="hidden sm:inline">
            {t(mark)}
          </span>
        ))}
        <span className="inline-flex min-w-0 items-start gap-1.5 text-white/55 sm:ms-auto sm:items-center">
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden className="mt-0.5 shrink-0 text-accent sm:mt-0">
            <path d="M4 17l5-6 4 3 6-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t(timeline.highlight)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-hairline bg-hairline lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <div
            key={kpi.id}
            className="rise-in flex items-center gap-3 bg-panel px-3.5 py-2.5 lg:px-5 lg:py-3.5"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="hidden sm:block">
              <KpiIcon icon={kpi.icon} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] leading-snug text-white/40 sm:truncate">{t(kpi.label)}</div>
              <KpiValue value={metrics[kpi.metric] ?? kpi.value} format={kpi.format} />
              <div className="hidden truncate text-[9.5px] text-white/30 sm:block">{t(kpi.caption)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
