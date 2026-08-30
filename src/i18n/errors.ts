import type { Bi } from '../data/types'

/**
 * The server answers a bad request with machine-readable `field:code` strings
 * because it cannot write bilingual prose (rule 11). This is the other half of
 * that contract: the one place those codes become sentences.
 *
 * Adding a code on the server means adding its rule or its field label here in
 * the same commit — an untranslated code is shown raw rather than swallowed, so
 * the omission is visible instead of silent.
 */

/** What each field is called, for the pages that have no spec to read from. */
const FIELD_LABELS: Record<string, Bi> = {
  // business profile
  name: { fa: 'نام کسب‌وکار', en: 'Business name' },
  whatWeSell: { fa: 'چه چیزی می‌فروشی', en: 'What you sell' },
  audience: { fa: 'مخاطب', en: 'Audience' },
  tone: { fa: 'لحن', en: 'Tone' },
  priceToman: { fa: 'قیمت', en: 'Price' },
  ctaUrl: { fa: 'لینک دعوت به اقدام', en: 'Call-to-action link' },
  notes: { fa: 'توضیح‌های دیگر', en: 'Other notes' },

  // content factory
  count: { fa: 'تعداد', en: 'Count' },
  perDay: { fa: 'تعداد در روز', en: 'Per day' },
  channels: { fa: 'کانال‌ها', en: 'Channels' },
  channel: { fa: 'کانال', en: 'Channel' },
  status: { fa: 'وضعیت', en: 'Status' },
  locale: { fa: 'زبان', en: 'Language' },

  // studio
  script: { fa: 'متن گویندگی', en: 'Script' },
  brief: { fa: 'خلاصه‌ی ویدیو', en: 'Video brief' },
  voice: { fa: 'صدا', en: 'Voice' },
  style: { fa: 'سبک', en: 'Style' },

  // publishing — a channel that refused a piece names itself as the field
  target: { fa: 'مقصد انتشار', en: 'Publishing target' },
  instagram: { fa: 'اینستاگرام', en: 'Instagram' },
  telegram: { fa: 'تلگرام', en: 'Telegram' },
  linkedin: { fa: 'لینکدین', en: 'LinkedIn' },
  youtube: { fa: 'یوتیوب', en: 'YouTube' },
  website: { fa: 'وب‌سایت', en: 'Website' },

  // calls
  leadId: { fa: 'شناسه‌ی لید', en: 'Lead id' },
  slotStart: { fa: 'زمان جلسه', en: 'Meeting time' },
}

const labelFor = (fieldId: string, override?: Bi): Bi =>
  override ?? FIELD_LABELS[fieldId] ?? { fa: fieldId, en: fieldId }

/**
 * Turns one `field:code` string into a sentence. `label` overrides the built-in
 * dictionary, which is how the AI tool page uses its own spec's field labels.
 * `digits` converts a number in the code to Persian digits.
 */
export function explainCode(code: string, label?: Bi, digits: (value: string) => string = (v) => v): Bi {
  const [fieldId, rule, arg] = code.split(':')
  const name = labelFor(fieldId, label)

  switch (rule) {
    case 'required':
      return { fa: `«${name.fa}» را پر کن.`, en: `“${name.en}” is required.` }
    case 'not_text':
      return { fa: `«${name.fa}» باید متن باشد.`, en: `“${name.en}” must be text.` }
    case 'too_long':
      return {
        fa: `«${name.fa}» از ${digits(arg ?? '')} نویسه بلندتر است.`,
        en: `“${name.en}” is longer than ${arg ?? ''} characters.`,
      }
    case 'not_a_number':
      return { fa: `«${name.fa}» باید یک عدد مثبت باشد.`, en: `“${name.en}” must be a positive number.` }
    case 'not_a_list':
      return { fa: `«${name.fa}» باید یک فهرست باشد.`, en: `“${name.en}” must be a list.` }
    case 'not_a_url':
      return {
        fa: `«${name.fa}» باید با http:// یا https:// شروع شود.`,
        en: `“${name.en}” must start with http:// or https://.`,
      }
    case 'not_an_option':
      return {
        fa: `مقدار انتخاب‌شده برای «${name.fa}» معتبر نیست.`,
        en: `That is not a valid option for “${name.en}”.`,
      }
    case 'not_a_time':
      return { fa: `«${name.fa}» یک زمان معتبر نیست.`, en: `“${name.en}” is not a valid time.` }

    // Booking answers, which name a state rather than a shape.
    case 'past':
      return { fa: 'این زمان گذشته است. یکی از زمان‌های آزاد را انتخاب کن.', en: 'That time has passed. Pick a free slot.' }
    case 'taken':
      return { fa: 'این زمان قبلاً رزرو شده است.', en: 'That slot is already booked.' }
    case 'outside_hours':
      return {
        fa: 'این زمان بیرون از ساعت‌های کاری است.',
        en: 'That time falls outside your working hours.',
      }
    // Publishing answers, where the field id is the channel that refused.
    case 'rejected':
      return {
        fa: `«${name.fa}» این تکه را نپذیرفت.`,
        en: `“${name.en}” rejected this piece.`,
      }
    case 'unknown_lead':
      return { fa: 'این لید پیدا نشد.', en: 'No such lead.' }

    default:
      // An unknown code is still better shown than swallowed.
      return { fa: code, en: code }
  }
}
