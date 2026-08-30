import type { Bi, Locale } from './types'

/**
 * The product name, in one place. Rule 1 applies to the brand as much as to any
 * other label — it appears on the dashboard, the login screen, the profile and
 * the support copy, and none of those should carry a literal.
 */
export const brand = {
  /** Latin name, used as-is in both locales where a wordmark is wanted. */
  latin: 'Autonode',

  /** The name as a bilingual label. */
  name: { fa: 'موج ابزار', en: 'Autonode' } satisfies Bi,

  /** Both names together, for the browser tab and the console banner. */
  full: { fa: 'موج ابزار — Autonode', en: 'Autonode — موج ابزار' } satisfies Bi,

  tagline: {
    fa: 'ساخت کسب‌وکار با کمک هوش مصنوعی',
    en: 'Build a business with AI',
  } satisfies Bi,
}

/** Fills `{brand}` in a translated string, so copy never hard-codes the name. */
export const withBrand = (text: string, locale: Locale): string =>
  text.replace(/\{brand\}/g, brand.name[locale])
