import type { ReactNode } from 'react'
import SideRail from './SideRail'
import TabBar from './TabBar'

/**
 * The frame every page sits in, at both sizes.
 *
 * On a phone: a scrolling column above a fixed bottom bar, as before. Above
 * `lg`: the bar becomes a rail at the inline start, `--tabbar` collapses to
 * zero so a full-height page really is full height, and the reading column is
 * allowed to widen instead of leaving two thirds of the screen empty.
 *
 * `flush` is for pages that own their own scrolling — the coach chat, the
 * canvas — and it is those pages that need `--tabbar` to be honest.
 */
export default function AppShell({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
  return (
    <div className="min-h-full bg-canvas">
      <SideRail />

      <div className="lg:ps-60">
        {flush ? (
          <div className="flex h-[calc(100dvh-var(--tabbar))] flex-col">{children}</div>
        ) : (
          <main className="mx-auto max-w-2xl px-4 pb-[calc(var(--tabbar)+16px)] pt-4 lg:max-w-6xl lg:px-8 lg:pb-10 lg:pt-8">
            {children}
          </main>
        )}
      </div>

      <TabBar />
    </div>
  )
}
