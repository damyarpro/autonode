import type { Locale, SlotFormat } from '../data/types'

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/** Latin digits and separators → Persian, so numbers match the body copy. */
export function toFaDigits(input: string): string {
  return input.replace(/[0-9,.]/g, (ch) => {
    if (ch === ',') return '٬'
    if (ch === '.') return '٫'
    return FA_DIGITS[Number(ch)]
  })
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/**
 * Persian or Arabic digits → Latin. The inverse of `toFaDigits`, for the number
 * fields: a Persian keyboard types ۴۹۰۰۰۰۰ and the API wants 4900000.
 */
export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const fa = FA_DIGITS.indexOf(ch)
    return String(fa >= 0 ? fa : AR_DIGITS.indexOf(ch))
  })
}

/**
 * Fixed display rate for showing Toman amounts in English. It is a presentation
 * constant, not a live FX quote — the reference board used the same one.
 */
export const TOMAN_PER_USD_DISPLAY = 100_000

const group = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 })

export function formatMoney(toman: number, locale: Locale): string {
  if (locale === 'fa') {
    if (toman >= 1e9) return `${toFaDigits((toman / 1e9).toFixed(2))} میلیارد`
    if (toman >= 1e6) return `${toFaDigits(String(Math.round(toman / 1e6)))} میلیون`
    return toFaDigits(group(toman))
  }
  const usd = toman / TOMAN_PER_USD_DISPLAY
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`
  return `$${group(usd)}`
}

export function formatSlot(value: number, format: SlotFormat | undefined, locale: Locale): string {
  switch (format) {
    case 'money':
      return formatMoney(value, locale)
    case 'percent':
      return locale === 'fa' ? `${toFaDigits(String(value))}٪` : `${value}%`
    case 'days':
      return locale === 'fa' ? `${toFaDigits(String(value))} روز` : `${value} days`
    default:
      return locale === 'fa' ? toFaDigits(group(value)) : group(value)
  }
}
