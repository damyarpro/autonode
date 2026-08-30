import { useState, type FormEvent } from 'react'
import { Card, PrimaryButton } from '../components/Card'
import { Icon } from '../components/Icon'
import { withBrand } from '../data/brand'
import { useI18n } from '../i18n/I18nProvider'
import type { LoginOutcome } from '../api/useSession'

const COPY = {
  title: { fa: 'ورود به {brand}', en: 'Sign in to {brand}' },
  subtitle: {
    fa: 'این نسخه با رمز عبور محافظت می‌شود. رمز را وارد کنید.',
    en: 'This instance is password protected. Enter the password to continue.',
  },
  password: { fa: 'رمز عبور', en: 'Password' },
  placeholder: { fa: 'رمز عبور را وارد کنید', en: 'Enter the password' },
  submit: { fa: 'ورود', en: 'Sign in' },
  working: { fa: 'در حال بررسی…', en: 'Checking…' },
  invalid: { fa: 'رمز عبور درست نیست.', en: 'That password is not correct.' },
  locked: {
    fa: 'تلاش‌های ناموفق زیاد بود. چند دقیقه صبر کنید و دوباره امتحان کنید.',
    en: 'Too many failed attempts. Wait a few minutes and try again.',
  },
  offline: {
    fa: 'سرور در دسترس نیست. اتصال را بررسی کنید.',
    en: 'The server is unreachable. Check the connection.',
  },
  empty: { fa: 'رمز عبور را وارد کنید.', en: 'Enter the password first.' },
  note: {
    fa: 'نشست شما تا خروج یا راه‌اندازی دوباره سرور معتبر است.',
    en: 'Your session lasts until you sign out or the server restarts.',
  },
}

const ERRORS: Record<Exclude<LoginOutcome, 'ok'> | 'empty', keyof typeof COPY> = {
  invalid: 'invalid',
  locked: 'locked',
  offline: 'offline',
  empty: 'empty',
}

/**
 * Deliberately outside `AppShell` — a login screen has no tabs to offer yet.
 * `login` comes from the app's single `useSession()` so the gate above it
 * re-renders on success.
 */
export default function Login({ login }: { login: (password: string) => Promise<LoginOutcome> }) {
  const { t, locale } = useI18n()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<keyof typeof ERRORS | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (password.length === 0) {
      setError('empty')
      return
    }
    setBusy(true)
    setError(null)
    const outcome = await login(password)
    setBusy(false)
    if (outcome === 'ok') {
      setPassword('')
      return
    }
    setPassword('')
    setError(outcome)
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
      <Card className="w-full max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[linear-gradient(135deg,#4c1d95,#7c3aed)] text-white">
              <Icon name="ShieldCheck" size={20} />
            </span>
            <div className="min-w-0 flex-1 text-start">
              <h1 className="text-[15px] font-semibold text-white/90">{withBrand(t(COPY.title), locale)}</h1>
              <p className="mt-1 text-[11px] leading-relaxed text-white/40">{t(COPY.subtitle)}</p>
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-start">
            <span className="text-[11px] text-white/45">{t(COPY.password)}</span>
            <input
              type="password"
              value={password}
              autoFocus
              autoComplete="current-password"
              placeholder={t(COPY.placeholder)}
              onChange={(event) => {
                setPassword(event.target.value)
                if (error) setError(null)
              }}
              className="w-full rounded-xl border border-hairline bg-white/[0.04] px-3 py-2.5 text-start text-[13px] text-white/90 outline-none transition placeholder:text-white/25 focus:border-accent/60"
            />
          </label>

          {error && (
            <p role="alert" className="flex items-start gap-2 text-[11.5px] leading-relaxed text-red-300">
              <span className="mt-0.5 shrink-0">
                <Icon name="Shield" size={13} />
              </span>
              <span className="text-start">{t(COPY[ERRORS[error]])}</span>
            </p>
          )}

          <PrimaryButton type="submit" disabled={busy}>
            {busy ? t(COPY.working) : t(COPY.submit)}
          </PrimaryButton>

          <p className="text-center text-[10px] text-white/25">{t(COPY.note)}</p>
        </form>
      </Card>
    </main>
  )
}
