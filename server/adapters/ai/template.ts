import type { TemplateKey } from '../../domain/sequences.ts'
import type { AiAdapter, CoachInput, DraftInput, NextBestAction } from '../types.ts'

type Copy = { fa: string; en: string }

/** `{name}` is filled from the lead; everything else is fixed text. */
const TEMPLATES: Record<TemplateKey, Copy> = {
  hot_intro: {
    fa: 'سلام {name} 👋 پیام شما رسید. برای اینکه دقیق راهنمایی کنم: الان بیشتر روی جذب لید کار می‌کنید یا روی بستن فروش؟',
    en: 'Hi {name} 👋 got your message. So I can point you the right way — are you working on getting leads right now, or on closing them?',
  },
  hot_value: {
    fa: '{name} جان، یک نمونه‌ی کوتاه از همین مسیر برایتان می‌فرستم: از اولین پیام تا رزرو جلسه، همه‌اش خودکار. می‌خواهید ببینید روی کسب‌وکار خودتان چطور درمی‌آید؟',
    en: '{name}, here is a short walk-through of the same pipeline: first message to booked call, all automated. Want to see how it maps onto your business?',
  },
  hot_offer: {
    fa: 'اگر بخواهید، یک جلسه‌ی ۲۰ دقیقه‌ای بگذاریم و مسیر را روی کسب‌وکار خودتان بچینیم. چه زمانی برایتان مناسب است؟',
    en: 'If you like, let us book 20 minutes and lay this out for your business. What time works for you?',
  },
  warm_educate: {
    fa: 'سلام {name}. سه اشتباه رایج در پیگیری لید که بیشترین فروش را می‌سوزاند را برایتان نوشتم — کوتاه است و به‌دردتان می‌خورد.',
    en: 'Hi {name}. I wrote up the three follow-up mistakes that burn the most revenue — short read, worth it.',
  },
  warm_prove: {
    fa: '{name} جان، یک نمونه‌ی واقعی: همین ساختار، نرخ پاسخ اولیه را از ۹٪ به ۳۴٪ رساند. جزئیاتش را بفرستم؟',
    en: '{name}, a real example: this same structure took first-reply rate from 9% to 34%. Want the details?',
  },
  warm_offer: {
    fa: 'اگر آماده‌اید، می‌توانیم همین مسیر را برای شما راه بیندازیم. یک جلسه‌ی کوتاه بگذاریم؟',
    en: 'If you are ready, we can set this up for you. Shall we book a short call?',
  },
  cold_watch: {
    fa: 'سلام {name}. یک ویدیوی کوتاه گذاشتم که کل این مسیر خودکار را نشان می‌دهد — بدون اینکه چیزی بفروشم.',
    en: 'Hi {name}. I posted a short video that walks through this whole automated pipeline — no pitch in it.',
  },
  cold_read: {
    fa: 'اگر آن ویدیو برایتان جالب بود، این مطالعه‌ی موردی ادامه‌اش است: عدد به عدد، از محتوا تا پرداخت.',
    en: 'If that video landed, this case study is the follow-up: number by number, from content to payment.',
  },
  cold_return: {
    fa: 'اگر هنوز برایتان موضوع باز است، هر وقت خواستید همین‌جا بنویسید. وگرنه دیگر مزاحم نمی‌شوم.',
    en: 'If this is still on your list, just write back here whenever. Otherwise I will leave you be.',
  },
}

/**
 * Keyword-matched coaching answers. Deliberately plain — this is the offline
 * fallback, and it says something useful rather than pretending to be a model.
 */
const COACH_RULES: { match: RegExp; fa: string; en: string }[] = [
  {
    match: /ایده|idea/i,
    fa: 'برای انتخاب ایده از سه فیلتر رد شو: چیزی که بلدی، چیزی که کسی حاضر است بابتش پول بدهد، و چیزی که می‌توانی در دو هفته نسخه‌ی اولش را بسازی. هر ایده‌ای که هر سه را رد کند، حذف. از بین باقی‌مانده‌ها آن را بردار که سریع‌ترین بازخورد را می‌دهد.',
    en: 'Run every idea through three filters: something you can do, something someone will pay for, and something you can ship a first version of in two weeks. Drop whatever fails any of them, then take the one that gives you feedback fastest.',
  },
  {
    match: /قیمت|pricing|price|چند بفروشم/i,
    fa: 'قیمت را از هزینه‌ات حساب نکن، از نتیجه‌ای که برای مشتری می‌سازی. اولین قیمت را طوری بگذار که سه «بله» پشت سر هم بگیری؛ اگر گرفتی یعنی ارزان است و باید بالا ببری.',
    en: 'Price from the outcome you create, not your costs. Set the first price so you get three yeses in a row — if you do, it is too cheap and should go up.',
  },
  {
    match: /مشتری|customer|lead|لید/i,
    fa: 'قبل از تبلیغات، ده مکالمه‌ی مستقیم بگیر. جایی که مخاطبت الان هست برو، کمک واقعی بکن و بعد پیشنهاد بده. ده مشتری اول با دست به دست می‌آید، نه با بودجه.',
    en: 'Before any ads, get ten direct conversations. Go where your audience already is, help for real, then offer. The first ten customers come by hand, not by budget.',
  },
  {
    match: /محتوا|content|پیج|instagram|اینستا/i,
    fa: 'هر محتوا باید یکی از این سه کار را بکند: مشکل را نشان بدهد، اثبات کند که راه‌حل کار می‌کند، یا پیشنهاد بدهد. اگر هیچ‌کدام نیست، منتشرش نکن.',
    en: 'Every piece of content should do one of three things: show the problem, prove the solution works, or make the offer. If it does none, do not publish it.',
  },
  {
    match: /اتوماسیون|خودکار|automat/i,
    fa: 'اول کاری را خودکار کن که هفته‌ای بیش از یک ساعت از تو می‌گیرد و هر بار دقیقاً یک‌شکل انجام می‌شود. پیگیری لید و ارسال پیام اول معمولاً اولین گزینه‌اند.',
    en: 'Automate the task that eats more than an hour a week and runs identically every time. Lead follow-up and the first outbound message are usually first.',
  },
  {
    match: /.*/,
    fa: 'سؤالت را یک پله مشخص‌تر بپرس تا جواب کاربردی‌تری بدهم: روی کدام سطح گیر کرده‌ای و دقیقاً چه چیزی جلو نمی‌رود؟',
    en: 'Ask one level more specifically and I can be more useful: which level are you stuck on, and what exactly is not moving?',
  },
]

/** Persian digits, so the coach's numbers match the rest of its sentence. */
const fa = (value: number) => String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])

const fill = (copy: string, name: string | null) => copy.replace(/\{name\}/g, name?.trim() || 'دوست من')

/**
 * The no-credentials default. Deterministic copy, so the funnel runs and the
 * tests stay stable without any model call.
 */
export const templateAi: AiAdapter = {
  name: 'template',
  live: false,

  async draft({ lead, template }: DraftInput) {
    const copy = TEMPLATES[template]
    return fill(lead.locale === 'en' ? copy.en : copy.fa, lead.name)
  },

  async coach({ messages, locale, context }: CoachInput) {
    const last = messages.filter((turn) => turn.role === 'user').at(-1)?.content ?? ''
    const advice = COACH_RULES.find((rule) => rule.match.test(last)) ?? COACH_RULES.at(-1)!
    const copy = locale === 'en' ? advice.en : advice.fa
    const where =
      locale === 'en'
        ? `You are on level ${context.levelId} of 7 (${context.percent}% overall).`
        : `شما روی سطح ${fa(context.levelId)} از ۷ هستید (${fa(context.percent)}٪ کل مسیر).`
    return `${copy}\n\n${where}`
  },

  async nextBestAction({ lead }): Promise<NextBestAction> {
    if (lead.stage === 'checkout') {
      return { action: 'send_checkout', reason: 'Checkout already started', confidence: 0.9 }
    }
    if (lead.score >= 80) return { action: 'book_call', reason: 'Score is in the hot band', confidence: 0.8 }
    if (lead.score >= 55) return { action: 'send_followup', reason: 'Warm and still engaging', confidence: 0.7 }
    return { action: 'wait', reason: 'Not enough intent yet', confidence: 0.6 }
  },
}
