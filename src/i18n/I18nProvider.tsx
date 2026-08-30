import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Bi, Locale } from '../data/types'

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/** Latin digits and separators → Persian, so badge counts match the body copy. */
export function toFaDigits(input: string): string {
  return input.replace(/[0-9,.]/g, (ch) => {
    if (ch === ',') return '٬'
    if (ch === '.') return '٫'
    return FA_DIGITS[Number(ch)]
  })
}

type I18nValue = {
  locale: Locale
  isRtl: boolean
  setLocale: (next: Locale) => void
  toggle: () => void
  /** Pick the active side of a bilingual string. */
  t: (value: Bi) => string
  /** Render a numeric string in the active locale's digits. */
  n: (value: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('fa')

  useEffect(() => {
    const root = document.documentElement
    root.lang = locale
    root.dir = locale === 'fa' ? 'rtl' : 'ltr'
    root.classList.toggle('locale-fa', locale === 'fa')
  }, [locale])

  const toggle = useCallback(() => setLocale((prev) => (prev === 'fa' ? 'en' : 'fa')), [])

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      isRtl: locale === 'fa',
      setLocale,
      toggle,
      t: (bi) => bi[locale],
      n: (raw) => (locale === 'fa' ? toFaDigits(raw) : raw),
    }),
    [locale, toggle],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
