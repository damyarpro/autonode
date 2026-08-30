/**
 * The no-credentials answer for every in-app AI tool. Deterministic, built
 * entirely out of what the user typed, and honest about it: `producedBy` is
 * always 'template'. Nothing here invents a number or a fact about the user's
 * business — it recombines their own words into advice they can act on.
 */
import type { AiToolSpec, ToolRunResult, ToolRunSection } from '../../shared/aiToolSpecs.ts'

export type Locale = 'fa' | 'en'

type Ctx = {
  /** Trimmed value of a field, or '' when the user left it blank. */
  v: (id: string) => string
  /** Picks the caller's locale. */
  t: (fa: string, en: string) => string
  locale: Locale
}

type Draft = { summary: string; sections: Record<string, string[]> }

/** Long free text reads badly inside a sentence, so quote only the opening. */
const clip = (text: string, max = 130): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`
}

// ── idea ─────────────────────────────────────────────────────────────────

function ideaDraft({ v, t }: Ctx): Draft {
  const skills = clip(v('skills'), 90)
  const audience = v('audience') || t('کسانی که همین حالا در دسترس تو هستند', 'the people already within your reach')

  return {
    summary: t(
      `پنج راه برای فروش «${skills}» به ${audience}، مرتب‌شده بر اساس اینکه کدام سریع‌تر به اولین مشتری پولی می‌رسد.`,
      `Five ways to sell "${skills}" to ${audience}, ordered by how fast each one reaches a paying customer.`,
    ),
    sections: {
      ideas: [
        t(
          `بررسی و نقشه‌ی راه — وضعیت فعلی ${audience} را بررسی کن، فهرست اولویت‌دار اصلاحات را تحویل بده و بعد برای همان اصلاحات قیمت بده. آن‌ها بابت یک تصمیم پول می‌دهند و این کار در یک گفتگو فروخته می‌شود.`,
          `Audit and roadmap — review what ${audience} already run, hand back a prioritised list of fixes, then quote the fixes. They pay for a decision, and it sells in a single conversation.`,
        ),
        t(
          `خدمت ماهانه — هر ماه «${skills}» را برای ${audience} اجرا می‌کنی. آن‌ها پول می‌دهند تا این ساعت‌ها را خودشان صرف نکنند.`,
          `Monthly retainer — you run "${skills}" for ${audience} every month. They pay to stop spending those hours themselves.`,
        ),
        t(
          `بسته‌ی محصول‌شده — یک خروجی مشخص از «${skills}»، با یک قیمت ثابت و تحویل یک‌هفته‌ای. آن‌ها بابت قطعیت دامنه و تاریخ پول می‌دهند.`,
          `Productised package — one fixed deliverable out of "${skills}", one price, delivered in a week. They pay for certainty about scope and date.`,
        ),
        t(
          `دستورالعمل و قالب — روش خودت در «${skills}» را طوری بسته‌بندی کن که ${audience} بدون تو اجرایش کنند. آن‌ها پول می‌دهند تا آزمون‌وخطا را رد کنند.`,
          `Playbook and templates — package the way you do "${skills}" so ${audience} can run it without you. They pay to skip the trial and error.`,
        ),
        t(
          `کارگاه پولی — یک بار «${skills}» را به جمعی از ${audience} آموزش بده، ضبطش کن و بعد همان ضبط را بفروش. آن‌ها بابت میان‌بر پول می‌دهند.`,
          `Paid workshop — teach "${skills}" to a room of ${audience} once, record it, and sell the recording afterwards. They pay for the shortcut.`,
        ),
      ],
      pick: [
        t(
          `با «بررسی و نقشه‌ی راه» شروع کن. از همان «${skills}» استفاده می‌کند که همین حالا داری، لازم نیست چیزی از قبل ساخته باشی، و هر بررسی با یک پیشنهاد قیمت برای کاری که پیدا کرده تمام می‌شود — پس هم امروز پول می‌آورد و هم مسیر خدمت ماهانه را باز می‌کند. قبل از ساختن هر چیز دیگری، سه تای آن را بفروش.`,
          `Start with the audit and roadmap. It uses the "${skills}" you already have, needs nothing built in advance, and every audit ends with a quote for the work it uncovered — so it pays now and opens the retainer later. Sell three of them before you build anything else.`,
        ),
      ],
      first_steps: [
        t(
          `یک جمله بنویس که خریدار و نتیجه را نام ببرد: «من به ${audience} کمک می‌کنم با ${skills} به [نتیجه] برسند.»`,
          `Write one sentence that names the buyer and the result: "I help ${audience} get [result] using ${skills}."`,
        ),
        t(
          `بیست نفر یا کسب‌وکار مشخص از ${audience} را فهرست کن که بدون معرفی واسطه می‌توانی به آن‌ها برسی.`,
          `List twenty specific people or businesses in ${audience} you can reach without an introduction.`,
        ),
        t(
          'قیمت بررسی را روی عددی ثابت کن که بتوانی بدون مکث بلند بگویی، و رویش تخفیف نده.',
          'Fix the price of the audit at a number you can say out loud without flinching, and never discount it.',
        ),
        t(
          `به ده نفر اول پیام بده. با مشکلی که می‌دانی دارند شروع کن، نه با فهرست خدماتت.`,
          `Message the first ten. Open with the problem you already know they have, not with your list of services.`,
        ),
        t(
          'اولین بررسی را رایگان انجام بده، در ازای یک گفتگوی ضبط‌شده درباره‌ی اینکه چقدر برایش ارزش داشت.',
          'Run the first audit free in exchange for a recorded conversation about what it was worth to them.',
        ),
        t(
          'از نفر دوم به بعد پول بگیر. سه «بله» پشت سر هم یعنی قیمت پایین است — ببرش بالا.',
          'Charge from the second one on. Three yeses in a row means the price is too low — raise it.',
        ),
      ],
    },
  }
}

// ── product ──────────────────────────────────────────────────────────────

const BUDGET_WEEKEND: Record<string, { fa: string; en: string }> = {
  none: {
    fa: 'آخر هفته — بقیه را فقط از سرویس‌های رایگان سرهم کن. هر مرحله‌ای که بدون پول کار نمی‌کند را این بار دستی انجام بده.',
    en: 'Weekend — assemble the rest from free tiers only. Any step that needs money to work, do it by hand this time.',
  },
  low: {
    fa: 'آخر هفته — دقیقاً روی یک ابزار پولی خرج کن: همانی که بیشترین کار دستی را حذف می‌کند. هیچ چیز دیگری.',
    en: 'Weekend — spend on exactly one paid tool: the one that removes the most manual work. Nothing else.',
  },
  medium: {
    fa: 'آخر هفته — ابزاری را بخر که بیشترین کار دستی را حذف می‌کند و باقی بودجه را برای یک تست تبلیغاتی بعد از تحویل کنار بگذار.',
    en: 'Weekend — buy the tool that removes the most manual work, and set the rest aside for one paid test after delivery.',
  },
}

function productDraft({ v, t, locale }: Ctx): Draft {
  const business = clip(v('business'))
  const budget = v('budget')
  const weekend = BUDGET_WEEKEND[budget]
  const budgetPhrase =
    budget === 'medium'
      ? t('با بودجه‌ی متوسط', 'on a medium budget')
      : budget === 'low'
        ? t('با بودجه‌ی کم', 'on a low budget')
        : t('بدون بودجه', 'with no budget')

  return {
    summary: t(
      `کوچک‌ترین نسخه‌ی پولی «${business}»: یک نتیجه، یک قیمت، تحویل در دو هفته ${budgetPhrase}.`,
      `The smallest paid version of "${business}": one outcome, one price, delivered in two weeks ${budgetPhrase}.`,
    ),
    sections: {
      offer: [
        t(
          `به‌جای زمانت، یک نتیجه بفروش: یک همکاری دو هفته‌ای با دامنه‌ی ثابت حول «${business}». یک قیمت، یک تاریخ تحویل، و یک چیز مشخص که خریدار در پایان بتواند به آن اشاره کند. هر درخواستی که آن نتیجه را جلو نمی‌برد، نسخه‌ی دوم است.`,
          `Sell one outcome instead of your time: a fixed two-week engagement built around "${business}". One price, one delivery date, one thing the buyer can point at when it is done. Any request that does not move that outcome is version two.`,
        ),
      ],
      scope: [
        t(
          'همان یک نتیجه‌ای که خریدار بابتش پول می‌دهد، در یک جمله و نوشته‌شده پیش از شروع کار.',
          'The single outcome the buyer is paying for, written in one sentence before work starts.',
        ),
        t(
          'یک جلسه‌ی سی دقیقه‌ای شروع که در همان یک بار هر چه لازم داری را جمع می‌کند.',
          'One 30-minute kickoff that collects everything you need in a single pass.',
        ),
        t(
          'هفته‌ای یک گزارش کوتاه پیشرفت، در روز و ساعت ثابت، چه خبری باشد چه نباشد.',
          'One short progress note a week, on a fixed day and time, whether or not there is news.',
        ),
        t(
          'تحویل مستند: چه ساختی، چطور اجرا می‌شود، و اولین چیزی که خراب می‌شود کدام است.',
          'A written handover: what you built, how to run it, and what breaks first.',
        ),
        t(
          'هفت روز رفع اشکال بعد از تحویل، فقط برای همان نتیجه‌ی توافق‌شده.',
          'Seven days of fixes after handover, for the agreed outcome only.',
        ),
      ],
      cut: [
        t('بازنگری نامحدود. دو دور، بعد تحویل.', 'Unlimited revisions. Two rounds, then it ships.'),
        t(
          'هر چیزی که به ابزاری نیاز دارد که هنوز نداری یا مجوزی که نخریده‌ای.',
          'Anything that needs a tool you do not already own or a licence you have not bought.',
        ),
        t(
          'مخاطب دوم یا کاربرد دوم — آن فروش بعدی است، نه این یکی.',
          'A second audience or a second use case — that is the next sale, not this one.',
        ),
        t(
          'اتصال به سامانه‌هایی که تا حالا با آن‌ها کار نکرده‌ای.',
          'Custom integrations with systems you have never touched.',
        ),
        t(
          'برندینگ، طراحی دوباره، و هر کار «حالا که دستت آنجاست».',
          'Branding, redesign, and any "while you are in there" work.',
        ),
      ],
      plan: [
        t(
          'روز ۱ — جمله‌ی نتیجه و قیمت را بنویس. هر دو را قبل از ساختن هر چیزی برای یک خریدار محتمل بفرست.',
          'Day 1 — write the outcome sentence and the price. Send both to one likely buyer before you build anything.',
        ),
        t(
          'روز ۲ — تمام مراحل تحویل را دستی روی کاغذ فهرست کن. همان فهرست، دامنه‌ی کار توست.',
          'Day 2 — list every step of delivery by hand, on paper. That list is your scope.',
        ),
        t(
          'روز ۳ تا ۴ — فقط همان بخشی را بساز که خریدار می‌بیند. هنوز هیچ چیزی پشتش نساز.',
          'Days 3-4 — build only the part the buyer sees. Nothing behind it yet.',
        ),
        t(
          'روز ۵ — همان بخش را به خریدار نشان بده. واکنش او تعیین می‌کند هفته‌ی بعد چه ساخته شود.',
          'Day 5 — show that part to the buyer. Their reaction decides what gets built next week.',
        ),
        weekend ? (locale === 'en' ? weekend.en : weekend.fa) : t(
          'آخر هفته — فرض کن پولی در کار نیست. هر چه را رایگان نمی‌توانی انجام دهی، برای اولین خریدار دستی انجام بده.',
          'Weekend — assume there is no money. Whatever you cannot do for free, do by hand for the first buyer.',
        ),
        t(
          'روز ۸ تا ۱۰ — کل تحویل را برای اولین خریدار دستی و سرتاسر انجام بده. هنوز هیچ چیز را خودکار نکن.',
          'Days 8-10 — do the whole delivery manually, end to end, for the first buyer. Automate nothing yet.',
        ),
        t(
          'روز ۱۱ تا ۱۲ — مستند تحویل را از روی کاری که واقعاً کردی بنویس، نه از روی چیزی که برنامه‌ریزی کرده بودی.',
          'Days 11-12 — write the handover from what you actually did, not from what you planned.',
        ),
        t(
          'روز ۱۳ — تحویل بده، فاکتور بفرست و یک سؤال بپرس: چه چیزی این را به دو برابر قیمت می‌ارزاند؟',
          'Day 13 — deliver, invoice, and ask one question: what would have made this worth twice the price?',
        ),
        t(
          'روز ۱۴ — جواب را به نسخه‌ی دوم تبدیل کن. تا سه نفر این قیمت را نپرداخته‌اند، قیمت را تغییر نده.',
          'Day 14 — turn that answer into version two. Do not change the price until three people have paid this one.',
        ),
      ],
    },
  }
}

// ── customer ─────────────────────────────────────────────────────────────

function customerDraft({ v, t }: Ctx): Draft {
  const business = clip(v('business'))
  const audience = v('audience') || t('مخاطبی که توصیفش کردی', 'the audience you described')

  return {
    summary: t(
      `جایی که ${audience} همین حالا جمع‌اند، اولین جمله‌ای که باید بگویی، و یک برنامه‌ی هفت روزه تا ده گفتگوی واقعی درباره‌ی «${business}» بدون یک ریال تبلیغات.`,
      `Where ${audience} already gather, what to open with, and a seven-day plan to ten real conversations about "${business}" without spending on ads.`,
    ),
    sections: {
      where: [
        t(
          `زیر پست‌های حساب‌هایی که ${audience} دنبال می‌کنند. سؤال‌هایی که آنجا پرسیده می‌شود، همان فهرست لید توست.`,
          `The comment sections of the accounts ${audience} already follow — the questions asked there are your lead list.`,
        ),
        t(
          `گروه‌ها و کانال‌هایی که ${audience} در آن‌ها از هم «کسی را می‌شناسید؟» می‌پرسند. دو بار کمک کن، بعد تازه از کارت حرف بزن.`,
          `Groups and channels where ${audience} ask each other for recommendations. Help twice before you ever mention what you sell.`,
        ),
        t(
          `هر کسی که همین حالا به ${audience} چیزی می‌فروشد و رقیب تو نیست. یک معرفی از او از پنجاه پیام سرد بهتر است.`,
          `Anyone already selling to ${audience} without competing with you. One introduction from them beats fifty cold messages.`,
        ),
        t(
          'پیام‌های دوازده ماه گذشته‌ی خودت: کسانی که همین را پرسیدند و هرگز جواب کاملی نگرفتند.',
          'Your own last twelve months of messages: people who asked about exactly this and never got a full answer.',
        ),
        t(
          `جاهایی که ${audience} فیزیکی می‌روند — بازار، رویداد، فضای کار مشترک. ده دقیقه رو در رو از یک هفته پیام دادن جلوتر است.`,
          `Places ${audience} physically go — a market, an event, a co-working desk. Ten minutes face to face outranks a week of DMs.`,
        ),
        t(
          `سایت‌های پروژه و آگهی که ${audience} همین حالا بابت این کار به کسی پول می‌دهند. قیمت آنجا اثبات شده؛ فقط باید بهتر باشی.`,
          `Job boards and marketplaces where ${audience} are already paying someone for this. The price is proven there; you only have to be better.`,
        ),
      ],
      message: [
        t(
          `با مشکل خودشان شروع کن و هیچ چیز نفروش: «[آن چیز مشخصی که نوشته یا انجام داده] را دیدم. من با ${audience} روی [نتیجه‌ی «${business}»] کار می‌کنم — چیزی که معمولاً [مشکلشان] را حل می‌کند این است: [همین‌جا رایگان بگو]. اگر خواستی روشش را می‌فرستم.» چیز مفید را در همان پیام اول بده. درخواست جلسه فقط بعد از جواب دادن آن‌ها.`,
          `Open with their problem and pitch nothing: "Saw [the specific thing they posted or do]. I work with ${audience} on [the result of "${business}"] — one thing that usually fixes [their problem] is [give it away right here]. Happy to send how, no charge." Give the useful thing away in the first message. Ask for the call only after they reply.`,
        ),
      ],
      week: [
        t(
          `روز ۱ — سی نفر مشخص از ${audience} را با نام فهرست کن. بدون نام، فهرست بی‌فایده است.`,
          `Day 1 — list thirty specific people in ${audience} by name. Without names the list is useless.`,
        ),
        t(
          'روز ۲ — پیام اول را یک بار بنویس و پنج بار بازنویسی کن تا زیر چهل کلمه برسد.',
          'Day 2 — write the opening message once, then rewrite it five times until it is under forty words.',
        ),
        t(
          'روز ۳ — به ده نفر اول بفرست. هیچ پیگیری‌ای امروز نه؛ فقط بفرست و ثبت کن.',
          'Day 3 — send to the first ten. No follow-ups today; just send and log them.',
        ),
        t(
          'روز ۴ — زیر ده پست از همان جمع، جواب واقعی و مفید بگذار. هیچ لینکی نگذار.',
          'Day 4 — leave ten genuinely useful replies under posts in that same crowd. No links.',
        ),
        t(
          'روز ۵ — به ده نفر بعدی بفرست و به کسانی که روز ۳ جواب ندادند یک بار پیگیری بزن.',
          'Day 5 — send to the next ten, and follow up once with the day-3 silent ones.',
        ),
        t(
          'روز ۶ — با هر کسی که جواب داده یک تماس بیست دقیقه‌ای بگذار. هدف تماس فروش نیست، فهمیدن جمله‌ی خودشان است.',
          'Day 6 — book a 20-minute call with everyone who replied. The goal is not to sell, it is to hear their exact words.',
        ),
        t(
          `روز ۷ — بشمار: چند پیام، چند جواب، چند تماس. هر پیامی که جواب نگرفت را با جمله‌های خود ${audience} بازنویسی کن و هفته‌ی بعد تکرار.`,
          `Day 7 — count it: messages sent, replies, calls. Rewrite the message that failed using ${audience}'s own words, and repeat next week.`,
        ),
      ],
    },
  }
}

// ── funnel ───────────────────────────────────────────────────────────────

const BUDGET_LEAK: Record<string, { fa: string; en: string }> = {
  none: {
    fa: 'بدون بودجه، نشتی تقریباً همیشه بالای قیف است: تعداد کافی آدم اصلاً قیف را نمی‌بیند. تا وقتی هفته‌ای دست‌کم سی نفر تازه وارد مرحله‌ی اول نشوند، بهینه کردن مراحل بعدی وقت تلف کردن است.',
    en: 'With no budget the leak is almost always at the top: not enough people ever see the funnel. Until at least thirty new people enter stage one each week, optimising the later stages is wasted effort.',
  },
  low: {
    fa: 'با بودجه‌ی کم، نشتی معمولاً بین اولین جواب و پیشنهاد است: آدم‌ها جواب می‌دهند و بعد رها می‌شوند. پیگیری دوم و سوم را زمان‌بندی کن، نه به حافظه بسپار.',
    en: 'On a low budget the leak is usually between the first reply and the offer: people respond, then get dropped. Schedule the second and third follow-up instead of relying on memory.',
  },
  medium: {
    fa: 'با بودجه‌ی متوسط، نشتی به مرحله‌ی پیشنهاد جابه‌جا می‌شود: ترافیک پولی بالای قیف را سریع‌تر از توان پیگیری تو پر می‌کند. قبل از بیشتر کردن خرج، ظرفیت پاسخ‌گویی روزانه‌ات را عدد بزن.',
    en: 'On a medium budget the leak moves to the offer step: paid traffic fills the top faster than you can follow up. Put a number on how many conversations a day you can actually handle before you spend more.',
  },
}

function funnelDraft({ v, t, locale }: Ctx): Draft {
  const business = clip(v('business'))
  const budget = v('budget')
  const leak = BUDGET_LEAK[budget]

  return {
    summary: t(
      `قیف «${business}» مرحله به مرحله: نقطه‌ی ورود، چیزی که آدم را به مرحله‌ی بعد می‌برد، و عددی که در هر مرحله باید ببینی.`,
      `The funnel for "${business}" stage by stage: the entry point, what moves someone to the next stage, and the number to watch at each one.`,
    ),
    sections: {
      stages: [
        t(
          `۱. دیده شدن — یک کانال، نه پنج تا. کاری که «${business}» حل می‌کند را جایی نشان بده که مخاطب همین حالا هست.`,
          `1. Attention — one channel, not five. Show the problem "${business}" solves where the audience already is.`,
        ),
        t(
          '۲. جذب — یک چیز مشخص و رایگان در ازای یک راه تماس. کاتالوگ نه؛ چیزی که همان امشب یک مشکل را حل کند.',
          '2. Capture — one specific free thing in exchange for one way to reach them. Not a brochure: something that solves one problem tonight.',
        ),
        t(
          '۳. گفتگو — اولین پیام در کمتر از یک ساعت. هدفش فروش نیست، فهمیدن اینکه چه چیزی الان برایشان نمی‌چرخد.',
          '3. Conversation — first reply inside an hour. Its job is not to sell, it is to learn what is broken for them right now.',
        ),
        t(
          '۴. صلاحیت — سه سؤال: مشکل واقعی چیست، چه زمانی باید حل شود، چه کسی تصمیم می‌گیرد. جواب مبهم یعنی هنوز آماده نیست.',
          '4. Qualify — three questions: what is the real problem, when must it be solved, who decides. A vague answer means not yet.',
        ),
        t(
          '۵. پیشنهاد — یک نتیجه، یک قیمت، یک تاریخ. پیشنهاد نوشته می‌شود، شفاهی نمی‌ماند.',
          '5. Offer — one outcome, one price, one date. The offer is written down, never left verbal.',
        ),
        t(
          '۶. بستن و پرداخت — یک لینک یا یک روش پرداخت مشخص، با یک پیگیری زمان‌بندی‌شده اگر باز شد و پرداخت نشد.',
          '6. Close and payment — one link or one clear way to pay, with one scheduled follow-up if it is opened and not paid.',
        ),
        t(
          '۷. تحویل و تکرار — بعد از تحویل، دو چیز بخواه: یک جمله‌ی رضایت و یک معرفی. همین‌جا قیف به خودش وصل می‌شود.',
          '7. Deliver and repeat — after delivery ask for exactly two things: one sentence of feedback and one introduction. This is where the funnel loops back into itself.',
        ),
      ],
      metrics: [
        t('تعداد آدم‌های تازه‌ای که هفته‌ای وارد مرحله‌ی ۱ می‌شوند.', 'New people entering stage 1 each week.'),
        t('نرخ تبدیل دیده شدن به جذب — چند درصد آن‌ها راه تماس می‌دهند.', 'Attention to capture rate — what share leave a way to reach them.'),
        t('زمان تا اولین جواب تو، بر حسب دقیقه نه روز.', 'Time to your first reply, measured in minutes not days.'),
        t('نرخ گفتگو به پیشنهاد — چند گفتگو به پیشنهاد نوشته‌شده رسید.', 'Conversation to offer rate — how many talks produced a written offer.'),
        t('نرخ پیشنهاد به پرداخت، و متوسط روزهای بین این دو.', 'Offer to payment rate, and the average days between the two.'),
        t('تعداد معرفی‌ها به ازای هر تحویل انجام‌شده.', 'Introductions received per completed delivery.'),
      ],
      leak: [
        leak
          ? locale === 'en'
            ? leak.en
            : leak.fa
          : t(
              'محتمل‌ترین نشتی، فاصله‌ی بین اولین جواب و پیشنهاد نوشته‌شده است: گفتگو گرم می‌شود و بعد فراموش می‌شود. تا وقتی پیگیری زمان‌بندی‌شده نداری، هر کاری بالای قیف بکنی از همین‌جا بیرون می‌ریزد.',
              'The most likely leak is the gap between the first reply and a written offer: conversations warm up and then get forgotten. Until follow-up is scheduled rather than remembered, everything you add at the top drains out here.',
            ),
      ],
    },
  }
}

// ── mindmap ──────────────────────────────────────────────────────────────

function mindmapDraft({ v, t }: Ctx): Draft {
  const business = clip(v('business'))

  return {
    summary: t(
      `«${business}» شکسته‌شده به هفت شاخه، با ترتیبی که باید ساخته شوند و ریسکی که کل نقشه را زمین می‌زند.`,
      `"${business}" broken into seven branches, with the order to build them and the one risk that takes the whole map down.`,
    ),
    sections: {
      branches: [
        t(
          `پیشنهاد — دقیقاً چه چیزی در «${business}» فروخته می‌شود، به چه قیمتی، و خریدار در پایان به چه چیز اشاره می‌کند.`,
          `Offer — exactly what is sold in "${business}", at what price, and what the buyer points at when it is done.`,
        ),
        t(
          'مخاطب — چه کسی پول می‌دهد، همین حالا کجاست، و با چه جمله‌ای مشکلش را توصیف می‌کند.',
          'Audience — who pays, where they already are, and the words they use to describe the problem.',
        ),
        t(
          'اثبات — نمونه‌کار، جمله‌ی مشتری قبلی، عدد قبل و بعد. بدون این شاخه، بقیه فقط ادعاست.',
          'Proof — samples, a past customer sentence, a before-and-after number. Without this branch the rest is just a claim.',
        ),
        t(
          'محتوا — چیزی که مشکل را نشان می‌دهد، چیزی که راه‌حل را اثبات می‌کند، چیزی که پیشنهاد را می‌دهد.',
          'Content — the piece that shows the problem, the piece that proves the solution, the piece that makes the offer.',
        ),
        t(
          'فروش — از اولین پیام تا پرداخت: چه کسی جواب می‌دهد، در چه زمانی، و پیگیری کجا نوشته می‌شود.',
          'Sales — first message to payment: who replies, how fast, and where the follow-up is written down.',
        ),
        t(
          'تحویل — مراحل ثابتی که هر بار تکرار می‌شود، و مستندی که در پایان تحویل می‌دهی.',
          'Delivery — the fixed steps that repeat every time, and the handover you give at the end.',
        ),
        t(
          'پول و اتوماسیون — قیمت، هزینه‌ی هر تحویل، و اولین کاری که باید از دست تو خارج شود.',
          'Money and automation — the price, the cost of each delivery, and the first task that must leave your hands.',
        ),
      ],
      next: [
        t('۱. پیشنهاد را ببند. تا یک جمله و یک قیمت نداری، هیچ شاخه‌ی دیگری قابل ساخت نیست.', '1. Close the offer. Until you have one sentence and one price, no other branch can be built.'),
        t('۲. مخاطب را با نام فهرست کن. سی نفر مشخص، نه یک توصیف کلی.', '2. List the audience by name. Thirty specific people, not a description.'),
        t('۳. اولین تحویل را دستی انجام بده و همان را به اثبات تبدیل کن.', '3. Do the first delivery by hand and turn it into your proof.'),
        t('۴. فروش را بنویس: پیام اول، سه سؤال صلاحیت، و متن پیشنهاد.', '4. Write the sales path: the opening message, three qualifying questions, the offer text.'),
        t('۵. محتوا را بعد از اولین فروش شروع کن، از روی سؤال‌های واقعی همان خریدار.', '5. Start content after the first sale, built from that buyer’s real questions.'),
        t('۶. تحویل را به یک چک‌لیست ثابت تبدیل کن تا دوباره‌پذیر شود.', '6. Turn delivery into a fixed checklist so it repeats without you thinking.'),
        t('۷. حالا اتوماسیون: اولین کاری که هفته‌ای بیش از یک ساعت می‌گیرد و هر بار یک‌شکل است.', '7. Only now automate: the first task that eats over an hour a week and runs identically every time.'),
      ],
      risk: [
        t(
          `بزرگ‌ترین ریسک این است که شاخه‌های ۳ تا ۷ را قبل از بستن پیشنهاد بسازی. اگر «${business}» هنوز یک جمله و یک قیمت نیست، محتوا و اتوماسیون فقط کاری هستند که حس پیشرفت می‌دهند بدون اینکه کسی پول بدهد. اول یک نفر را وادار به پرداخت کن، بعد نقشه را باز کن.`,
          `The biggest risk is building branches 3 to 7 before the offer is closed. If "${business}" is not yet one sentence and one price, content and automation are just work that feels like progress while nobody pays. Get one person to pay first, then open the map.`,
        ),
      ],
    },
  }
}

// ── content ──────────────────────────────────────────────────────────────

type Formats = { fa: [string, string, string]; en: [string, string, string] }

const CHANNEL_FORMATS: Record<string, Formats> = {
  instagram: { fa: ['ریلز', 'کاروسل', 'استوری'], en: ['reel', 'carousel', 'story'] },
  telegram: { fa: ['پست', 'نظرسنجی', 'ویس کوتاه'], en: ['post', 'poll', 'short voice note'] },
  linkedin: { fa: ['پست متنی', 'کاروسل سند', 'کامنت روی پست دیگران'], en: ['text post', 'document carousel', 'comment on someone else’s post'] },
  youtube: { fa: ['شورت', 'ویدیوی بلند', 'پست کامیونیتی'], en: ['short', 'long video', 'community post'] },
}

const DEFAULT_FORMATS: Formats = {
  fa: ['پست', 'رشته‌پست', 'ویدیوی کوتاه'],
  en: ['post', 'thread', 'short video'],
}

function contentDraft({ v, t, locale }: Ctx): Draft {
  const business = clip(v('business'))
  const channel = v('channel')
  const formats = CHANNEL_FORMATS[channel] ?? DEFAULT_FORMATS
  const [long, mid, quick] = locale === 'en' ? formats.en : formats.fa
  const where = channel
    ? channel[0].toUpperCase() + channel.slice(1)
    : t('کانال اصلی‌ات', 'your primary channel')

  return {
    summary: t(
      `تقویم دو هفته‌ای برای «${business}» روی ${where}: هر قطعه یا مشکل را نشان می‌دهد، یا راه‌حل را اثبات می‌کند، یا پیشنهاد می‌دهد — هیچ‌کدام سه‌تایی نیست.`,
      `A two-week calendar for "${business}" on ${where}: every piece either shows the problem, proves the solution, or makes the offer — never all three at once.`,
    ),
    sections: {
      angles: [
        t(
          `نشان دادن مشکل — گران‌ترین اشتباهی که مخاطب «${business}» تکرار می‌کند و خودش نمی‌بیند.`,
          `Show the problem — the most expensive mistake the audience of "${business}" repeats without noticing.`,
        ),
        t(
          'نشان دادن مشکل — قبل و بعد، بدون اسم بردن از کسی: وضعیت روز اول در برابر وضعیت امروز.',
          'Show the problem — a before and after with no names: day one versus today.',
        ),
        t(
          'اثبات راه‌حل — از پشت صحنه نشان بده کار چطور انجام می‌شود، حتی اگر ساده به‌نظر برسد.',
          'Prove the solution — show the work from behind the scenes, even if it looks simple.',
        ),
        t(
          'اثبات راه‌حل — یک سؤال واقعی مشتری را کامل جواب بده و هیچ چیز را برای بعد نگه ندار.',
          'Prove the solution — answer one real customer question in full and hold nothing back for later.',
        ),
        t(
          'پیشنهاد — دقیقاً بگو برای چه کسی است، چه چیزی شامل می‌شود، و برای چه کسی نیست.',
          'Make the offer — say exactly who it is for, what is included, and who it is not for.',
        ),
        t(
          'پیشنهاد — یک نمونه‌ی کامل از یک تحویل واقعی، با قیمت نوشته‌شده.',
          'Make the offer — one full walk-through of a real delivery, with the price written down.',
        ),
      ],
      calendar: [
        t(`هفته ۱، دوشنبه — ${long}: «گران‌ترین اشتباهی که در [حوزه‌ی «${business}»] می‌بینم».`, `Week 1, Monday — ${long}: "The most expensive mistake I see in [the field of "${business}"]."`),
        t(`هفته ۱، سه‌شنبه — ${quick}: «سه دقیقه‌ای که بیشترین وقت را در هفته برایت آزاد می‌کند».`, `Week 1, Tuesday — ${quick}: "The three minutes that free up the most time in your week."`),
        t(`هفته ۱، پنجشنبه — ${mid}: پشت صحنه‌ی یک تحویل واقعی، مرحله به مرحله.`, `Week 1, Thursday — ${mid}: behind the scenes of one real delivery, step by step.`),
        t(`هفته ۱، جمعه — ${quick}: یک سؤالی که همه می‌پرسند و جواب کاملش.`, `Week 1, Friday — ${quick}: the one question everyone asks, answered in full.`),
        t(`هفته ۱، شنبه — ${long}: قبل و بعد، بدون اسم بردن از کسی.`, `Week 1, Saturday — ${long}: a before and after, no names.`),
        t(`هفته ۲، دوشنبه — ${mid}: «اگر امروز از صفر شروع می‌کردم، این پنج قدم را می‌رفتم».`, `Week 2, Monday — ${mid}: "If I started from zero today, these are the five steps I would take."`),
        t(`هفته ۲، سه‌شنبه — ${quick}: یک اشتباه خودت و چیزی که برایت هزینه داشت.`, `Week 2, Tuesday — ${quick}: one mistake of your own and what it cost you.`),
        t(`هفته ۲، چهارشنبه — ${long}: جواب کامل به سؤالی که در کامنت‌های هفته‌ی اول پرسیده شد.`, `Week 2, Wednesday — ${long}: a full answer to the question asked in week one’s comments.`),
        t(`هفته ۲، پنجشنبه — ${mid}: دقیقاً چه چیزی می‌فروشی، برای چه کسی است و برای چه کسی نیست.`, `Week 2, Thursday — ${mid}: exactly what you sell, who it is for, and who it is not for.`),
        t(`هفته ۲، جمعه — ${quick}: دعوت مستقیم به گفتگو، با همان جمله‌ی پایین.`, `Week 2, Friday — ${quick}: a direct invitation to talk, using the call to action below.`),
      ],
      cta: [
        t(
          `یک دعوت، همیشه همان یکی، در پایان هر قطعه: «اگر [مشکل] برایت آشناست، کلمه‌ی [یک کلمه‌ی مشخص] را برایم بفرست تا بگویم در «${business}» چطور حلش می‌کنیم.» یک کلمه، یک مقصد، در همه‌ی قطعه‌ها یکسان — تا بتوانی بشماری کدام محتوا واقعاً گفتگو ساخت.`,
          `One call to action, always the same one, at the end of every piece: "If [the problem] sounds familiar, send me the word [one specific word] and I will show you how "${business}" handles it." One word, one destination, identical everywhere — so you can count which piece actually produced conversations.`,
        ),
      ],
    },
  }
}

// ── social ───────────────────────────────────────────────────────────────

function socialDraft({ v, t }: Ctx): Draft {
  const business = clip(v('business'))
  const audience = v('audience') || t('مخاطبی که دنبالش هستی', 'the audience you are after')

  return {
    summary: t(
      `تبدیل پیج به مسیر جذب برای «${business}»: بایو و محتوای ثابت چه کاری باید بکنند، چه چیزی تو را پیدا می‌کند، و چه چیزی فالوور را به گفتگو می‌رساند.`,
      `Turning the page into an acquisition path for "${business}": what the bio and pinned content must do, what makes you findable, and what turns a follower into a conversation.`,
    ),
    sections: {
      profile: [
        t(
          `بایو باید در یک خط بگوید برای چه کسی و چه نتیجه‌ای: «برای ${audience} — [نتیجه‌ی «${business}»]». عنوان شغلی ننویس.`,
          `The bio says in one line who it is for and what result: "For ${audience} — [the result of "${business}"]." Not a job title.`,
        ),
        t(
          'نام کاربری و نام نمایشی شامل کلمه‌ای باشد که مخاطب واقعاً جستجو می‌کند، نه اسم برند تنها.',
          'The handle and display name carry the word your audience actually searches for, not just a brand name.',
        ),
        t(
          'یک لینک، یک مقصد. اگر سه لینک داری، هیچ‌کدام کلیک نمی‌خورد.',
          'One link, one destination. Three links means none of them gets clicked.',
        ),
        t(
          'سه محتوای ثابت بالای پیج: مشکل، اثبات، پیشنهاد. هر بازدیدکننده‌ی تازه باید در سی ثانیه هر سه را ببیند.',
          'Three pinned pieces at the top: problem, proof, offer. Any new visitor should see all three in thirty seconds.',
        ),
        t(
          'عکس پروفایل: صورت، نه لوگو، اگر فروش از طرف خودت انجام می‌شود.',
          'Profile picture: a face, not a logo, if the selling is done by you.',
        ),
        t(
          `هایلایت یا بخش ثابتی که نشان می‌دهد کار برای ${audience} چطور پیش می‌رود، مرحله به مرحله.`,
          `A highlight or pinned section showing what working with you looks like for ${audience}, step by step.`,
        ),
      ],
      growth: [
        t('۱. یک هفته فقط منتشر کن و هیچ چیز نفروش. اثبات اینکه چیزی برای گفتن داری، پیش‌شرط بقیه است.', '1. Publish for one week and sell nothing. Proving you have something to say comes before everything else.'),
        t(`۲. روزی ده کامنت واقعی زیر پست‌هایی بگذار که ${audience} می‌خوانند. کامنت مفید از پست متوسط بیشتر دیده می‌شود.`, `2. Leave ten real comments a day under posts ${audience} read. A useful comment gets more reach than an average post.`),
        t('۳. هفته‌ای یک محتوا برای جستجو بساز: عنوان دقیقاً همان جمله‌ای که مخاطب تایپ می‌کند.', '3. Make one searchable piece a week: the title is exactly the phrase your audience types.'),
        t('۴. ماهی یک همکاری با کسی که همان مخاطب را دارد و رقیبت نیست. هر دو معرفی می‌کنید.', '4. One collaboration a month with someone who shares your audience and does not compete. You each introduce the other.'),
        t('۵. هر قطعه‌ای که بالای میانگین دیده شد را بعد از سه هفته با زاویه‌ی تازه دوباره منتشر کن.', '5. Anything that beat your average gets republished three weeks later from a new angle.'),
        t('۶. هفته‌ای یک بار جواب یک سؤال واقعی از دایرکت را عمومی منتشر کن.', '6. Once a week, publish the answer to one real DM question in public.'),
        t('۷. هفته‌ای یک عدد را نگاه کن: چند گفتگوی تازه شروع شد. لایک را نشمار.', '7. Watch one number a week: how many new conversations started. Do not count likes.'),
      ],
      convert: [
        t(
          `فالوور با پیشنهاد به گفتگو تبدیل نمی‌شود، با سؤال تبدیل می‌شود. زیر هر محتوا یک سؤال بپرس که جوابش کوتاه باشد، و به هر جوابی در همان روز پاسخ بده — با یک سؤال دیگر، نه با معرفی «${business}». وقتی طرف مشکلش را با کلمات خودش نوشت، همان کلمات را برگردان و بعد بگو چطور حلش می‌کنی. سه پیام تا پیشنهاد، نه یکی.`,
          `A follower turns into a conversation through a question, not an offer. End each piece with a question that has a short answer, reply to every answer the same day — with another question, not with a description of "${business}". Once they have written their problem in their own words, repeat those words back and only then say how you fix it. Three messages to the offer, not one.`,
        ),
      ],
    },
  }
}

// ── assembly ─────────────────────────────────────────────────────────────

const BUILDERS: Record<string, (ctx: Ctx) => Draft> = {
  idea: ideaDraft,
  product: productDraft,
  customer: customerDraft,
  funnel: funnelDraft,
  mindmap: mindmapDraft,
  content: contentDraft,
  social: socialDraft,
}

/**
 * Last-resort shape for a spec with no hand-written builder. It still answers
 * from the user's own words rather than pretending to know something.
 */
function genericDraft(spec: AiToolSpec, ctx: Ctx): Draft {
  const { t, locale } = ctx
  const filled = spec.fields
    .map((field) => ({ label: field.label[locale], value: ctx.v(field.id) }))
    .filter((entry) => entry.value !== '')
  const entries = filled.map((entry) => `${entry.label}: ${clip(entry.value)}`)
  const fallbackEntry = t('چیزی وارد نشده است.', 'Nothing was entered.')
  const lines = entries.length > 0 ? entries : [fallbackEntry]

  const sections: Record<string, string[]> = {}
  for (const section of spec.sections) {
    sections[section.id] =
      section.kind === 'text'
        ? [
            t(
              `${section.label.fa} بر پایه‌ی آنچه نوشتی: ${lines.join(' · ')}`,
              `${section.label.en}, based on what you wrote: ${lines.join(' · ')}`,
            ),
          ]
        : lines.map((line) =>
            t(`${section.label.fa} — ${line}`, `${section.label.en} — ${line}`),
          )
  }
  return {
    summary: t(
      `${spec.title.fa}: پاسخ زیر مستقیماً از ورودی خودت ساخته شده است.`,
      `${spec.title.en}: the answer below is built directly from your own input.`,
    ),
    sections,
  }
}

/** A `text` section renders one block, so several lines collapse into one. */
const shape = (kind: string, items: string[]): string[] => {
  const clean = items.map((item) => item.trim()).filter((item) => item.length > 0)
  return kind === 'text' ? [clean.join(' ')] : clean
}

/**
 * The deterministic answer. Every section the spec declares is present, and the
 * result is honest about where it came from.
 */
export function templateRun(
  spec: AiToolSpec,
  inputs: Record<string, string>,
  locale: Locale = 'fa',
): ToolRunResult {
  const ctx: Ctx = {
    locale,
    v: (id) => (inputs[id] ?? '').trim(),
    t: (fa, en) => (locale === 'en' ? en : fa),
  }

  const build = BUILDERS[spec.id]
  const draft = build ? build(ctx) : genericDraft(spec, ctx)
  const fallback = genericDraft(spec, ctx)

  const sections: ToolRunSection[] = spec.sections.map((section) => {
    const items = shape(section.kind, draft.sections[section.id] ?? [])
    const usable = items.length > 0 && items.every((item) => item.length > 0)
    return {
      id: section.id,
      kind: section.kind,
      items: usable ? items : shape(section.kind, fallback.sections[section.id] ?? []),
    }
  })

  return {
    toolId: spec.id,
    summary: draft.summary.trim() || fallback.summary,
    sections,
    producedBy: 'template',
  }
}
