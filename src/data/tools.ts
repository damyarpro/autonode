import type { Bi } from './types'

/**
 * Everything on the Tools tab, read from one place: the eight in-app AI tools,
 * the two courses, and the external services grouped by category.
 */

export const TOOL_CATEGORIES = [
  'design',
  'management',
  'analytics',
  'marketing',
  'payment',
  'automation',
] as const
export type ToolCategory = (typeof TOOL_CATEGORIES)[number]

export const CATEGORY_LABEL: Record<ToolCategory | 'all', Bi> = {
  all: { fa: 'همه', en: 'All' },
  design: { fa: 'طراحی', en: 'Design' },
  management: { fa: 'مدیریت', en: 'Management' },
  analytics: { fa: 'تحلیل', en: 'Analytics' },
  marketing: { fa: 'بازاریابی', en: 'Marketing' },
  payment: { fa: 'پرداخت', en: 'Payment' },
  automation: { fa: 'اتوماسیون', en: 'Automation' },
}

export type ExternalTool = {
  name: string
  description: Bi
  category: ToolCategory
  /** Lucide icon name, resolved in src/components/ToolIcon.tsx. */
  icon: string
  color: string
  url: string
}

/** Tools that live outside the app; the badge on each card reads "خارجی". */
export const externalTools: ExternalTool[] = [
  // ── design ────────────────────────────────────────────────────────────
  {
    name: 'Figma',
    description: { fa: 'طراحی رابط کاربری و پروتوتایپ', en: 'Interface design and prototyping' },
    category: 'design',
    icon: 'PenTool',
    color: '#8b5cf6',
    url: 'https://figma.com',
  },
  {
    name: 'Canva',
    description: { fa: 'طراحی گرافیک و محتوای بصری سریع', en: 'Fast graphics and visual content' },
    category: 'design',
    icon: 'Palette',
    color: '#3b82f6',
    url: 'https://canva.com',
  },
  {
    name: 'Freepik',
    description: { fa: 'دانلود المان و تصاویر گرافیکی', en: 'Graphic assets and stock imagery' },
    category: 'design',
    icon: 'Image',
    color: '#22c55e',
    url: 'https://freepik.com',
  },
  {
    name: 'Looka',
    description: { fa: 'ساخت لوگو خودکار', en: 'Automatic logo generation' },
    category: 'design',
    icon: 'Eye',
    color: '#ec4899',
    url: 'https://looka.com',
  },
  {
    name: 'LogoMaker',
    description: { fa: 'ساخت لوگو آنلاین', en: 'Online logo builder' },
    category: 'design',
    icon: 'Layers',
    color: '#f97316',
    url: 'https://logomaker.com',
  },
  {
    name: 'Midjourney',
    description: { fa: 'تولید تصاویر خلاقانه با AI', en: 'Creative image generation with AI' },
    category: 'design',
    icon: 'Sparkles',
    color: '#6366f1',
    url: 'https://midjourney.com',
  },
  {
    name: 'Crello (VistaCreate)',
    description: { fa: 'طراحی پست و ویدیو اجتماعی', en: 'Social post and video design' },
    category: 'design',
    icon: 'FileText',
    color: '#14b8a6',
    url: 'https://create.vista.com',
  },

  // ── management ────────────────────────────────────────────────────────
  {
    name: 'Notion',
    description: { fa: 'مدیریت پروژه و ایده‌ها', en: 'Project and idea management' },
    category: 'management',
    icon: 'Brain',
    color: '#3f3f46',
    url: 'https://notion.so',
  },
  {
    name: 'Asana',
    description: { fa: 'مدیریت پروژه تیمی', en: 'Team project management' },
    category: 'management',
    icon: 'Target',
    color: '#f97316',
    url: 'https://asana.com',
  },
  {
    name: 'Trello',
    description: { fa: 'مدیریت وظایف و تیم', en: 'Task and team management' },
    category: 'management',
    icon: 'Calendar',
    color: '#3b82f6',
    url: 'https://trello.com',
  },
  {
    name: 'Monday.com',
    description: { fa: 'سازماندهی پروژه‌ها و همکاری تیمی', en: 'Project organisation and collaboration' },
    category: 'management',
    icon: 'Workflow',
    color: '#ef4444',
    url: 'https://monday.com',
  },
  {
    name: 'ClickUp',
    description: { fa: 'مدیریت کارها و فرآیندها', en: 'Task and process management' },
    category: 'management',
    icon: 'Settings',
    color: '#a855f7',
    url: 'https://clickup.com',
  },
  {
    name: 'Dropbox',
    description: { fa: 'ذخیره و اشتراک‌گذاری فایل‌ها', en: 'File storage and sharing' },
    category: 'management',
    icon: 'Cloud',
    color: '#3b82f6',
    url: 'https://dropbox.com',
  },
  {
    name: 'Google Workspace',
    description: { fa: 'ابزار اداری آنلاین (Docs, Sheets, Drive)', en: 'Online office suite (Docs, Sheets, Drive)' },
    category: 'management',
    icon: 'FolderOpen',
    color: '#22c55e',
    url: 'https://workspace.google.com',
  },

  // ── analytics ─────────────────────────────────────────────────────────
  {
    name: 'Hotjar',
    description: { fa: 'تحلیل رفتار کاربران وب‌سایت', en: 'Website behaviour analytics' },
    category: 'analytics',
    icon: 'Eye',
    color: '#ef4444',
    url: 'https://hotjar.com',
  },
  {
    name: 'Google Analytics',
    description: { fa: 'تحلیل ترافیک وب‌سایت', en: 'Website traffic analytics' },
    category: 'analytics',
    icon: 'BarChart3',
    color: '#f97316',
    url: 'https://analytics.google.com',
  },
  {
    name: 'SEMrush',
    description: { fa: 'تحقیق کلمات کلیدی و تحلیل سئو', en: 'Keyword research and SEO analysis' },
    category: 'analytics',
    icon: 'Search',
    color: '#f97316',
    url: 'https://semrush.com',
  },
  {
    name: 'SimilarWeb',
    description: { fa: 'تحلیل رقبا و بازار', en: 'Competitor and market analysis' },
    category: 'analytics',
    icon: 'TrendingUp',
    color: '#a855f7',
    url: 'https://similarweb.com',
  },
  {
    name: 'Google Trends',
    description: { fa: 'بررسی ترندهای جستجو', en: 'Search trend research' },
    category: 'analytics',
    icon: 'TrendingUp',
    color: '#3b82f6',
    url: 'https://trends.google.com',
  },
  {
    name: 'Ahrefs',
    description: { fa: 'آنالیز بک‌لینک و سئو', en: 'Backlink and SEO analysis' },
    category: 'analytics',
    icon: 'Activity',
    color: '#ef4444',
    url: 'https://ahrefs.com',
  },
  {
    name: 'Social Blade',
    description: { fa: 'تحلیل عملکرد شبکه‌های اجتماعی', en: 'Social performance analytics' },
    category: 'analytics',
    icon: 'BarChart3',
    color: '#22c55e',
    url: 'https://socialblade.com',
  },

  // ── marketing ─────────────────────────────────────────────────────────
  {
    name: 'Meta Business Suite',
    description: { fa: 'مدیریت تبلیغات و پیج اینستاگرام/فیسبوک', en: 'Instagram and Facebook page and ads' },
    category: 'marketing',
    icon: 'MessageSquare',
    color: '#3b82f6',
    url: 'https://business.facebook.com',
  },
  {
    name: 'ActiveCampaign',
    description: { fa: 'ایمیل مارکتینگ و اتوماسیون', en: 'Email marketing and automation' },
    category: 'marketing',
    icon: 'Mail',
    color: '#22c55e',
    url: 'https://activecampaign.com',
  },
  {
    name: 'Google Ads',
    description: { fa: 'تبلیغات گوگل', en: 'Google advertising' },
    category: 'marketing',
    icon: 'ShoppingCart',
    color: '#ef4444',
    url: 'https://ads.google.com',
  },
  {
    name: 'ManyChat',
    description: { fa: 'ساخت چت‌بات‌های بازاریابی', en: 'Marketing chatbot builder' },
    category: 'marketing',
    icon: 'MessageSquare',
    color: '#a855f7',
    url: 'https://manychat.com',
  },
  {
    name: 'MailerLite',
    description: { fa: 'ایمیل مارکتینگ ساده', en: 'Simple email marketing' },
    category: 'marketing',
    icon: 'Mail',
    color: '#3b82f6',
    url: 'https://mailerlite.com',
  },
  {
    name: 'LinkedIn Sales Navigator',
    description: { fa: 'جذب مشتری B2B', en: 'B2B customer acquisition' },
    category: 'marketing',
    icon: 'Network',
    color: '#2563eb',
    url: 'https://business.linkedin.com/sales-solutions/sales-navigator',
  },
  {
    name: 'HubSpot CRM',
    description: { fa: 'بازاریابی و مدیریت مشتریان', en: 'Marketing and customer management' },
    category: 'marketing',
    icon: 'Users',
    color: '#f97316',
    url: 'https://hubspot.com',
  },
  {
    name: 'Hootsuite',
    description: { fa: 'مدیریت چندین شبکه اجتماعی', en: 'Multi-network social management' },
    category: 'marketing',
    icon: 'Globe',
    color: '#f97316',
    url: 'https://hootsuite.com',
  },
  {
    name: 'Buffer',
    description: { fa: 'زمان‌بندی پست شبکه‌های اجتماعی', en: 'Social post scheduling' },
    category: 'marketing',
    icon: 'Clock',
    color: '#22c55e',
    url: 'https://buffer.com',
  },

  // ── payment ───────────────────────────────────────────────────────────
  {
    name: 'PayPing',
    description: { fa: 'پرداخت و انتقال وجه آنلاین', en: 'Online payment and transfer' },
    category: 'payment',
    icon: 'DollarSign',
    color: '#3b82f6',
    url: 'https://payping.ir',
  },
  {
    name: 'زرین‌پال',
    description: { fa: 'درگاه پرداخت آنلاین ایرانی', en: 'Iranian online payment gateway' },
    category: 'payment',
    icon: 'CreditCard',
    color: '#22c55e',
    url: 'https://zarinpal.com',
  },
  {
    name: 'Stripe',
    description: { fa: 'پرداخت بین‌المللی', en: 'International payments' },
    category: 'payment',
    icon: 'Shield',
    color: '#8b5cf6',
    url: 'https://stripe.com',
  },
  {
    name: 'زیبال',
    description: { fa: 'درگاه پرداخت و تسویه سریع', en: 'Payment gateway with fast settlement' },
    category: 'payment',
    icon: 'CreditCard',
    color: '#a855f7',
    url: 'https://zibal.ir',
  },
  {
    name: 'Square',
    description: { fa: 'پرداخت و مدیریت فروشگاه', en: 'Payments and store management' },
    category: 'payment',
    icon: 'ShoppingCart',
    color: '#22c55e',
    url: 'https://squareup.com',
  },
  {
    name: 'PayPal',
    description: { fa: 'پرداخت بین‌المللی', en: 'International payments' },
    category: 'payment',
    icon: 'CreditCard',
    color: '#3b82f6',
    url: 'https://paypal.com',
  },
  {
    name: 'NextPay',
    description: { fa: 'درگاه پرداخت ایرانی', en: 'Iranian payment gateway' },
    category: 'payment',
    icon: 'CreditCard',
    color: '#f97316',
    url: 'https://nextpay.org',
  },

  // ── automation ────────────────────────────────────────────────────────
  {
    name: 'Zapier',
    description: { fa: 'اتصال خودکار سرویس‌ها و ابزارها', en: 'Automatic service and tool connections' },
    category: 'automation',
    icon: 'Zap',
    color: '#ef4444',
    url: 'https://zapier.com',
  },
  {
    name: 'Make (Integromat)',
    description: { fa: 'اتوماسیون کارها و فرآیندها', en: 'Task and process automation' },
    category: 'automation',
    icon: 'Workflow',
    color: '#3b82f6',
    url: 'https://make.com',
  },
  {
    name: 'n8n',
    description: { fa: 'ساخت اتوماسیون پیشرفته با کنترل کامل', en: 'Advanced automation with full control' },
    category: 'automation',
    icon: 'Cpu',
    color: '#a855f7',
    url: 'https://n8n.io',
  },
  {
    name: 'GoHighLevel',
    description: { fa: 'CRM و اتوماسیون بازاریابی', en: 'CRM and marketing automation' },
    category: 'automation',
    icon: 'Database',
    color: '#22c55e',
    url: 'https://gohighlevel.com',
  },
  {
    name: 'IFTTT',
    description: { fa: 'اتوماسیون ساده بین اپلیکیشن‌ها', en: 'Simple app-to-app automation' },
    category: 'automation',
    icon: 'Link',
    color: '#f97316',
    url: 'https://ifttt.com',
  },
  {
    name: 'Bitrix24',
    description: { fa: 'CRM و اتوماسیون کسب‌وکار', en: 'CRM and business automation' },
    category: 'automation',
    icon: 'GitBranch',
    color: '#3b82f6',
    url: 'https://bitrix24.com',
  },
  {
    name: 'Pabbly Connect',
    description: { fa: 'اتوماسیون مقرون‌به‌صرفه', en: 'Budget-friendly automation' },
    category: 'automation',
    icon: 'Server',
    color: '#a855f7',
    url: 'https://pabbly.com/connect',
  },
]

export type AiTool = {
  id: string
  title: Bi
  subtitle: Bi
  icon: string
  /** Two-stop gradient painted on the card's accent bar. */
  gradient: [string, string]
  /** In-app route when the tool is already built here. */
  to?: string
}

/** The eight in-app tools shown on both the dashboard and the tools tab. */
export const aiTools: AiTool[] = [
  {
    id: 'idea',
    title: { fa: 'ایده یابی', en: 'Idea finder' },
    subtitle: { fa: 'پیدا کردن ایده‌ی قابل فروش', en: 'Find an idea worth selling' },
    icon: 'Lightbulb',
    gradient: ['#22d3ee', '#3b82f6'],
    to: '/tools/idea',
  },
  {
    id: 'product',
    title: { fa: 'سازنده محصول', en: 'Product builder' },
    subtitle: { fa: 'تبدیل ایده به نسخه‌ی قابل فروش', en: 'Turn an idea into a sellable version' },
    icon: 'Rocket',
    gradient: ['#34d399', '#22d3ee'],
    to: '/tools/product',
  },
  {
    id: 'customer',
    title: { fa: 'مشتری یابی', en: 'Customer finder' },
    subtitle: { fa: 'پیدا کردن مخاطب واقعی', en: 'Find the real audience' },
    icon: 'Users',
    gradient: ['#f97316', '#ef4444'],
    to: '/tools/customer',
  },
  {
    id: 'funnel',
    title: { fa: 'مسیر فروش', en: 'Sales funnel' },
    subtitle: { fa: 'چیدن قیف فروش از صفر', en: 'Lay out the funnel from scratch' },
    icon: 'GitBranch',
    gradient: ['#a78bfa', '#6366f1'],
    to: '/tools/funnel',
  },
  {
    id: 'sales',
    title: { fa: 'مدیریت فروش', en: 'Sales management' },
    subtitle: { fa: 'بوم زنده‌ی خودکارسازی فروش', en: 'The live sales-automation board' },
    icon: 'BarChart3',
    gradient: ['#f472b6', '#a855f7'],
    to: '/sales-automation',
  },
  {
    id: 'mindmap',
    title: { fa: 'نقشه ذهنی هوشمند', en: 'Smart mind map' },
    subtitle: { fa: 'نقشه‌ی توسعه‌ی بیزینس', en: 'Business development map' },
    icon: 'Network',
    gradient: ['#22d3ee', '#34d399'],
    to: '/tools/mindmap',
  },
  {
    id: 'content',
    title: { fa: 'کارخونه تولید محتوا', en: 'Content factory' },
    subtitle: { fa: 'تولید و زمان‌بندی انتشار', en: 'Produce and schedule publishing' },
    icon: 'Factory',
    gradient: ['#fbbf24', '#f97316'],
    to: '/tools/content',
  },
  {
    id: 'social',
    title: { fa: 'سوشال رشد', en: 'Social growth' },
    subtitle: { fa: 'رشد پیج و جذب مخاطب', en: 'Grow the page and its audience' },
    icon: 'Sparkles',
    gradient: ['#38bdf8', '#818cf8'],
    to: '/tools/social',
  },
]

export type Course = { id: string; title: Bi; subtitle: Bi; icon: string }

export const courses: Course[] = [
  {
    id: 'dollar-income',
    title: { fa: 'دوره درآمد دلاری واقعی', en: 'Real dollar income course' },
    subtitle: { fa: 'مسیر سریع و کاربردی برای رشد', en: 'A fast, practical route to growth' },
    icon: 'DollarSign',
  },
  {
    id: 'ai-coding',
    title: { fa: 'دوره کد نویسی با هوش مصنوعی', en: 'Coding with AI course' },
    subtitle: { fa: 'ساخت محصول بدون تیم فنی', en: 'Ship a product without an engineering team' },
    icon: 'Code',
  },
]

export type ReadyPrompt = { id: string; label: Bi; prompt: Bi }

/** Behind the "پرامپت‌های آماده" button on the coach tab. */
export const readyPrompts: ReadyPrompt[] = [
  {
    id: 'pick-idea',
    label: { fa: 'ایده‌ام را انتخاب کن', en: 'Help me pick an idea' },
    prompt: {
      fa: 'سه ایده‌ی کسب‌وکار AI متناسب با مهارت‌های من پیشنهاد بده و بگو کدام را اول شروع کنم و چرا.',
      en: 'Suggest three AI business ideas that fit my skills, and tell me which to start first and why.',
    },
  },
  {
    id: 'first-offer',
    label: { fa: 'اولین پیشنهاد فروش', en: 'My first offer' },
    prompt: {
      fa: 'کمکم کن اولین نسخه‌ی قابل فروش سرویسم را تعریف کنم: چه چیزی بفروشم، به چه کسی و با چه قیمتی.',
      en: 'Help me define the first sellable version of my service: what to sell, to whom, at what price.',
    },
  },
  {
    id: 'find-customers',
    label: { fa: 'مشتری اول را پیدا کن', en: 'Find my first customers' },
    prompt: {
      fa: 'یک برنامه‌ی هفت‌روزه بده برای پیدا کردن ده مشتری اول، بدون بودجه‌ی تبلیغات.',
      en: 'Give me a seven-day plan to find my first ten customers with no ad budget.',
    },
  },
  {
    id: 'content-plan',
    label: { fa: 'برنامه محتوا', en: 'Content plan' },
    prompt: {
      fa: 'یک برنامه‌ی محتوای دو هفته‌ای برای پیج من بنویس که به فروش ختم شود، نه فقط بازدید.',
      en: 'Write a two-week content plan for my page that ends in sales, not just views.',
    },
  },
  {
    id: 'automate',
    label: { fa: 'چه چیزی را خودکار کنم', en: 'What to automate' },
    prompt: {
      fa: 'کدام کارهای تکراری کسب‌وکارم را اول خودکار کنم و با چه ابزاری؟',
      en: 'Which repetitive parts of my business should I automate first, and with which tools?',
    },
  },
]
