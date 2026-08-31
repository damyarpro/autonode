import type { Bi, IconKey } from './types'

/**
 * Everything the right-click palette can put on a board. Rule 1: this is the
 * only place a node kind is described — the palette, the editor's defaults and
 * the sales board all read it, and adding a kind means editing this file alone.
 */

export const NODE_CATEGORIES = ['content', 'channel', 'capture', 'routing', 'sales', 'money', 'retention', 'plain'] as const
export type NodeCategory = (typeof NODE_CATEGORIES)[number]

export const CATEGORY_LABEL: Record<NodeCategory, Bi> = {
  content: { fa: 'تولید محتوا', en: 'Content' },
  channel: { fa: 'کانال‌ها', en: 'Channels' },
  capture: { fa: 'دریافت لید', en: 'Capture' },
  routing: { fa: 'مسیردهی و نرچر', en: 'Routing' },
  sales: { fa: 'فروش', en: 'Sales' },
  money: { fa: 'پول', en: 'Money' },
  retention: { fa: 'نگهداشت', en: 'Retention' },
  plain: { fa: 'عمومی', en: 'General' },
}

export type NodeKind = {
  id: string
  category: NodeCategory
  icon: IconKey
  /** What the palette calls it. */
  label: Bi
  /** One line in the palette saying what it is for. */
  hint: Bi
  /** What a freshly dropped node says, before the owner renames it. */
  defaults: { kicker?: Bi; title: Bi; meta?: Bi; width?: number }
  /**
   * The live metric this kind can show, when the board is the sales funnel.
   * A kind with none shows no number rather than an invented one (rule 5).
   */
  metric?: string
}

export const nodeKinds: NodeKind[] = [
  // ── content ────────────────────────────────────────────────────────────
  {
    id: 'elevenlabs',
    category: 'content',
    icon: 'elevenlabs',
    label: { fa: 'گویندگی', en: 'Voice-over' },
    hint: { fa: 'متن را به صدا تبدیل می‌کند', en: 'Turns a script into a voice-over' },
    defaults: {
      kicker: { fa: 'ELEVENLABS', en: 'ELEVENLABS' },
      title: { fa: 'تولید صدای برند', en: 'Brand voice production' },
      meta: { fa: 'فارسی · لحن برند · چند نسخه', en: 'Persian · Brand tone · Variants' },
    },
    metric: 'elevenlabs.stat',
  },
  {
    id: 'higgsfield',
    category: 'content',
    icon: 'higgsfield',
    label: { fa: 'ویدیوی تبلیغاتی', en: 'Ad video' },
    hint: { fa: 'از یک خلاصه ویدیو می‌سازد', en: 'Builds an ad video from a brief' },
    defaults: {
      kicker: { fa: 'HIGGSFIELD', en: 'HIGGSFIELD' },
      title: { fa: 'ساخت ویدیوی تبلیغاتی AI', en: 'AI ad video production' },
    },
    metric: 'higgsfield.stat',
  },
  {
    id: 'factory',
    category: 'content',
    icon: 'factory',
    label: { fa: 'کارخانه‌ی محتوا', en: 'Content factory' },
    hint: { fa: 'می‌نویسد و زمان‌بندی می‌کند', en: 'Writes and schedules the posts' },
    defaults: {
      kicker: { fa: 'کارخانه محتوا', en: 'CONTENT FACTORY' },
      title: { fa: 'موتور تولید و زمان‌بندی انتشار', en: 'Create & schedule publishing' },
      width: 330,
    },
    metric: 'factory.stat',
  },

  // ── channels ───────────────────────────────────────────────────────────
  {
    id: 'instagram',
    category: 'channel',
    icon: 'instagram',
    label: { fa: 'اینستاگرام', en: 'Instagram' },
    hint: { fa: 'ریلز، استوری و دایرکت', en: 'Reels, stories and DMs' },
    defaults: { kicker: { fa: 'INSTAGRAM', en: 'INSTAGRAM' }, title: { fa: 'ریلز، استوری و دایرکت', en: 'Reels, stories & DMs' } },
    metric: 'instagram.stat',
  },
  {
    id: 'telegram',
    category: 'channel',
    icon: 'telegram',
    label: { fa: 'تلگرام', en: 'Telegram' },
    hint: { fa: 'تنها کانالی که واقعاً می‌فرستد', en: 'The one channel that really sends' },
    defaults: { kicker: { fa: 'TELEGRAM', en: 'TELEGRAM' }, title: { fa: 'کانال و گفتگوی مستقیم', en: 'Channel & direct chat' } },
    metric: 'telegram.stat',
  },
  {
    id: 'linkedin',
    category: 'channel',
    icon: 'linkedin',
    label: { fa: 'لینکدین', en: 'LinkedIn' },
    hint: { fa: 'محتوای تخصصی B2B', en: 'B2B expert content' },
    defaults: { kicker: { fa: 'LINKEDIN', en: 'LINKEDIN' }, title: { fa: 'محتوای تخصصی B2B', en: 'B2B expert content' } },
    metric: 'linkedin.stat',
  },
  {
    id: 'youtube',
    category: 'channel',
    icon: 'youtube',
    label: { fa: 'یوتیوب', en: 'YouTube' },
    hint: { fa: 'آموزش و مطالعه‌ی موردی', en: 'Education and case studies' },
    defaults: { kicker: { fa: 'YOUTUBE', en: 'YOUTUBE' }, title: { fa: 'آموزش و مطالعه موردی', en: 'Education & case studies' } },
    metric: 'youtube.stat',
  },
  {
    id: 'website',
    category: 'channel',
    icon: 'website',
    label: { fa: 'وب‌سایت', en: 'Website' },
    hint: { fa: 'لندینگ، فرم و چت سایت', en: 'Landing page, form and site chat' },
    defaults: { kicker: { fa: 'WEBSITE', en: 'WEBSITE' }, title: { fa: 'لندینگ و چت سایت', en: 'Landing & website chat' } },
    metric: 'website.stat',
  },

  // ── capture and routing ────────────────────────────────────────────────
  {
    id: 'inbox',
    category: 'capture',
    icon: 'inbox',
    label: { fa: 'صندوق لید', en: 'Lead inbox' },
    hint: { fa: 'هر لید اینجا می‌نشیند و امتیاز می‌گیرد', en: 'Every lead lands here and is scored' },
    defaults: { kicker: { fa: 'صندوق لید', en: 'LEAD INBOX' }, title: { fa: 'جمع‌آوری یکپارچه لید', en: 'Unified lead capture' } },
    metric: 'inbox.stat',
  },
  {
    id: 'router',
    category: 'routing',
    icon: 'router',
    label: { fa: 'مسیریاب', en: 'Router' },
    hint: { fa: 'بر اساس امتیاز به داغ/گرم/سرد', en: 'Splits by score into hot, warm and cold' },
    defaults: { kicker: { fa: 'مسیریاب', en: 'ROUTER' }, title: { fa: 'مسیردهی بر اساس امتیاز', en: 'Route by score' } },
    metric: 'router.stat',
  },
  {
    id: 'hot',
    category: 'routing',
    icon: 'hot',
    label: { fa: 'مسیر داغ', en: 'Hot path' },
    hint: { fa: 'پیگیری سریع، دعوت به جلسه', en: 'Fast follow-up, straight to a meeting' },
    defaults: { kicker: { fa: 'داغ', en: 'HOT' }, title: { fa: 'پیگیری فوری', en: 'Immediate follow-up' } },
    metric: 'hot.stat',
  },
  {
    id: 'warm',
    category: 'routing',
    icon: 'warm',
    label: { fa: 'مسیر گرم', en: 'Warm path' },
    hint: { fa: 'سکانس آموزشی چندروزه', en: 'A multi-day teaching sequence' },
    defaults: { kicker: { fa: 'گرم', en: 'WARM' }, title: { fa: 'سکانس آموزشی', en: 'Teaching sequence' } },
    metric: 'warm.stat',
  },
  {
    id: 'cold',
    category: 'routing',
    icon: 'cold',
    label: { fa: 'مسیر سرد', en: 'Cold path' },
    hint: { fa: 'کند و کم‌فشار', en: 'Slow and low-pressure' },
    defaults: { kicker: { fa: 'سرد', en: 'COLD' }, title: { fa: 'نرچر بلندمدت', en: 'Long-term nurture' } },
    metric: 'cold.stat',
  },

  // ── sales ──────────────────────────────────────────────────────────────
  {
    id: 'vapi',
    category: 'sales',
    icon: 'voice',
    label: { fa: 'تماس صوتی', en: 'Voice call' },
    hint: { fa: 'بریف تماس می‌نویسد', en: 'Writes the call brief' },
    defaults: { kicker: { fa: 'VAPI VOICE AI', en: 'VAPI VOICE AI' }, title: { fa: 'پیگیری صوتی خودکار', en: 'Automated voice follow-up' } },
    metric: 'vapi.stat',
  },
  {
    id: 'salescall',
    category: 'sales',
    icon: 'calendar',
    label: { fa: 'جلسه‌ی فروش', en: 'Sales meeting' },
    hint: { fa: 'زمان آزاد، رزرو و یادآور', en: 'Free slots, booking and reminders' },
    defaults: { kicker: { fa: 'جلسه فروش', en: 'SALES CALL' }, title: { fa: 'آماده‌ی رزرو', en: 'Meeting ready to book' } },
    metric: 'salescall.stat',
  },
  {
    id: 'memory',
    category: 'sales',
    icon: 'memory',
    label: { fa: 'حافظه‌ی CRM', en: 'CRM memory' },
    hint: { fa: 'مرحله و تایم‌لاین هر لید', en: 'Each lead’s stage and timeline' },
    defaults: { kicker: { fa: 'CRM', en: 'CRM' }, title: { fa: 'حافظه‌ی مشتری', en: 'Customer memory' } },
    metric: 'memory.stat',
  },

  // ── money ──────────────────────────────────────────────────────────────
  {
    id: 'payment',
    category: 'money',
    icon: 'card',
    label: { fa: 'پرداخت', en: 'Checkout' },
    hint: { fa: 'صفحه‌ی پرداخت و تأیید آن', en: 'The checkout page and its confirmation' },
    defaults: { kicker: { fa: 'پرداخت', en: 'CHECKOUT' }, title: { fa: 'صفحه‌ی پرداخت', en: 'Checkout page' } },
    metric: 'payment.stat',
  },
  {
    id: 'sale',
    category: 'money',
    icon: 'check',
    label: { fa: 'فروش', en: 'Sale' },
    hint: { fa: 'فروش ثبت‌شده', en: 'The recorded sale' },
    defaults: { kicker: { fa: 'فروش', en: 'SALE' }, title: { fa: 'فروش ثبت‌شده', en: 'Sale recorded' } },
    metric: 'sale.stat',
  },
  {
    id: 'growth',
    category: 'money',
    icon: 'growth',
    label: { fa: 'حلقه‌ی رشد', en: 'Growth loop' },
    hint: { fa: 'سهمی از هر پرداخت به تبلیغات', en: 'A share of each payment back into ads' },
    defaults: { kicker: { fa: 'حلقه رشد', en: 'GROWTH LOOP' }, title: { fa: 'بازگشت بودجه', en: 'Budget reinvested' } },
    metric: 'growth.stat',
  },

  // ── retention ──────────────────────────────────────────────────────────
  {
    id: 'fulfillment',
    category: 'retention',
    icon: 'delivery',
    label: { fa: 'تحویل', en: 'Fulfilment' },
    hint: { fa: 'تحویل چیزی که فروخته شده', en: 'Delivering what was sold' },
    defaults: { kicker: { fa: 'تحویل', en: 'FULFILMENT' }, title: { fa: 'تحویل محصول', en: 'Deliver the product' } },
    metric: 'fulfillment.stat',
  },
  {
    id: 'support',
    category: 'retention',
    icon: 'support',
    label: { fa: 'پشتیبانی', en: 'Support' },
    hint: { fa: 'مربی AI بعد از فروش', en: 'The AI coach after the sale' },
    defaults: { kicker: { fa: 'پشتیبانی', en: 'SUPPORT' }, title: { fa: 'پشتیبانی مشتری', en: 'Customer support' } },
    metric: 'support.stat',
  },
  {
    id: 'referral',
    category: 'retention',
    icon: 'referral',
    label: { fa: 'معرفی', en: 'Referral' },
    hint: { fa: 'یک درخواست معرفی به هر مشتری', en: 'One introduction asked of each customer' },
    defaults: { kicker: { fa: 'معرفی', en: 'REFERRAL' }, title: { fa: 'حلقه‌ی معرفی', en: 'Referral loop' } },
    metric: 'referral.stat',
  },

  // ── general building blocks, for a board that is not this funnel ───────
  {
    id: 'plain',
    category: 'plain',
    icon: 'router',
    label: { fa: 'مرحله', en: 'Step' },
    hint: { fa: 'یک مرحله‌ی ساده، بدون عدد', en: 'A plain step, with no number' },
    defaults: { title: { fa: 'مرحله‌ی تازه', en: 'New step' } },
  },
  {
    id: 'decision',
    category: 'plain',
    icon: 'router',
    label: { fa: 'تصمیم', en: 'Decision' },
    hint: { fa: 'جایی که مسیر دو شاخه می‌شود', en: 'Where the path forks' },
    defaults: { kicker: { fa: 'تصمیم', en: 'DECISION' }, title: { fa: 'کدام مسیر؟', en: 'Which way?' } },
  },
  {
    id: 'note',
    category: 'plain',
    icon: 'memory',
    label: { fa: 'یادداشت', en: 'Note' },
    hint: { fa: 'توضیحی برای خودت روی بوم', en: 'A note to yourself on the board' },
    defaults: { kicker: { fa: 'یادداشت', en: 'NOTE' }, title: { fa: 'یادداشت', en: 'Note' } },
  },
]

export const nodeKindById = (id: string): NodeKind | undefined => nodeKinds.find((kind) => kind.id === id)

/** The palette, grouped the way the right-click menu lists it. */
export const kindsByCategory = (): { category: NodeCategory; kinds: NodeKind[] }[] =>
  NODE_CATEGORIES.map((category) => ({ category, kinds: nodeKinds.filter((kind) => kind.category === category) })).filter(
    (entry) => entry.kinds.length > 0,
  )
