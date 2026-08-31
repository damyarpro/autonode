import { useI18n } from '../i18n/I18nProvider'

/** The one language toggle, shared by the board header and the desktop rail. */
export default function LocaleSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n()

  return (
    <div className={`flex items-center gap-0.5 rounded-lg border border-hairline bg-black/40 p-0.5 text-[11px] ${className}`}>
      {(['fa', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`rounded-[6px] px-2.5 py-1 transition ${
            locale === code ? 'bg-accent/25 text-white' : 'text-white/45 hover:text-white/80'
          }`}
        >
          {code === 'fa' ? 'فارسی' : 'EN'}
        </button>
      ))}
    </div>
  )
}
