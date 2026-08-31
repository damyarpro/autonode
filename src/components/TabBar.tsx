import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import { tabs } from '../data/nav'
import { useI18n } from '../i18n/I18nProvider'

/**
 * Fixed bottom navigation on a phone. Above `lg` the side rail takes over and
 * this is hidden, together with the space it reserves — see `--tabbar` in
 * src/styles/index.css.
 */
export default function TabBar() {
  const { t } = useI18n()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-[#0b0b12]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-2xl items-stretch">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[10px] transition ${
                  isActive ? 'text-accent' : 'text-white/40'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={tab.icon} size={21} className={isActive ? 'drop-shadow-[0_0_6px_rgba(124,92,255,0.7)]' : ''} />
                  {t(tab.label)}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
