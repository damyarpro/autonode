import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { useI18n } from '../i18n/I18nProvider'
import type { Bi } from '../data/types'

/** The purple gradient strip at the top of each tab. */
export default function PageBanner({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: string
  title: Bi
  subtitle: Bi
  actions?: ReactNode
}) {
  const { t } = useI18n()

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[linear-gradient(100deg,#4c1d95,#7c3aed_55%,#8b5cf6)] px-4 py-3 shadow-[0_12px_34px_-18px_rgba(124,92,255,0.9)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-white">
        <Icon name={icon} size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[14px] font-semibold text-white">{t(title)}</h1>
        <p className="truncate text-[10.5px] text-white/70">{t(subtitle)}</p>
      </div>
      {actions}
    </div>
  )
}
