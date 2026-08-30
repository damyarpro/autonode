import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PageBanner from '../components/PageBanner'
import { SoonBadge } from '../components/Card'
import { Icon, IconTile } from '../components/Icon'
import {
  aiTools,
  CATEGORY_LABEL,
  courses,
  externalTools,
  TOOL_CATEGORIES,
  type ToolCategory,
} from '../data/tools'
import { useI18n } from '../i18n/I18nProvider'

const COPY = {
  banner: { fa: 'ابزارهای هوشمند', en: 'Smart tools' },
  bannerSub: { fa: 'مجموعه‌ای از ابزارهای قدرتمند AI', en: 'A set of powerful AI tools' },
  aiTitle: { fa: 'ابزارهای AI هوشمند', en: 'Smart AI tools' },
  aiSub: { fa: 'ابزارهای قدرتمند کسب‌وکار', en: 'Powerful business tools' },
  coursesTitle: { fa: 'دوره‌های ویژه', en: 'Featured courses' },
  coursesSub: { fa: 'دو مسیر سریع و کاربردی برای رشد', en: 'Two fast, practical routes to growth' },
  externalTitle: { fa: 'ابزارهای خارجی', en: 'External tools' },
  externalSub: { fa: 'ابزارهای مفید برای تکمیل کسب‌وکار شما', en: 'Useful tools to round out your business' },
  search: { fa: 'جستجو در ابزارها...', en: 'Search tools…' },
  external: { fa: 'خارجی', en: 'External' },
  noResults: { fa: 'ابزاری با این نام پیدا نشد.', en: 'No tool matches that name.' },
}

export default function Tools() {
  const { t, num } = useI18n()
  const [category, setCategory] = useState<ToolCategory | 'all'>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return externalTools.filter((tool) => {
      if (category !== 'all' && tool.category !== category) return false
      if (!needle) return true
      return (
        tool.name.toLowerCase().includes(needle) ||
        tool.description.fa.includes(needle) ||
        tool.description.en.toLowerCase().includes(needle)
      )
    })
  }, [category, query])

  return (
    <AppShell>
      <PageBanner icon="Wrench" title={COPY.banner} subtitle={COPY.bannerSub} />

      <h2 className="mt-5 text-center text-[16px] font-bold text-white">{t(COPY.aiTitle)}</h2>
      <p className="mb-3 text-center text-[11px] text-white/35">{t(COPY.aiSub)}</p>
      <div className="mb-6 grid grid-cols-2 gap-2.5">
        {aiTools.map((tool) => {
          const inner = (
            <>
              <span
                className="block h-0.5 w-7 rounded-full"
                style={{ background: `linear-gradient(90deg, ${tool.gradient[0]}, ${tool.gradient[1]})` }}
              />
              <span className="mt-3 block text-center text-[12.5px] font-medium text-white/90">{t(tool.title)}</span>
              <span className="mt-1 block text-center text-[10px] text-white/30">{t(tool.subtitle)}</span>
              <span className="mt-2 flex items-center justify-end">
                {tool.to ? <Icon name="ArrowUpRight" size={13} className="text-accent" /> : <SoonBadge />}
              </span>
            </>
          )
          return tool.to ? (
            <Link
              key={tool.id}
              to={tool.to}
              className="rounded-2xl border border-hairline bg-white/[0.03] p-3 transition hover:border-accent/40"
            >
              {inner}
            </Link>
          ) : (
            <div key={tool.id} className="rounded-2xl border border-hairline bg-white/[0.03] p-3">
              {inner}
            </div>
          )
        })}
      </div>

      <h2 className="text-center text-[16px] font-bold text-white">{t(COPY.coursesTitle)}</h2>
      <p className="mb-3 text-center text-[11px] text-white/35">{t(COPY.coursesSub)}</p>
      <div className="mb-6 grid grid-cols-2 gap-2.5">
        {courses.map((course) => (
          <div
            key={course.id}
            className="rounded-2xl border border-accent/30 bg-[linear-gradient(150deg,rgba(76,29,149,0.35),rgba(12,12,18,0.9))] p-3.5"
          >
            <div className="flex items-center justify-between">
              <SoonBadge />
              <Icon name={course.icon} size={15} className="text-accent" />
            </div>
            <div className="mt-2 text-center text-[12.5px] font-semibold text-white/90">{t(course.title)}</div>
            <div className="mt-1 text-center text-[10px] text-white/30">{t(course.subtitle)}</div>
          </div>
        ))}
      </div>

      <h2 className="text-center text-[16px] font-bold text-white">{t(COPY.externalTitle)}</h2>
      <p className="mb-3 text-center text-[11px] text-white/35">{t(COPY.externalSub)}</p>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t(COPY.search)}
        className="mx-auto mb-3 block w-full max-w-sm rounded-xl border border-hairline bg-black/40 px-4 py-2.5 text-center text-[12px] text-white/85 outline-none placeholder:text-white/25 focus:border-accent/50"
      />

      <div className="mb-4 flex flex-wrap justify-center gap-1.5">
        {(['all', ...TOOL_CATEGORIES] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className={`rounded-full px-3 py-1.5 text-[11px] transition ${
              category === value
                ? 'bg-accent text-white'
                : 'border border-hairline bg-white/[0.03] text-white/50 hover:text-white/85'
            }`}
          >
            {t(CATEGORY_LABEL[value])}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[12px] text-white/25">{t(COPY.noResults)}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {filtered.map((tool) => (
            <a
              key={tool.name}
              href={tool.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group rounded-2xl border border-hairline bg-white/[0.03] p-3 transition hover:border-accent/40"
            >
              {/* Leading edge first: tile, then the name, with the link glyph trailing. */}
              <div className="flex items-start gap-3">
                <IconTile name={tool.icon} color={tool.color} size={44} />
                <div className="min-w-0 flex-1 text-start">
                  <div className="truncate text-[12.5px] font-semibold text-white/90">{tool.name}</div>
                  <p className="truncate text-[10.5px] text-white/40">{t(tool.description)}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-white/35">
                      {t(COPY.external)}
                    </span>
                    <span className="rounded-md bg-accent/25 px-1.5 py-0.5 text-[9px] text-white/80">
                      {t(CATEGORY_LABEL[tool.category])}
                    </span>
                  </div>
                </div>
                <Icon
                  name="ExternalLink"
                  size={13}
                  className="mt-1 shrink-0 text-white/25 transition group-hover:text-accent"
                />
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-[10px] text-white/20">
        {num(filtered.length)} / {num(externalTools.length)}
      </p>
    </AppShell>
  )
}
