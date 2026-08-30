/**
 * The contract for the in-app AI tools, shared by the server that runs them and
 * the page that renders them. Both sides import this file; neither redefines it.
 */

export type Bi = { fa: string; en: string }

export type ToolField = {
  id: string
  label: Bi
  placeholder?: Bi
  type: 'text' | 'textarea' | 'select'
  required?: boolean
  maxLength?: number
  options?: { value: string; label: Bi }[]
}

/** How one block of a tool's answer is rendered. */
export type SectionKind = 'text' | 'list' | 'steps'

export type ToolSection = { id: string; label: Bi; kind: SectionKind }

export type AiToolSpec = {
  /** Matches an entry in src/data/tools.ts `aiTools`. */
  id: string
  title: Bi
  subtitle: Bi
  icon: string
  gradient: [string, string]
  fields: ToolField[]
  sections: ToolSection[]
  /** Describes to the model what this tool must produce. */
  brief: string
}

/** One block of a completed run. `items` holds a single entry for `text`. */
export type ToolRunSection = { id: string; kind: SectionKind; items: string[] }

export type ToolRunResult = {
  toolId: string
  summary: string
  sections: ToolRunSection[]
  /** 'claude' when a model produced it, 'template' when the fallback did. */
  producedBy: 'claude' | 'template'
}

export type ToolRun = {
  id: number
  toolId: string
  inputs: Record<string, string>
  result: ToolRunResult
  at: string
}

const businessField: ToolField = {
  id: 'business',
  type: 'textarea',
  required: true,
  maxLength: 600,
  label: { fa: 'کسب‌وکار یا ایده‌ات را در چند خط بنویس', en: 'Describe your business or idea in a few lines' },
  placeholder: {
    fa: 'مثلاً: به کسب‌وکارهای کوچک کمک می‌کنم پیج اینستاگرامشان را رشد بدهند.',
    en: 'For example: I help small businesses grow their Instagram page.',
  },
}

const audienceField: ToolField = {
  id: 'audience',
  type: 'text',
  maxLength: 160,
  label: { fa: 'مخاطب هدف', en: 'Target audience' },
  placeholder: { fa: 'مثلاً: صاحبان فروشگاه‌های کوچک', en: 'For example: small shop owners' },
}

const budgetField: ToolField = {
  id: 'budget',
  type: 'select',
  label: { fa: 'بودجه', en: 'Budget' },
  options: [
    { value: 'none', label: { fa: 'بدون بودجه', en: 'No budget' } },
    { value: 'low', label: { fa: 'کم', en: 'Low' } },
    { value: 'medium', label: { fa: 'متوسط', en: 'Medium' } },
  ],
}

export const aiToolSpecs: AiToolSpec[] = [
  {
    id: 'idea',
    icon: 'Lightbulb',
    gradient: ['#22d3ee', '#3b82f6'],
    title: { fa: 'ایده یابی', en: 'Idea finder' },
    subtitle: { fa: 'پیدا کردن ایده‌ی قابل فروش', en: 'Find an idea worth selling' },
    brief:
      'Propose concrete, sellable AI-assisted business ideas that fit the skills and audience given. ' +
      'Each idea must name who pays and what they get. Then say which to start first and why.',
    fields: [
      {
        id: 'skills',
        type: 'textarea',
        required: true,
        maxLength: 400,
        label: { fa: 'مهارت‌ها و علاقه‌هایت', en: 'Your skills and interests' },
        placeholder: { fa: 'مثلاً: طراحی گرافیک، نوشتن، فروش تلفنی', en: 'For example: design, writing, phone sales' },
      },
      audienceField,
    ],
    sections: [
      { id: 'ideas', kind: 'list', label: { fa: 'ایده‌ها', en: 'Ideas' } },
      { id: 'pick', kind: 'text', label: { fa: 'کدام را اول شروع کن', en: 'Start with' } },
      { id: 'first_steps', kind: 'steps', label: { fa: 'اولین قدم‌ها', en: 'First steps' } },
    ],
  },
  {
    id: 'product',
    icon: 'Rocket',
    gradient: ['#34d399', '#22d3ee'],
    title: { fa: 'سازنده محصول', en: 'Product builder' },
    subtitle: { fa: 'تبدیل ایده به نسخه‌ی قابل فروش', en: 'Turn an idea into a sellable version' },
    brief:
      'Turn the idea into the smallest version someone would pay for: what is in scope, what is cut, ' +
      'what it costs, and how to deliver it in two weeks.',
    fields: [businessField, budgetField],
    sections: [
      { id: 'offer', kind: 'text', label: { fa: 'پیشنهاد فروش', en: 'The offer' } },
      { id: 'scope', kind: 'list', label: { fa: 'در این نسخه هست', en: 'In scope' } },
      { id: 'cut', kind: 'list', label: { fa: 'در این نسخه نیست', en: 'Cut for now' } },
      { id: 'plan', kind: 'steps', label: { fa: 'برنامه‌ی دو هفته', en: 'Two-week plan' } },
    ],
  },
  {
    id: 'customer',
    icon: 'Users',
    gradient: ['#f97316', '#ef4444'],
    title: { fa: 'مشتری یابی', en: 'Customer finder' },
    subtitle: { fa: 'پیدا کردن مخاطب واقعی', en: 'Find the real audience' },
    brief:
      'Say exactly where this audience already gathers, what to say to them, and a seven-day plan ' +
      'to reach the first ten conversations without paid ads.',
    fields: [businessField, audienceField],
    sections: [
      { id: 'where', kind: 'list', label: { fa: 'کجا پیدایشان کنی', en: 'Where to find them' } },
      { id: 'message', kind: 'text', label: { fa: 'پیام اول', en: 'The opening message' } },
      { id: 'week', kind: 'steps', label: { fa: 'برنامه‌ی هفت روز', en: 'Seven-day plan' } },
    ],
  },
  {
    id: 'funnel',
    icon: 'GitBranch',
    gradient: ['#a78bfa', '#6366f1'],
    title: { fa: 'مسیر فروش', en: 'Sales funnel' },
    subtitle: { fa: 'چیدن قیف فروش از صفر', en: 'Lay out the funnel from scratch' },
    brief:
      'Lay out the funnel stage by stage for this business: the entry point, what moves someone to ' +
      'the next stage, and what to measure at each one.',
    fields: [businessField, budgetField],
    sections: [
      { id: 'stages', kind: 'steps', label: { fa: 'مراحل قیف', en: 'Funnel stages' } },
      { id: 'metrics', kind: 'list', label: { fa: 'چه چیزی را اندازه بگیر', en: 'What to measure' } },
      { id: 'leak', kind: 'text', label: { fa: 'محتمل‌ترین نقطه‌ی نشتی', en: 'Most likely leak' } },
    ],
  },
  {
    id: 'mindmap',
    icon: 'Network',
    gradient: ['#22d3ee', '#34d399'],
    title: { fa: 'نقشه ذهنی هوشمند', en: 'Smart mind map' },
    subtitle: { fa: 'نقشه‌ی توسعه‌ی بیزینس', en: 'Business development map' },
    brief:
      'Break the business into its main branches and the concrete pieces under each, so the owner ' +
      'can see the whole shape at once and pick what to build next.',
    fields: [businessField],
    sections: [
      { id: 'branches', kind: 'list', label: { fa: 'شاخه‌های اصلی', en: 'Main branches' } },
      { id: 'next', kind: 'steps', label: { fa: 'ترتیب ساخت', en: 'Build order' } },
      { id: 'risk', kind: 'text', label: { fa: 'بزرگ‌ترین ریسک', en: 'Biggest risk' } },
    ],
  },
  {
    id: 'content',
    icon: 'Factory',
    gradient: ['#fbbf24', '#f97316'],
    title: { fa: 'کارخونه تولید محتوا', en: 'Content factory' },
    subtitle: { fa: 'تولید و زمان‌بندی انتشار', en: 'Produce and schedule publishing' },
    brief:
      'Produce a two-week content plan where every piece shows the problem, proves the solution, ' +
      'or makes the offer — with the hook written out for each.',
    fields: [
      businessField,
      {
        id: 'channel',
        type: 'select',
        label: { fa: 'کانال اصلی', en: 'Primary channel' },
        options: [
          { value: 'instagram', label: { fa: 'اینستاگرام', en: 'Instagram' } },
          { value: 'telegram', label: { fa: 'تلگرام', en: 'Telegram' } },
          { value: 'linkedin', label: { fa: 'لینکدین', en: 'LinkedIn' } },
          { value: 'youtube', label: { fa: 'یوتیوب', en: 'YouTube' } },
        ],
      },
    ],
    sections: [
      { id: 'angles', kind: 'list', label: { fa: 'زاویه‌های محتوا', en: 'Content angles' } },
      { id: 'calendar', kind: 'steps', label: { fa: 'تقویم دو هفته', en: 'Two-week calendar' } },
      { id: 'cta', kind: 'text', label: { fa: 'دعوت به اقدام', en: 'Call to action' } },
    ],
  },
  {
    id: 'social',
    icon: 'Sparkles',
    gradient: ['#38bdf8', '#818cf8'],
    title: { fa: 'سوشال رشد', en: 'Social growth' },
    subtitle: { fa: 'رشد پیج و جذب مخاطب', en: 'Grow the page and its audience' },
    brief:
      'Turn the page into an acquisition path: what the bio and pinned content must do, what to post ' +
      'to be found, and what converts a follower into a conversation.',
    fields: [businessField, audienceField],
    sections: [
      { id: 'profile', kind: 'list', label: { fa: 'اصلاح پروفایل', en: 'Fix the profile' } },
      { id: 'growth', kind: 'steps', label: { fa: 'حرکت‌های رشد', en: 'Growth moves' } },
      { id: 'convert', kind: 'text', label: { fa: 'تبدیل فالوور به گفتگو', en: 'Follower to conversation' } },
    ],
  },
]

export const specById = (id: string): AiToolSpec | undefined =>
  aiToolSpecs.find((spec) => spec.id === id)

export const TOOL_IDS = aiToolSpecs.map((spec) => spec.id)
