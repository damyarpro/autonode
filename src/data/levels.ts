import type { Bi } from './types'

/**
 * The seven levels of the learning path. Stage counts add up to the 23 the
 * dashboard's progress bar counts against.
 */
export type Level = {
  id: number
  title: Bi
  description: Bi
  stages: number
  icon: string
}

export const levels: Level[] = [
  {
    id: 1,
    stages: 5,
    icon: 'Lightbulb',
    title: { fa: 'انتخاب ایده', en: 'Choose the idea' },
    description: {
      fa: 'از بین ایده‌های پراکنده، یک مسیر واقعی انتخاب کن و اولین دارایی قابل استفاده‌ات رو بساز.',
      en: 'Pick one real direction out of the scattered ideas and build your first usable asset.',
    },
  },
  {
    id: 2,
    stages: 3,
    icon: 'Rocket',
    title: { fa: 'ساخت اولین نسخه قابل فروش', en: 'Build the first sellable version' },
    description: {
      fa: 'ایده‌ات رو از حالت فکر و حرف درمیاری و به یک سرویس ساده، قابل تست و قابل فروش تبدیل می‌کنی.',
      en: 'Take the idea out of talk and turn it into a simple service you can test and sell.',
    },
  },
  {
    id: 3,
    stages: 3,
    icon: 'Palette',
    title: { fa: 'ساخت برند قابل اعتماد', en: 'Build a brand people trust' },
    description: {
      fa: 'به سرویس‌ات شخصیت، ظاهر و پیام قابل اعتماد می‌دی تا مشتری تو رو جدی‌تر بگیره.',
      en: 'Give the service a character, a look and a message so customers take you seriously.',
    },
  },
  {
    id: 4,
    stages: 3,
    icon: 'Users',
    title: { fa: 'ساخت ماشین مخاطب', en: 'Build the audience machine' },
    description: {
      fa: 'پیجت رو از یک صفحه معمولی به مسیر جذب، اعتمادسازی و تبدیل مخاطب به مشتری تبدیل می‌کنی.',
      en: 'Turn the page from an ordinary feed into a path that attracts, builds trust and converts.',
    },
  },
  {
    id: 5,
    stages: 3,
    icon: 'Globe',
    title: { fa: 'ساخت زیرساخت فروش آنلاین', en: 'Build the online sales infrastructure' },
    description: {
      fa: 'زیرساخت‌های اصلی آنلاین رو می‌سازی تا مشتری بتونه تو رو پیدا کنه، بفهمه، اعتماد کنه و خرید انجام بده.',
      en: 'Put the core infrastructure in place so a customer can find you, understand you, trust you and buy.',
    },
  },
  {
    id: 6,
    stages: 3,
    icon: 'BarChart3',
    title: { fa: 'ساخت قیف فروش پولساز', en: 'Build the funnel that earns' },
    description: {
      fa: 'با روش‌های ساده و کم‌هزینه، مشتری‌های احتمالی رو پیدا می‌کنی و یاد می‌گیری چطور آن‌ها را به خرید برسونی.',
      en: 'Find prospects with simple, cheap methods and learn how to walk them to a purchase.',
    },
  },
  {
    id: 7,
    stages: 3,
    icon: 'Settings',
    title: { fa: 'خودکار سازی کامل', en: 'Full automation' },
    description: {
      fa: 'کارهای تکراری کسب‌وکارت رو سیستم‌سازی می‌کنی و با کمک AI سرعت، نظم و اجرای کارت رو بالا می‌بری.',
      en: 'Systemise the repetitive work and use AI to raise your speed, order and execution.',
    },
  },
]

export const TOTAL_STAGES = levels.reduce((sum, level) => sum + level.stages, 0)

export const finalGoal: Bi = {
  fa: 'هدف نهایی: سیستم خودکار پولسازی',
  en: 'Final goal: an automated earning system',
}

export const levelsHeading = {
  title: { fa: '۷ سطح تسلط بر کسب‌وکار AI', en: '7 levels of AI business mastery' },
  subtitle: { fa: 'از انتخاب ایده تا ساخت کسب‌وکار درآمد دلاری', en: 'From picking an idea to a dollar-earning business' },
  overall: { fa: 'پیشرفت کلی', en: 'Overall progress' },
  start: { fa: 'شروع سفر', en: 'Journey start' },
  mastery: { fa: 'تسلط کامل', en: 'Full mastery' },
  levelOf: { fa: 'سطح {n} از ۷', en: 'Level {n} of 7' },
  progress: { fa: 'پیشرفت', en: 'Progress' },
  stages: { fa: '{n} مرحله', en: '{n} stages' },
  details: { fa: 'مشاهده جزئیات ←', en: 'View details →' },
  level: { fa: 'سطح {n}', en: 'Level {n}' },
}
