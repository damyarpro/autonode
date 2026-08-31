import { Link, NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import LocaleSwitch from './LocaleSwitch'
import { heading } from '../data/pipeline'
import { useI18n } from '../i18n/I18nProvider'

const NAV = [
  { to: '/sales-automation', label: { en: 'Board', fa: 'بوم' } },
  { to: '/leads', label: { en: 'Leads', fa: 'لیدها' } },
  { to: '/inbox', label: { en: 'Inbox', fa: 'صندوق' } },
]

const BACK = { en: 'Tools', fa: 'ابزارها' }

/**
 * Shared chrome: title, live indicator, navigation and the locale switch.
 *
 * Above `lg` the side rail already carries these three destinations and the
 * locale switch, so the header drops both rather than showing them twice, and
 * becomes a single title line. On a phone there is no rail, so the links get a
 * row of their own under the title instead of wrapping through it.
 */
export default function AppHeader({ connected }: { connected?: boolean }) {
  const { t } = useI18n()

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline bg-panel/70 px-4 py-2.5 lg:px-5 lg:py-3">
      <Link
        to="/tools"
        aria-label={t(BACK)}
        title={t(BACK)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-hairline text-accent transition hover:border-accent/50"
      >
        <Icon name="ChevronLeft" size={15} className="rtl:rotate-180" />
      </Link>
      <h1 className="text-[14px] font-semibold tracking-tight lg:text-[15px]">{t(heading.title)}</h1>

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

      <div className="ms-auto lg:hidden">
        <LocaleSwitch />
      </div>

      <nav className="order-last flex w-full items-center gap-1 text-[12px] lg:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-lg px-2.5 py-1.5 transition ${
                isActive ? 'bg-white/[0.08] text-white' : 'text-white/45 hover:text-white/80'
              }`
            }
          >
            {t(item.label)}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
