import type { TemplateKey } from '../../domain/sequences.ts'
import type { AiAdapter, DraftInput, NextBestAction } from '../types.ts'

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

  async nextBestAction({ lead }): Promise<NextBestAction> {
    if (lead.stage === 'checkout') {
      return { action: 'send_checkout', reason: 'Checkout already started', confidence: 0.9 }
    }
    if (lead.score >= 80) return { action: 'book_call', reason: 'Score is in the hot band', confidence: 0.8 }
    if (lead.score >= 55) return { action: 'send_followup', reason: 'Warm and still engaging', confidence: 0.7 }
    return { action: 'wait', reason: 'Not enough intent yet', confidence: 0.6 }
  },
}
