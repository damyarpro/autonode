import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { Card, CardHead, PrimaryButton, Row, SoonBadge } from '../components/Card'
import { Icon } from '../components/Icon'
import { brand, withBrand } from '../data/brand'
import { patchJson } from '../api/client'
import { useAppState } from '../api/useAppState'
import { useI18n } from '../i18n/I18nProvider'

const COPY = {
  profile: { fa: 'پروفایل', en: 'Profile' },
  level: { fa: 'سطح {n}', en: 'Level {n}' },
  fullName: { fa: 'نام و نام خانوادگی:', en: 'Full name:' },
  phone: { fa: 'شماره تماس:', en: 'Phone:' },
  plan: { fa: 'اشتراک:', en: 'Plan:' },
  status: { fa: 'وضعیت:', en: 'Status:' },
  points: { fa: 'مجموع امتیازها:', en: 'Total points:' },
  connection: { fa: 'وضعیت اتصال:', en: 'Connection:' },
  connected: { fa: 'متصل به ربات', en: 'Bot connected' },
  notConnected: { fa: 'متصل نیست', en: 'Not connected' },
  inactive: { fa: 'غیرفعال', en: 'Inactive' },
  active: { fa: 'فعال', en: 'Active' },
  noPlan: { fa: 'بدون اشتراک', en: 'No plan' },
  editProfile: { fa: 'ویرایش پروفایل', en: 'Edit profile' },
  save: { fa: 'ذخیره', en: 'Save' },
  cancel: { fa: 'انصراف', en: 'Cancel' },

  business: { fa: 'بیزینس', en: 'Business' },
  businessTitle: { fa: 'پروفایل بیزینسی من', en: 'My business profile' },
  businessSub: { fa: 'چیزی که هر متن تولیدشده بر پایه‌ی آن نوشته می‌شود', en: 'What every generated word is based on' },
  enterProfile: { fa: 'ویرایش پروفایل بیزینسی', en: 'Edit business profile' },
  openBoard: { fa: 'بوم فروش', en: 'Sales board' },

  subscription: { fa: 'اشتراک', en: 'Subscription' },
  subscriptionTitle: { fa: 'اشتراک بدون اشتراک', en: 'No active subscription' },
  expires: { fa: 'تاریخ انقضا:', en: 'Expires:' },
  manageSub: { fa: 'مدیریت اشتراک', en: 'Manage subscription' },

  support: { fa: 'پشتیبانی', en: 'Support' },
  supportSub: { fa: 'با عشق از تیم {brand}', en: 'With love from the {brand} team' },
  supportBody: {
    fa: 'سلام! ما در {brand} متعهد به موفقیت شما هستیم. اگر سوالی دارید یا به کمک نیاز دارید، تیم پشتیبانی ما آماده خدمت‌رسانی است. ما اینجا هستیم تا در هر مرحله از مسیر رشد کسب‌وکارتان همراه شما باشیم.',
    en: 'We are committed to your success. If you have a question or need a hand, our support team is here at every step of the way.',
  },
  guide: { fa: 'راهنمای استفاده', en: 'User guide' },

  privacy: { fa: 'حریم خصوصی و امنیت', en: 'Privacy and security' },
  privacyTitle: { fa: 'تنظیمات امنیت حساب', en: 'Account security settings' },
  privacySub: { fa: 'مدیریت نام کاربری، رمز و نشست‌های فعال', en: 'Username, password and active sessions' },
  privacyBody: {
    fa: 'برای امنیت بیشتر، می‌تونی نام کاربری و رمز عبور رو به‌روزرسانی کنی و نشست‌های فعال حسابت روی دستگاه‌های مختلف رو ببینی و در صورت نیاز حذف کنی.',
    en: 'Update your username and password, review the sessions on your devices, and end any you do not recognise.',
  },
  privacySettings: { fa: 'تنظیمات حریم خصوصی', en: 'Privacy settings' },
  logout: { fa: 'خروج از حساب', en: 'Sign out' },
}

function EditForm({
  initial,
  onDone,
}: {
  initial: { fullName: string; phone: string }
  onDone: () => void
}) {
  const { t } = useI18n()
  const [fullName, setFullName] = useState(initial.fullName)
  const [phone, setPhone] = useState(initial.phone)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await patchJson('/api/profile', { fullName, phone })
      onDone()
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full rounded-xl border border-hairline bg-black/40 px-3 py-2 text-[12px] text-white/85 outline-none focus:border-accent/50'

  return (
    <div className="mt-3 space-y-2">
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t(COPY.fullName)} className={field} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t(COPY.phone)} className={field} />
      <div className="flex gap-2">
        <PrimaryButton onClick={submit} disabled={saving}>
          {t(COPY.save)}
        </PrimaryButton>
        <button
          type="button"
          onClick={onDone}
          className="w-32 rounded-xl border border-hairline py-2.5 text-[12.5px] text-white/50 transition hover:text-white"
        >
          {t(COPY.cancel)}
        </button>
      </div>
    </div>
  )
}

export default function Profile() {
  const { t, num, n, locale } = useI18n()
  const { profile, online, refresh } = useAppState()
  const [editing, setEditing] = useState(false)
  useEffect(() => setEditing(false), [profile?.fullName, profile?.phone])

  const dash = '—'

  return (
    <AppShell>
      <Card className="mb-3">
        <CardHead
          icon="User"
          kicker={COPY.profile}
          title={profile?.displayName ?? t(brand.name)}
          subtitle={t(COPY.level).replace('{n}', num(profile?.level ?? 0))}
        />
        <div className="mt-3 border-t border-hairline pt-2">
          <Row label={t(COPY.fullName)} value={profile?.fullName || dash} />
          <Row label={t(COPY.phone)} value={profile?.phone || dash} />
          <Row label={t(COPY.plan)} value={t(COPY.noPlan)} />
          <Row label={t(COPY.status)} value={<span className="text-success">{t(COPY.inactive)}</span>} />
          <Row
            label={t(COPY.points)}
            value={
              <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/20 text-[10px] text-white">
                {num(profile?.points ?? 0)}
              </span>
            }
          />
          <Row
            label={t(COPY.connection)}
            value={
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] ${
                  profile?.bot ? 'border-success/40 bg-success/10 text-success' : 'border-hairline text-white/35'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${profile?.bot ? 'bg-success' : 'bg-white/30'}`} />
                {profile?.bot
                  ? `${t(COPY.connected)} · ${profile.bot.username ?? ''} (ID: ${n(profile.bot.id)})`
                  : t(COPY.notConnected)}
              </span>
            }
          />
        </div>

        {editing ? (
          <EditForm
            initial={{ fullName: profile?.fullName ?? '', phone: profile?.phone ?? '' }}
            onDone={() => {
              setEditing(false)
              void refresh()
            }}
          />
        ) : (
          <div className="mt-3">
            <PrimaryButton onClick={() => setEditing(true)} disabled={!online}>
              {t(COPY.editProfile)}
            </PrimaryButton>
          </div>
        )}
      </Card>

      <Card className="mb-3">
        <CardHead
          icon="Briefcase"
          kicker={COPY.business}
          title={t(COPY.businessTitle)}
          subtitle={t(COPY.businessSub)}
        />
        <div className="mt-3 border-t border-hairline pt-2">
          <Row label={t(COPY.status)} value={t(COPY.active)} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Link to="/business" className="flex-1">
            <PrimaryButton>{t(COPY.enterProfile)}</PrimaryButton>
          </Link>
          <Link
            to="/sales-automation"
            className="flex flex-1 items-center justify-center rounded-xl border border-hairline py-2.5 text-[12.5px] text-white/70 transition hover:text-white"
          >
            {t(COPY.openBoard)}
          </Link>
        </div>
      </Card>

      <Card className="mb-3">
        <CardHead
          icon="CreditCard"
          kicker={COPY.subscription}
          title={t(COPY.subscriptionTitle)}
          subtitle={t(COPY.status) + ' ' + t(COPY.inactive)}
        />
        <div className="mt-3 border-t border-hairline pt-2">
          <Row label={t(COPY.expires)} value={profile?.planExpires ?? '-'} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled
            className="flex-1 rounded-xl border border-hairline py-2.5 text-[12.5px] text-white/30"
          >
            {t(COPY.manageSub)}
          </button>
          <SoonBadge />
        </div>
      </Card>

      <Card className="mb-3">
        <CardHead icon="MessageSquare" kicker={COPY.support} title={t(COPY.support)} subtitle={withBrand(t(COPY.supportSub), locale)} />
        <p className="mt-3 border-t border-hairline pt-3 text-[11.5px] leading-relaxed text-white/45">
          {withBrand(t(COPY.supportBody), locale)}
        </p>
        <div className="mt-3 flex gap-2">
          <Link to="/ai-coach" className="flex-1">
            <PrimaryButton>
              <span className="inline-flex items-center gap-2">
                <Icon name="Headphones" size={14} />
                {t(COPY.support)}
              </span>
            </PrimaryButton>
          </Link>
          <Link
            to="/levels"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-hairline py-2.5 text-[12.5px] text-white/70 transition hover:text-white"
          >
            <Icon name="BookOpen" size={14} />
            {t(COPY.guide)}
          </Link>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHead icon="Shield" kicker={COPY.privacy} title={t(COPY.privacyTitle)} subtitle={t(COPY.privacySub)} />
        <p className="mt-3 border-t border-hairline pt-3 text-[11.5px] leading-relaxed text-white/45">
          {t(COPY.privacyBody)}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled
            className="flex-1 rounded-xl border border-hairline py-2.5 text-[12.5px] text-white/30"
          >
            {t(COPY.privacySettings)}
          </button>
          <SoonBadge />
        </div>
      </Card>

      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline py-3 text-[12.5px] text-white/30"
      >
        <Icon name="LogOut" size={15} />
        {t(COPY.logout)}
      </button>
    </AppShell>
  )
}
