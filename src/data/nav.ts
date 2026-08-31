import type { Bi } from './types'

/**
 * The five tabs, in the order the screenshots show them. Rule 1: the bottom bar
 * on a phone and the side rail on a desktop are two renderings of this one list,
 * never two lists.
 */
export const tabs: { to: string; icon: string; label: Bi }[] = [
  { to: '/', icon: 'Home', label: { fa: 'داشبورد', en: 'Dashboard' } },
  { to: '/levels', icon: 'Trophy', label: { fa: 'مراحل', en: 'Levels' } },
  { to: '/profile', icon: 'User', label: { fa: 'پروفایل', en: 'Profile' } },
  { to: '/ai-coach', icon: 'Brain', label: { fa: 'AI کوچ', en: 'AI coach' } },
  { to: '/tools', icon: 'Wrench', label: { fa: 'ابزارها', en: 'Tools' } },
]

/**
 * Reached from inside the app rather than from a tab. The rail has room to show
 * them; the phone's bottom bar does not, which is why they are a separate list.
 */
export const deepLinks: { to: string; icon: string; label: Bi }[] = [
  { to: '/sales-automation', icon: 'Workflow', label: { fa: 'بوم فروش', en: 'Sales board' } },
  { to: '/boards', icon: 'Layers', label: { fa: 'بوم‌های من', en: 'My boards' } },
  { to: '/leads', icon: 'Users', label: { fa: 'لیدها', en: 'Leads' } },
  { to: '/inbox', icon: 'MessageSquare', label: { fa: 'صندوق پیام', en: 'Inbox' } },
]
