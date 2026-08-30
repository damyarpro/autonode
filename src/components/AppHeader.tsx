import { NavLink } from 'react-router-dom'
import { heading } from '../data/pipeline'
import { useI18n } from '../i18n/I18nProvider'

const NAV = [
  { to: '/sales-automation', label: { en: 'Board', fa: 'بوم' } },
  { to: '/leads', label: { en: 'Leads', fa: 'لیدها' } },
  { to: '/inbox', label: { en: 'Inbox', fa: 'صندوق' } },
]

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

/** Shared chrome: title, live indicator, navigation and the locale switch. */
export default function AppHeader({ connected }: { connected?: boolean }) {
  const { t } = useI18n()

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-hairline bg-panel/70 px-5 py-3">
      <span className="grid h-7 w-7 place-items-center rounded-md border border-hairline text-[11px] font-semibold text-accent">
        ⌘
      </span>
      <h1 className="text-[15px] font-semibold tracking-tight">{t(heading.title)}</h1>

      {connected !== undefined && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] ${
            connected ? 'border-success/40 text-success' : 'border-hairline text-white/35'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse bg-success' : 'bg-white/30'}`} />
          {t(connected ? heading.live : heading.offline)}
        </span>
      )}

      <nav className="ms-4 flex items-center gap-1 text-[12px]">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-lg px-2.5 py-1 transition ${
                isActive ? 'bg-white/[0.08] text-white' : 'text-white/45 hover:text-white/80'
              }`
            }
          >
            {t(item.label)}
          </NavLink>
        ))}
      </nav>

      <div className="ms-auto">
        <LocaleSwitch />
      </div>
    </header>
  )
}
