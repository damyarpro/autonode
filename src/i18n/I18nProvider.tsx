import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Bi, Locale, Slot, SlotFormat } from '../data/types'
import { formatSlot, toFaDigits } from './format'

export { toFaDigits } from './format'

type I18nValue = {
  locale: Locale
  isRtl: boolean
  setLocale: (next: Locale) => void
  toggle: () => void
  /** Pick the active side of a bilingual string. */
  t: (value: Bi) => string
  /** Render a numeric string in the active locale's digits. */
  n: (value: string) => string
  /** Format a raw number for the active locale. */
  num: (value: number, format?: SlotFormat) => string
  /** Render a slot, substituting `{n}` in its wrapper text. */
  slot: (slot: Slot | undefined, live?: number) => string | undefined
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

  const value = useMemo<I18nValue>(() => {
    const num = (raw: number, format?: SlotFormat) => formatSlot(raw, format, locale)
    return {
      locale,
      isRtl: locale === 'fa',
      setLocale,
      toggle,
      t: (bi) => bi[locale],
      n: (raw) => (locale === 'fa' ? toFaDigits(raw) : raw),
      num,
      slot: (slotValue, live) => {
        if (!slotValue) return undefined
        const formatted = num(live ?? slotValue.value, slotValue.format)
        return slotValue.text ? slotValue.text[locale].replace('{n}', formatted) : formatted
      },
    }
  }, [locale, toggle])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
