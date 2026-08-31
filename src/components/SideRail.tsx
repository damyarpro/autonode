import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import LocaleSwitch from './LocaleSwitch'
import { brand } from '../data/brand'
import { deepLinks, tabs } from '../data/nav'
import { useI18n } from '../i18n/I18nProvider'
import type { Bi } from '../data/types'

const COPY = {
  sections: { fa: 'بخش‌ها', en: 'Sections' },
  more: { fa: 'جاهای دیگر', en: 'Elsewhere' },
}

function RailLink({ to, icon, label, end }: { to: string; icon: string; label: Bi; end?: boolean }) {
  const { t } = useI18n()

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12.5px] transition ${
          isActive ? 'bg-accent/15 text-white' : 'text-white/45 hover:bg-white/[0.04] hover:text-white/80'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={icon} size={18} className={isActive ? 'text-accent' : ''} />
          <span className="truncate">{t(label)}</span>
        </>
      )}
    </NavLink>
  )
}

/**
 * The desktop navigation. A bottom bar is a phone pattern — on a wide screen it
 * wastes the height that matters and leaves the width empty — so above `lg` the
 * tabs move into a rail and the bar is hidden. Both read `src/data/nav.ts`.
 *
 * It is `fixed` at the inline start, which RTL mirrors to the right on its own.
 */
export default function SideRail() {
  const { t } = useI18n()

  return (
    <nav className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-hairline bg-panel/80 px-3 py-4 backdrop-blur lg:flex">
      <div className="px-3 pb-4">
        <div className="text-[13px] font-semibold text-white/90">{t(brand.name)}</div>
        <div className="text-[10.5px] text-white/35">{t(brand.tagline)}</div>
      </div>

      <div className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
        {t(COPY.sections)}
      </div>
      <ul className="space-y-0.5">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <RailLink to={tab.to} icon={tab.icon} label={tab.label} end={tab.to === '/'} />
          </li>
        ))}
      </ul>

      <div className="px-3 pb-1 pt-4 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
        {t(COPY.more)}
      </div>
      <ul className="space-y-0.5">
        {deepLinks.map((link) => (
          <li key={link.to}>
            <RailLink to={link.to} icon={link.icon} label={link.label} />
          </li>
        ))}
      </ul>

      <div className="mt-auto px-1 pt-4">
        <LocaleSwitch />
      </div>
    </nav>
  )
}
