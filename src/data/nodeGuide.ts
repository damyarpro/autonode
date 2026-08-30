import type { Bi } from './types'

/**
 * What each box on the board actually does, and where a person goes to drive
 * it. Rule 1: this is the only place a node's explanation lives — the sheet
 * reads it, nothing hard-codes it.
 *
 * `driver` is the honest answer to "does this move on its own?". `auto` means
 * the worker pass moves it with nobody watching; `manual` means it waits for
 * someone. `caveat` is where a node says what it records rather than delivers,
 * so no card claims more than it does (rule 5).
 */
export type NodeGuide = {
  /** Two lines, no more: what this node does. */
  what: Bi
  driver: 'auto' | 'manual'
  /** The page where the work happens. */
  to?: string
  action?: Bi
  /** Its output is only about the right offer once the profile is filled. */
  needsBusiness?: boolean
  caveat?: Bi
}

const STUDIO = { fa: 'استودیو', en: 'Studio' }
const CONTENT = { fa: 'کارخانه‌ی محتوا', en: 'Content factory' }
const CALLS = { fa: 'میز تماس', en: 'Call desk' }
const LEADS = { fa: 'لیدها', en: 'Leads' }
const INBOX = { fa: 'صندوق پیام', en: 'Inbox' }

export const nodeGuide: Record<string, NodeGuide> = {
  elevenlabs: {
    what: {
      fa: 'متن گویندگی را به صدا تبدیل می‌کند.\nبدون کلید ElevenLabs، یک متن زمان‌بندی‌شده و قابل خواندن تحویل می‌دهد.',
      en: 'Turns a script into a voice-over.\nWith no ElevenLabs key it hands back a timed, speakable script instead of audio.',
    },
    driver: 'manual',
    to: '/studio',
    action: STUDIO,
  },
  higgsfield: {
    what: {
      fa: 'از یک خلاصه، ویدیوی تبلیغاتی می‌سازد.\nبدون کلید Higgsfield، استوری‌بورد پلان‌به‌پلان می‌دهد.',
      en: 'Builds an ad video from a brief.\nWith no Higgsfield key it hands back a shot-by-shot storyboard.',
    },
    driver: 'manual',
    to: '/studio',
    action: STUDIO,
  },
  factory: {
    what: {
      fa: 'پست‌ها را می‌نویسد و روی کانال‌ها زمان‌بندی می‌کند.\nهر کلمه را از روی پروفایل بیزینسی تو می‌نویسد.',
      en: 'Writes the posts and schedules them across your channels.\nEvery word is written from your business profile.',
    },
    driver: 'manual',
    to: '/content',
    action: CONTENT,
    needsBusiness: true,
  },

  instagram: {
    what: {
      fa: 'پست‌های سررسیدشده را منتشر می‌کند و دایرکت‌ها را به لید تبدیل می‌کند.\nورودی با وبهوک امضاشده واقعی است.',
      en: 'Publishes the pieces that came due and turns direct messages into leads.\nInbound arrives through a signed webhook.',
    },
    driver: 'auto',
    to: '/content',
    action: CONTENT,
    caveat: {
      fa: 'ارسال به اینستاگرام ثبت می‌شود، نه تحویل — برای تحویل واقعی به اکانت بیزینسی و تأیید پلتفرم نیاز است.',
      en: 'Outbound to Instagram is recorded, not delivered — real delivery needs a business account and platform review.',
    },
  },
  telegram: {
    what: {
      fa: 'تنها کانالی که واقعاً پیام می‌فرستد.\nبا توکن بات، پست‌ها می‌روند و پاسخ‌ها به‌عنوان لید برمی‌گردند.',
      en: 'The one channel that really sends.\nWith a bot token, posts go out and replies come back as leads.',
    },
    driver: 'auto',
    to: '/content',
    action: CONTENT,
  },
  linkedin: {
    what: {
      fa: 'پست تخصصی را منتشر می‌کند و لیدهای B2B را می‌گیرد.\nورودی با وبهوک امضاشده واقعی است.',
      en: 'Publishes the expert post and takes in B2B leads.\nInbound arrives through a signed webhook.',
    },
    driver: 'auto',
    to: '/content',
    action: CONTENT,
    caveat: {
      fa: 'ارسال به لینکدین ثبت می‌شود، نه تحویل.',
      en: 'Outbound to LinkedIn is recorded, not delivered.',
    },
  },
  youtube: {
    what: {
      fa: 'ویدیوی نهایی را منتشر می‌کند و قصد خرید تماشاگر را به لید تبدیل می‌کند.',
      en: 'Publishes the finished video and turns a viewer’s intent into a lead.',
    },
    driver: 'auto',
    to: '/content',
    action: CONTENT,
    caveat: {
      fa: 'ارسال به یوتیوب ثبت می‌شود، نه تحویل.',
      en: 'Outbound to YouTube is recorded, not delivered.',
    },
  },
  website: {
    what: {
      fa: 'مقاله و لندینگ را منتشر می‌کند.\nفرم و چت سایت مستقیم لید می‌سازند.',
      en: 'Publishes the article and the landing page.\nThe site form and chat create leads directly.',
    },
    driver: 'auto',
    to: '/content',
    action: CONTENT,
  },

  inbox: {
    what: {
      fa: 'هر لید اینجا می‌نشیند و از روی رویدادهای خودش امتیاز می‌گیرد.\nامتیاز ذخیره نمی‌شود؛ از لاگ ساخته می‌شود.',
      en: 'Every lead lands here and is scored from its own event log.\nThe score is never stored — it is derived.',
    },
    driver: 'auto',
    to: '/leads',
    action: LEADS,
  },
  router: {
    what: {
      fa: 'بر اساس امتیاز مسیر می‌دهد: داغ ۸۰ به بالا، گرم ۵۵ به بالا، سرد پایین‌تر.',
      en: 'Routes by score: hot from 80, warm from 55, cold below that.',
    },
    driver: 'auto',
  },
  hot: {
    what: {
      fa: 'سکانس سریع: پیام اول در چند دقیقه، بعد دعوت به جلسه.\nپاسخ لید، سکانس را متوقف می‌کند.',
      en: 'The fast sequence: a first message within minutes, then the meeting invite.\nA reply stops it.',
    },
    driver: 'auto',
    to: '/inbox',
    action: INBOX,
  },
  warm: {
    what: {
      fa: 'سکانس آموزشی چندروزه تا امتیاز بالا برود.\nهر پاسخ، مسیر را دوباره محاسبه می‌کند.',
      en: 'A multi-day teaching sequence that lifts the score.\nEvery reply re-routes the lead.',
    },
    driver: 'auto',
    to: '/inbox',
    action: INBOX,
  },
  cold: {
    what: {
      fa: 'سکانس کند و کم‌فشار؛ هدفش زنده نگه‌داشتن رابطه است.',
      en: 'The slow, low-pressure sequence; its job is to keep the relationship alive.',
    },
    driver: 'auto',
    to: '/inbox',
    action: INBOX,
  },

  vapi: {
    what: {
      fa: 'برای هر لید یک بریف تماس می‌نویسد: شروع، دو اعتراض محتمل با پاسخ، و درخواست نهایی.',
      en: 'Writes a call brief for a lead: the opening, two likely objections with answers, and the ask.',
    },
    driver: 'manual',
    to: '/calls',
    action: CALLS,
    caveat: {
      fa: 'بدون کلید Vapi شماره‌گیری انجام نمی‌شود — بریف نوشته می‌شود و خودت تماس می‌گیری.',
      en: 'With no Vapi key nothing is dialled — the brief is written and you make the call yourself.',
    },
  },
  salescall: {
    what: {
      fa: 'زمان‌های آزاد را پیشنهاد می‌دهد، جلسه را رزرو می‌کند و یادآورهایش را می‌چیند.',
      en: 'Offers the free slots, books the meeting and schedules its reminders.',
    },
    driver: 'manual',
    to: '/calls',
    action: CALLS,
  },
  memory: {
    what: {
      fa: 'مرحله‌ی CRM و تمام تایم‌لاین رویدادهای هر لید را نگه می‌دارد.\nهمین لاگ منبع امتیاز است.',
      en: 'Keeps the CRM stage and the whole event timeline for every lead.\nThat log is where the score comes from.',
    },
    driver: 'auto',
    to: '/leads',
    action: LEADS,
  },

  payment: {
    what: {
      fa: 'برای لید یک صفحه‌ی پرداخت می‌سازد و تأیید آن را می‌گیرد.',
      en: 'Creates a checkout page for the lead and takes its confirmation.',
    },
    driver: 'manual',
    to: '/leads',
    action: LEADS,
    caveat: {
      fa: 'پرداخت یک ماکت محلی است — هیچ درگاهی و هیچ پول واقعی در کار نیست.',
      en: 'Checkout is a local mock — no gateway, no real money.',
    },
  },
  sale: {
    what: {
      fa: 'فروش را ثبت می‌کند و لید را به مرحله‌ی پرداخت‌شده می‌برد.',
      en: 'Records the sale and moves the lead to paid.',
    },
    driver: 'auto',
    to: '/leads',
    action: LEADS,
  },
  growth: {
    what: {
      fa: 'سهمی از هر پرداخت را به تبلیغات و تست برمی‌گرداند.\nهمین است که حلقه را می‌بندد.',
      en: 'Puts a share of every payment back into ads and testing.\nThis is what closes the loop.',
    },
    driver: 'auto',
  },
  fulfillment: {
    what: {
      fa: 'چیزی که فروخته شده را تحویل می‌دهد و مرحله را به تحویل‌شده می‌برد.',
      en: 'Delivers what was sold and moves the stage to delivered.',
    },
    driver: 'auto',
    to: '/leads',
    action: LEADS,
  },
  support: {
    what: {
      fa: 'بعد از فروش، مربی هوش مصنوعی به سؤال‌ها جواب می‌دهد.',
      en: 'After the sale, the AI coach answers the questions.',
    },
    driver: 'manual',
    to: '/ai-coach',
    action: { fa: 'مربی', en: 'Coach' },
  },
  referral: {
    what: {
      fa: 'از مشتری تحویل‌گرفته، یک‌بار و فقط یک‌بار، درخواست معرفی می‌کند.\nدرخواست، معرفی نیست: تا معرفی واقعی نیاید عددی ثبت نمی‌شود.',
      en: 'Asks a delivered customer for one introduction, once.\nAsking is not referring: nothing is counted until a real referral arrives.',
    },
    driver: 'auto',
    to: '/calls',
    action: CALLS,
  },
}
