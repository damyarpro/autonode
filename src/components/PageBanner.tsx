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
    <div className="flex items-center gap-3 rounded-2xl bg-[linear-gradient(100deg,#4c1d95,#7c3aed_55%,#8b5cf6)] px-4 py-3 shadow-[0_12px_34px_-18px_rgba(124,92,255,0.9)] lg:gap-4 lg:px-6 lg:py-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-white lg:h-12 lg:w-12 lg:rounded-2xl">
        <Icon name={icon} size={19} className="lg:hidden" />
        <Icon name={icon} size={23} className="hidden lg:block" />
      </span>
      <div className="min-w-0 flex-1">
        {/* At phone width the strip is the page's whole header, so it truncates.
            On a desktop it is 1088px of bar around a 14px title, which reads as
            an empty band — the type has to grow with it. */}
        <h1 className="truncate text-[14px] font-semibold text-white lg:text-[19px]">{t(title)}</h1>
        <p className="truncate text-[10.5px] text-white/70 lg:text-[12.5px]">{t(subtitle)}</p>
      </div>
      {actions}
    </div>
  )
}
