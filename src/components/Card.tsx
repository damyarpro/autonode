import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { useI18n } from '../i18n/I18nProvider'
import type { Bi } from '../data/types'

/** The dark rounded panel every page is built from. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-hairline bg-[linear-gradient(160deg,rgba(24,24,34,0.9),rgba(12,12,18,0.9))] p-4 ${className}`}
    >
      {children}
    </section>
  )
}

/** Kicker / title / subtitle block with the icon tile on the leading edge. */
export function CardHead({
  kicker,
  title,
  subtitle,
  icon,
  gradient = ['#6d28d9', '#8b5cf6'],
}: {
  kicker?: Bi
  title: string
  subtitle?: string
  icon: string
  gradient?: [string, string]
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-start gap-3">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] text-white"
        style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
      >
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        {kicker && <div className="text-[10px] text-white/35">{t(kicker)}</div>}
        <h2 className="truncate text-[14px] font-semibold text-white/90">{title}</h2>
        {subtitle && <p className="truncate text-[11px] text-accent/80">{subtitle}</p>}
      </div>
    </div>
  )
}

/** Label / value row, used down the profile page. */
export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[12px]">
      <span className="text-white/40">{label}</span>
      <span className="text-white/85">{value}</span>
    </div>
  )
}

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-[linear-gradient(100deg,#4c1d95,#7c3aed)] py-2.5 text-[12.5px] font-medium text-white transition hover:brightness-110 disabled:opacity-40"
    >
      {children}
    </button>
  )
}

/** Honest marker for a destination this repo has not built yet. */
export function SoonBadge() {
  const { t } = useI18n()
  return (
    <span className="rounded-full border border-hairline bg-white/[0.05] px-1.5 py-0.5 text-[8.5px] text-white/35">
      {t({ fa: 'به‌زودی', en: 'soon' })}
    </span>
  )
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#22d3ee)] transition-[width] duration-700"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  )
}
