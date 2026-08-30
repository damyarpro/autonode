import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import { useI18n } from '../i18n/I18nProvider'
import type { Bi } from '../data/types'

const TABS: { to: string; icon: string; label: Bi }[] = [
  { to: '/', icon: 'Home', label: { fa: 'داشبورد', en: 'Dashboard' } },
  { to: '/levels', icon: 'Trophy', label: { fa: 'مراحل', en: 'Levels' } },
  { to: '/profile', icon: 'User', label: { fa: 'پروفایل', en: 'Profile' } },
  { to: '/ai-coach', icon: 'Brain', label: { fa: 'AI کوچ', en: 'AI coach' } },
  { to: '/tools', icon: 'Wrench', label: { fa: 'ابزارها', en: 'Tools' } },
]

/** Fixed bottom navigation, in the screenshots' order (dashboard on the right). */
export default function TabBar() {
  const { t } = useI18n()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-[#0b0b12]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-2xl items-stretch">
        {TABS.map((tab) => (
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
