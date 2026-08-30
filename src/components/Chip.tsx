import type { ReactNode } from 'react'

const TONES = {
  hot: 'border-[#ff6b3d]/40 text-[#ff9a76] bg-[#ff6b3d]/10',
  warm: 'border-success/40 text-success bg-success/10',
  cold: 'border-[#5b7cff]/40 text-[#93a8ff] bg-[#5b7cff]/10',
  neutral: 'border-hairline text-white/55 bg-white/[0.05]',
  accent: 'border-accent/40 text-[#c0aeff] bg-accent/10',
} as const

export type ChipTone = keyof typeof TONES

export default function Chip({ tone = 'neutral', children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${TONES[tone]}`}>
      {children}
    </span>
  )
}
