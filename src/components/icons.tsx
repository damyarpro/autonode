import type { IconKey } from '../data/types'

type Glyph = { tint: string; fg: string; path: JSX.Element; outline?: boolean }

/** Neutral system steps are drawn as outlined tiles; branded steps are filled. */
const OUTLINED = new Set<IconKey>([
  'warm', 'cold', 'voice', 'calendar', 'memory', 'inbox', 'router', 'delivery', 'support', 'referral',
])

const s = (d: string, extra?: Record<string, string | number>) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...extra} />
)

/**
 * Simple glyphs standing in for each vendor — recognisable at node size
 * without reproducing anyone's logo artwork.
 */
const glyphs: Record<IconKey, Glyph> = {
  elevenlabs: { tint: '#f5f5f7', fg: '#0b0b10', path: <g>{s('M9 6v12')}{s('M15 6v12')}</g> },
  higgsfield: { tint: '#d7f24a', fg: '#141a05', path: <g>{s('M5 12h14')}{s('M12 5v14')}{s('M7.5 7.5l9 9')}{s('M16.5 7.5l-9 9')}</g> },
  factory: { tint: '#ff4d6d', fg: '#fff', path: <g>{s('M18 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z')}{s('M6 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z')}{s('M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z')}{s('m8 11 8-4M8 13l8 4')}</g> },
  instagram: { tint: '#e1306c', fg: '#fff', path: <g>{s('M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z')}{s('M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z')}{s('M17.2 6.8h.01')}</g> },
  telegram: { tint: '#229ed9', fg: '#fff', path: <g>{s('m21 4-9.5 16-2-6.5L3 11.5 21 4Z')}{s('m9.5 13.5 11.5-9.5')}</g> },
  linkedin: { tint: '#0a66c2', fg: '#fff', path: <g>{s('M5 9v10M5 5.5h.01M10 19v-5.5a2.5 2.5 0 0 1 5 0V19M10 9v10')}</g> },
  youtube: { tint: '#ff0000', fg: '#fff', path: <g>{s('M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 15.5v-7Z')}{s('m10.5 9.5 4 2.5-4 2.5v-5Z')}</g> },
  website: { tint: '#7c5cff', fg: '#fff', path: <g>{s('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z')}{s('M3.5 9h17M3.5 15h17')}{s('M12 3c2.5 2.5 3.5 5.6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.6-3.5-9s1-6.5 3.5-9Z')}</g> },
  inbox: { tint: '#8b8b9a', fg: '#fff', path: <g>{s('M3 7.5 12 13l9-5.5')}{s('M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9Z')}</g> },
  router: { tint: '#7c5cff', fg: '#fff', path: <g>{s('M5 6h6M5 12h14M5 18h9')}{s('M17 3.5 20.5 6 17 8.5')}{s('M14 15.5 17.5 18 14 20.5')}</g> },
  hot: { tint: '#ff6b3d', fg: '#fff', path: <g>{s('M12 3c1.5 3 4.5 4.5 4.5 8a4.5 4.5 0 1 1-9 0c0-1.6.8-2.7 1.7-3.6')}{s('M12 20.5a2.5 2.5 0 0 0 2.5-2.5c0-1.7-2.5-3.5-2.5-3.5S9.5 16.3 9.5 18a2.5 2.5 0 0 0 2.5 2.5Z')}</g> },
  warm: { tint: '#10a37f', fg: '#fff', path: <g>{s('M12 3.5 19 7.5v9L12 20.5 5 16.5v-9L12 3.5Z')}{s('M12 3.5v17M5 7.5l14 9M19 7.5l-14 9')}</g> },
  cold: { tint: '#5b7cff', fg: '#fff', path: <g>{s('M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9')}{s('M9.5 5 12 7.5 14.5 5M9.5 19l2.5-2.5 2.5 2.5')}</g> },
  voice: { tint: '#111118', fg: '#fff', path: <g>{s('M3 12h2l2-5 3 10 3-13 3 16 2-8h3')}</g> },
  calendar: { tint: '#8b8b9a', fg: '#fff', path: <g>{s('M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12Z')}{s('M4 10h16M8.5 3v4M15.5 3v4')}</g> },
  memory: { tint: '#8b8b9a', fg: '#fff', path: <g>{s('M5 5.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-13Z')}{s('M12 12a2.2 2.2 0 1 0 0-4.4A2.2 2.2 0 0 0 12 12Z')}{s('M8.3 16.5a3.9 3.9 0 0 1 7.4 0')}</g> },
  card: { tint: '#7c5cff', fg: '#fff', path: <g>{s('M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9Z')}{s('M3 10.5h18M6.5 14.5h4')}</g> },
  check: { tint: '#34d399', fg: '#062b1f', path: <g>{s('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z')}{s('m8.2 12.2 2.6 2.6 5-5.6')}</g> },
  growth: { tint: '#7c5cff', fg: '#fff', path: <g>{s('M4 18.5 9.5 13l3.5 3.5L20 9')}{s('M15.5 9H20v4.5')}{s('M4 21h16')}</g> },
  delivery: { tint: '#8b8b9a', fg: '#fff', path: <g>{s('m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3Z')}{s('M4 7.2 12 11.5l8-4.3M12 11.5V21')}</g> },
  support: { tint: '#8b8b9a', fg: '#fff', path: <g>{s('M4 14v-2a8 8 0 1 1 16 0v2')}{s('M4 13h2.5v5H5.5A1.5 1.5 0 0 1 4 16.5V13ZM17.5 13H20v3.5A1.5 1.5 0 0 1 18.5 18h-1v-5Z')}{s('M20 17v1.5A2.5 2.5 0 0 1 17.5 21H13')}</g> },
  referral: { tint: '#8b8b9a', fg: '#fff', path: <g>{s('M18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z')}{s('m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1')}</g> },
}

export function NodeIcon({ icon, size = 30 }: { icon: IconKey; size?: number }) {
  const glyph = glyphs[icon]
  const outlined = OUTLINED.has(icon)
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[9px]"
      style={{
        width: size,
        height: size,
        background: outlined ? 'rgba(255,255,255,0.04)' : glyph.tint,
        color: outlined ? 'rgba(255,255,255,0.85)' : glyph.fg,
        boxShadow: outlined ? 'inset 0 0 0 1px rgba(255,255,255,0.14)' : 'none',
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} aria-hidden>
        {glyph.path}
      </svg>
    </span>
  )
}

const kpiGlyphs = {
  deal: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9ZM3 10.5h18',
  pipeline: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11ZM8 15V9M12 15v-3M16 15v-5',
  close: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  cycle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5.2l3.4 2',
} as const

export function KpiIcon({ icon }: { icon: keyof typeof kpiGlyphs }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-[#b6a4ff]">
      <svg viewBox="0 0 24 24" width={19} height={19} aria-hidden>
        {s(kpiGlyphs[icon])}
      </svg>
    </span>
  )
}
