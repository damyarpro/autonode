import KpiBar from '../components/KpiBar'
import PipelineCanvas from '../components/PipelineCanvas'
import { heading } from '../data/pipeline'
import { useI18n } from '../i18n/I18nProvider'

function LocaleSwitch() {
  const { locale, setLocale } = useI18n()
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-hairline bg-black/40 p-0.5 text-[11px]">
      {(['fa', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`rounded-[6px] px-2.5 py-1 transition ${
            locale === code ? 'bg-accent/25 text-white' : 'text-white/45 hover:text-white/80'
          }`}
        >
          {code === 'fa' ? 'فارسی' : 'EN'}
        </button>
      ))}
    </div>
  )
}

export default function SalesAutomation() {
  const { t } = useI18n()

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="flex items-center gap-3 border-b border-hairline bg-panel/70 px-5 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-md border border-hairline text-[11px] font-semibold text-accent">
          ⌘
        </span>
        <h1 className="text-[15px] font-semibold tracking-tight">{t(heading.title)}</h1>
        <span className="rounded-full border border-hairline px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-white/35">
          demo
        </span>
        <div className="ms-auto">
          <LocaleSwitch />
        </div>
      </header>

      <KpiBar />

      <main className="relative min-h-0 flex-1">
        <span className="pointer-events-none absolute end-6 top-4 z-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/25">
          {t(heading.band)}
        </span>
        <PipelineCanvas />
      </main>

      <footer className="border-t border-hairline bg-panel/70 px-5 py-2.5 text-[10px] leading-relaxed text-white/30">
        {t(heading.disclaimer)}
      </footer>
    </div>
  )
}
