import type { Kpi, StageEdge, StageNode } from './types'

/**
 * Single source of truth for the demo canvas. Every figure here is
 * illustrative — nothing in this repo talks to a real CRM, ad account or
 * payment gateway. Edit this file to reshape the graph; the components below
 * render whatever it declares.
 */

export const kpis: Kpi[] = [
  {
    id: 'deal',
    icon: 'deal',
    label: { en: 'Average deal value', fa: 'میانگین ارزش قرارداد' },
    value: { en: '$274', fa: '۲۷ میلیون' },
    caption: { en: 'per closed-won deal', fa: 'به ازای هر فروش موفق' },
  },
  {
    id: 'pipeline',
    icon: 'pipeline',
    label: { en: 'Active pipeline value', fa: 'ارزش پایپلاین فعال' },
    value: { en: '$38.6K', fa: '۳٫۸۶ میلیارد' },
    caption: { en: 'open opportunities this period', fa: 'فرصت‌های باز در این دوره' },
  },
  {
    id: 'close',
    icon: 'close',
    label: { en: 'Meeting close rate', fa: 'نرخ بستن جلسه' },
    value: { en: '34.1%', fa: '۳۴٫۱٪' },
    caption: { en: '47 wins from 138 calls', fa: '۴۷ فروش از ۱۳۸ تماس' },
  },
  {
    id: 'cycle',
    icon: 'cycle',
    label: { en: 'Average sales cycle', fa: 'میانگین چرخه فروش' },
    value: { en: '18 days', fa: '۱۸ روز' },
    caption: { en: 'lead to payment', fa: 'از لید تا پرداخت' },
  },
]

export const timeline = {
  start: { en: 'Period start', fa: 'شروع دوره' },
  marks: [
    { en: 'Week 1', fa: 'هفته ۱' },
    { en: 'Week 3', fa: 'هفته ۳' },
    { en: 'Today', fa: 'امروز' },
  ],
  highlight: {
    en: 'Largest growth opportunity: qualified lead → booked call',
    fa: 'بزرگ‌ترین فرصت رشد: لید واجد شرایط ← جلسه رزروشده',
  },
}

export const heading = {
  title: { en: 'Sales automation', fa: 'خودکارسازی فروش' },
  band: { en: 'Automated revenue engine', fa: 'موتور خودکار درآمد' },
  disclaimer: {
    en: 'Numbers and positions are illustrative; the live version connects to each business’s content factory, CRM, messaging and payment stack.',
    fa: 'اعداد و موقعیت‌ها نمایشی‌اند؛ نسخه‌ی زنده به کارخانه محتوا، CRM، پیام‌رسان و درگاه پرداخت هر کسب‌وکار متصل می‌شود.',
  },
}

export const nodes: StageNode[] = [
  // ── 1. content factory ───────────────────────────────────────────────
  {
    id: 'elevenlabs',
    x: 0,
    y: 40,
    icon: 'elevenlabs',
    aiStack: true,
    badge: '11',
    kicker: { en: 'ELEVENLABS', fa: 'ELEVENLABS' },
    title: { en: 'Brand voice production', fa: 'تولید صدای برند' },
    meta: { en: 'Persian · Brand tone · Variants', fa: 'فارسی · لحن برند · چند نسخه' },
    stat: { en: 'voiceovers made 18', fa: 'صداهای ساخته‌شده ۱۸' },
  },
  {
    id: 'higgsfield',
    x: 0,
    y: 420,
    icon: 'higgsfield',
    aiStack: true,
    badge: '7',
    kicker: { en: 'HIGGSFIELD', fa: 'HIGGSFIELD' },
    title: { en: 'AI ad video production', fa: 'ساخت ویدیوی تبلیغاتی AI' },
    meta: { en: 'Product · Avatar · Cinematic motion', fa: 'محصول · آواتار · حرکت سینمایی' },
    stat: { en: 'videos ready 11', fa: 'ویدیوهای آماده ۱۱' },
  },
  {
    id: 'factory',
    x: 400,
    y: 220,
    width: 330,
    icon: 'factory',
    aiStack: true,
    badge: '16',
    chain: ['elevenlabs', 'higgsfield', 'youtube', 'instagram'],
    kicker: { en: 'CONTENT FACTORY', fa: 'کارخانه محتوا' },
    title: { en: 'Create & schedule publishing', fa: 'موتور تولید و زمان‌بندی انتشار' },
    meta: { en: 'Voice + Video + Copy → Final content', fa: 'صدا + ویدیو + متن ← محتوای نهایی' },
    stat: { en: 'active pieces 28', fa: '۲۸ محتوای فعال' },
  },

  // ── 2. distribution channels ─────────────────────────────────────────
  {
    id: 'instagram',
    x: 880,
    y: -60,
    icon: 'instagram',
    badge: '7',
    kicker: { en: 'INSTAGRAM', fa: 'INSTAGRAM' },
    title: { en: 'Reels, stories & DMs', fa: 'ریلز، استوری و دایرکت' },
    stat: { en: 'intent signals 826', fa: 'سیگنال خرید ۸۲۶' },
    stat2: { en: '76.1K reach', fa: 'بازدید ۷۶٫۱ هزار' },
  },
  {
    id: 'telegram',
    x: 880,
    y: 90,
    icon: 'telegram',
    badge: '4',
    kicker: { en: 'TELEGRAM', fa: 'TELEGRAM' },
    title: { en: 'Channel & direct chat', fa: 'کانال و گفتگوی مستقیم' },
    stat: { en: 'clicks and replies 419', fa: 'کلیک و پاسخ ۴۱۹' },
    stat2: { en: '26.3K reach', fa: 'بازدید ۲۶٫۳ هزار' },
  },
  {
    id: 'linkedin',
    x: 880,
    y: 240,
    icon: 'linkedin',
    badge: '3',
    kicker: { en: 'LINKEDIN', fa: 'LINKEDIN' },
    title: { en: 'B2B expert content', fa: 'محتوای تخصصی B2B' },
    stat: { en: 'professional leads 238', fa: 'لید حرفه‌ای ۲۳۸' },
    stat2: { en: '21.3K reach', fa: 'بازدید ۲۱٫۳ هزار' },
  },
  {
    id: 'youtube',
    x: 880,
    y: 390,
    icon: 'youtube',
    badge: '2',
    kicker: { en: 'YOUTUBE', fa: 'YOUTUBE' },
    title: { en: 'Education & case studies', fa: 'آموزش و مطالعه موردی' },
    stat: { en: 'min watch time 5.4', fa: 'میانگین تماشا ۵٫۴ دقیقه' },
    stat2: { en: '11.4K views', fa: '۱۱٫۴ هزار بازدید' },
  },
  {
    id: 'website',
    x: 880,
    y: 540,
    icon: 'website',
    badge: '2',
    kicker: { en: 'WEBSITE', fa: 'WEBSITE' },
    title: { en: 'Landing & website chat', fa: 'لندینگ و چت سایت' },
    stat: { en: 'conversations 359', fa: 'گفتگو ۳۵۹' },
    stat2: { en: 'visits 6,815', fa: 'بازدید ۶٬۸۱۵' },
  },

  // ── 3. capture ───────────────────────────────────────────────────────
  {
    id: 'inbox',
    x: 1300,
    y: 240,
    icon: 'inbox',
    badge: '1,842',
    kicker: { en: 'LEAD INBOX', fa: 'صندوق لید' },
    title: { en: 'Unified lead capture', fa: 'جمع‌آوری یکپارچه لید' },
    meta: { en: 'DM · Form · Chat · Link', fa: 'دایرکت · فرم · چت · لینک' },
    stat: { en: 'leads 2,334', fa: 'لید ۲٬۳۳۴' },
  },

  // ── 4. routing ───────────────────────────────────────────────────────
  {
    id: 'router',
    x: 1700,
    y: 240,
    icon: 'router',
    badge: '1,716',
    kicker: { en: 'ROUTER', fa: 'روتر' },
    title: { en: 'Personal sales routes', fa: 'مسیرهای فروش شخصی' },
    meta: { en: 'by score and behaviour', fa: 'بر اساس امتیاز و رفتار' },
    stat: { en: 'identity complete 1,069', fa: 'شناسایی کامل ۱٬۰۶۹' },
  },
  {
    id: 'hot',
    x: 2100,
    y: 20,
    icon: 'hot',
    aiStack: true,
    badge: '316',
    kicker: { en: 'HOT ROUTE', fa: 'مسیر داغ' },
    title: { en: 'Personal AI outreach', fa: 'پیگیری شخصی با AI' },
    meta: { en: 'Under 2 minutes to reply', fa: 'زیر ۲ دقیقه تا پاسخ' },
    stat: { en: 'active conversations 405', fa: 'گفتگوی فعال ۴۰۵' },
  },
  {
    id: 'warm',
    x: 2100,
    y: 250,
    icon: 'warm',
    aiStack: true,
    badge: '906',
    kicker: { en: 'WARM ROUTE', fa: 'مسیر گرم' },
    title: { en: 'Multi-step smart nurture', fa: 'نرچر هوشمند چندمرحله‌ای' },
    meta: { en: 'Educate · Prove · Offer', fa: 'آموزش · اثبات · پیشنهاد' },
    stat: { en: 'leads in sequence 1,245', fa: 'لید در سکانس ۱٬۲۴۵' },
  },
  {
    id: 'cold',
    x: 2100,
    y: 480,
    icon: 'cold',
    badge: '320',
    kicker: { en: 'COLD ROUTE', fa: 'مسیر سرد' },
    title: { en: 'Content retargeting', fa: 'ریتارگتینگ محتوایی' },
    meta: { en: 'Watch · Read · Return', fa: 'تماشا · مطالعه · بازگشت' },
    stat: { en: 'interest sequences 4', fa: 'سکانس علاقه‌مندی ۴' },
  },

  // ── 5. conversion ────────────────────────────────────────────────────
  {
    id: 'vapi',
    x: 2520,
    y: 20,
    icon: 'voice',
    aiStack: true,
    badge: '76',
    kicker: { en: 'VAPI VOICE AI', fa: 'VAPI VOICE AI' },
    title: { en: 'Automated voice follow-up', fa: 'پیگیری صوتی خودکار' },
    meta: { en: 'Qualify · Handle doubts · Book', fa: 'صلاحیت · رفع شبهه · رزرو' },
    stat: { en: 'AI calls 105', fa: 'تماس AI ۱۰۵' },
  },
  {
    id: 'salescall',
    x: 2940,
    y: 20,
    icon: 'calendar',
    badge: '138',
    kicker: { en: 'SALES CALL', fa: 'جلسه فروش' },
    title: { en: 'Meeting ready to book', fa: 'آماده‌ی رزرو' },
    meta: { en: 'Booking · Reminder · AI brief', fa: 'رزرو · یادآوری · بریف AI' },
    stat: { en: 'calls 181', fa: 'تماس ۱۸۱' },
  },
  {
    id: 'memory',
    x: 2520,
    y: 320,
    icon: 'memory',
    badge: '1,604',
    kicker: { en: 'SYSTEM MEMORY', fa: 'حافظه سیستم' },
    title: { en: 'CRM & next best action', fa: 'CRM و اقدام بعدی' },
    meta: { en: 'Owner · Stage · Value · Timing', fa: 'مالک · مرحله · ارزش · زمان' },
    stat: { en: 'live records 2,078', fa: 'رکورد زنده ۲٬۰۷۸' },
  },

  // ── 6. payment, growth loop and post-sale ────────────────────────────
  {
    id: 'payment',
    x: 3360,
    y: 20,
    icon: 'card',
    badge: '47',
    kicker: { en: 'PAYMENT GATEWAY', fa: 'درگاه پرداخت' },
    title: { en: 'Checkout & invoicing', fa: 'تسویه و صورتحساب' },
    meta: { en: 'Link · Instalment · Receipt', fa: 'لینک · قسطی · رسید' },
    stat: { en: 'successful payments 47', fa: 'تراکنش موفق ۴۷' },
  },
  {
    id: 'sale',
    x: 3780,
    y: 20,
    icon: 'check',
    variant: 'success',
    badge: '47',
    kicker: { en: 'FINAL SALE', fa: 'فروش نهایی' },
    title: { en: 'Completed sale', fa: 'فروش تکمیل‌شده' },
    meta: { en: 'Payments recorded automatically', fa: 'ثبت خودکار پرداخت‌ها' },
    stat: { en: 'recorded sales from 47 payments $12,878', fa: 'فروش ثبت‌شده از ۴۷ پرداخت — ۱٫۲۸ میلیارد' },
  },
  {
    id: 'growth',
    x: 4200,
    y: 20,
    icon: 'growth',
    badge: '$3.4K',
    kicker: { en: 'GROWTH LOOP', fa: 'حلقه رشد' },
    title: { en: 'Reinvested ads & testing budget', fa: 'بودجه تبلیغات و تست بازگشتی' },
    meta: { en: 'System allocation to winning channels', fa: 'تخصیص سیستمی به کانال‌های برنده' },
    stat: { en: 'fed back into the next growth cycle $3,425', fa: 'بازگشت به چرخه رشد بعدی — ۳۴۲ میلیون' },
  },
  {
    id: 'fulfillment',
    x: 3780,
    y: 330,
    icon: 'delivery',
    badge: '47',
    kicker: { en: 'FULFILLMENT', fa: 'تحویل' },
    title: { en: 'Delivery & project kickoff', fa: 'تحویل و شروع پروژه' },
    meta: { en: 'Onboard · Access · Plan', fa: 'آنبورد · دسترسی · برنامه' },
    stat: { en: 'active deliveries 61', fa: 'تحویل فعال ۶۱' },
  },
  {
    id: 'support',
    x: 4200,
    y: 330,
    icon: 'support',
    badge: '61',
    kicker: { en: 'CUSTOMER SUCCESS', fa: 'موفقیت مشتری' },
    title: { en: 'Support & customer health', fa: 'پشتیبانی و سلامت مشتری' },
    meta: { en: 'Replies · Check-ins · Risk', fa: 'پاسخ · پیگیری · ریسک' },
    stat: { en: 'active accounts 84', fa: 'حساب فعال ۸۴' },
  },
  {
    id: 'referral',
    x: 4620,
    y: 330,
    icon: 'referral',
    badge: '29',
    kicker: { en: 'REFERRAL', fa: 'معرفی' },
    title: { en: 'Review, reward & referral', fa: 'نظر، پاداش و معرفی' },
    meta: { en: 'Growth feeds the content factory', fa: 'رشد دوباره به کارخانه محتوا می‌رسد' },
    stat: { en: 'new referred leads 57', fa: 'لید معرفی‌شده ۵۷' },
  },
]

export const edges: StageEdge[] = [
  { id: 'e-11l-factory', source: 'elevenlabs', target: 'factory', label: { en: 'brand voice', fa: 'صدای برند' } },
  { id: 'e-hf-factory', source: 'higgsfield', target: 'factory', label: { en: 'video render', fa: 'ویدیوی خام' } },

  { id: 'e-factory-ig', source: 'factory', target: 'instagram', label: { en: 'reels & stories', fa: 'ریلز و استوری' } },
  { id: 'e-factory-tg', source: 'factory', target: 'telegram', label: { en: 'channel post', fa: 'پست کانال' } },
  { id: 'e-factory-li', source: 'factory', target: 'linkedin', label: { en: 'expert post', fa: 'پست تخصصی' } },
  { id: 'e-factory-yt', source: 'factory', target: 'youtube', label: { en: 'final video', fa: 'ویدیوی نهایی' } },
  { id: 'e-factory-web', source: 'factory', target: 'website', label: { en: 'article & landing', fa: 'مقاله و لندینگ' } },

  { id: 'e-ig-inbox', source: 'instagram', target: 'inbox', label: { en: 'DM & click', fa: 'دایرکت و کلیک' } },
  { id: 'e-tg-inbox', source: 'telegram', target: 'inbox', label: { en: 'message', fa: 'پیام' } },
  { id: 'e-li-inbox', source: 'linkedin', target: 'inbox', label: { en: 'B2B lead', fa: 'لید B2B' } },
  { id: 'e-yt-inbox', source: 'youtube', target: 'inbox', label: { en: 'intent', fa: 'قصد خرید' } },
  { id: 'e-web-inbox', source: 'website', target: 'inbox', label: { en: 'form & chat', fa: 'فرم و چت' } },

  { id: 'e-inbox-router', source: 'inbox', target: 'router', label: { en: '1,842 leads', fa: '۱٬۸۴۲ لید' } },

  { id: 'e-router-hot', source: 'router', target: 'hot', label: { en: 'hot 80+', fa: 'داغ ۸۰+' } },
  { id: 'e-router-warm', source: 'router', target: 'warm', label: { en: 'warm 55–79', fa: 'گرم ۵۵ تا ۷۹' } },
  { id: 'e-router-cold', source: 'router', target: 'cold', label: { en: 'cold <45', fa: 'سرد زیر ۴۵' } },

  { id: 'e-hot-vapi', source: 'hot', target: 'vapi', label: { en: 'voice follow-up', fa: 'پیگیری صوتی' } },
  { id: 'e-vapi-call', source: 'vapi', target: 'salescall', label: { en: 'meeting ready', fa: 'آماده جلسه' } },

  { id: 'e-hot-mem', source: 'hot', target: 'memory', label: { en: 'new signal', fa: 'سیگنال تازه' } },
  { id: 'e-warm-mem', source: 'warm', target: 'memory', label: { en: 'new signal', fa: 'سیگنال تازه' } },
  { id: 'e-cold-mem', source: 'cold', target: 'memory', label: { en: 'reactivated', fa: 'بازفعال‌سازی' } },
  { id: 'e-mem-call', source: 'memory', target: 'salescall', label: { en: 'sales-ready', fa: 'آماده فروش' } },

  { id: 'e-call-pay', source: 'salescall', target: 'payment', label: { en: 'offer accepted', fa: 'پیشنهاد پذیرفته' } },
  { id: 'e-pay-sale', source: 'payment', target: 'sale', variant: 'success', label: { en: 'paid', fa: 'پرداخت‌شده' } },
  { id: 'e-sale-growth', source: 'sale', target: 'growth', variant: 'success', label: { en: 'ad budget', fa: 'بودجه تبلیغات' } },

  { id: 'e-sale-fulfil', source: 'sale', target: 'fulfillment', label: { en: 'won deal', fa: 'فروش موفق' } },
  { id: 'e-fulfil-support', source: 'fulfillment', target: 'support', label: { en: 'handover', fa: 'تحویل' } },
  { id: 'e-support-ref', source: 'support', target: 'referral', label: { en: 'happy client', fa: 'مشتری راضی' } },

  // The claim the reel is built on: the system funds its own next cycle.
  { id: 'e-growth-loop', source: 'growth', target: 'elevenlabs', loopback: true, label: { en: 'budget reinvested', fa: 'بودجه بازگشتی' } },
  { id: 'e-ref-loop', source: 'referral', target: 'factory', loopback: true, label: { en: 'referral fuel', fa: 'سوخت معرفی' } },
]
