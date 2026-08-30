import { useEffect, useState } from 'react'
import { KpiIcon } from './icons'
import { kpis, timeline } from '../data/pipeline'
import { useI18n } from '../i18n/I18nProvider'

const DIGIT_RUN = /[\d۰-۹][\d۰-۹.,٫٬]*/

/** Counts the first number inside a formatted string up from zero on mount. */
function useCountUp(text: string, duration = 900): string {
  const [rendered, setRendered] = useState(text)

  useEffect(() => {
    const match = DIGIT_RUN.exec(text)
    if (!match) {
      setRendered(text)
      return
    }

    const raw = match[0]
    const isFarsi = /[۰-۹]/.test(raw)
    const normalised = raw.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[,٬]/g, '').replace('٫', '.')
    const target = Number(normalised)
    if (!Number.isFinite(target)) {
      setRendered(text)
      return
    }

    const decimals = normalised.includes('.') ? normalised.split('.')[1].length : 0
    const render = (value: number) => {
      let out = value.toFixed(decimals)
      if (isFarsi) out = out.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]).replace('.', '٫')
      setRendered(text.replace(raw, out))
    }

    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      render(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [text, duration])

  return rendered
}

function KpiValue({ text }: { text: string }) {
  return <span className="text-[19px] font-semibold tracking-tight text-white">{useCountUp(text)}</span>
}

export default function KpiBar() {
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
              <KpiValue text={t(kpi.value)} />
              <div className="truncate text-[9.5px] text-white/30">{t(kpi.caption)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
