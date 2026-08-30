import type { ReactNode } from 'react'
import TabBar from './TabBar'

/**
 * Mobile-first frame: a scrolling page above a fixed tab bar. `flush` is for
 * pages that own their own scrolling, like the coach chat and the canvas.
 */
export default function AppShell({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
  return (
    <div className="min-h-full bg-canvas">
      {flush ? (
        <div className="flex h-[calc(100dvh-var(--tabbar))] flex-col">{children}</div>
      ) : (
        <main className="mx-auto max-w-2xl px-4 pb-[calc(var(--tabbar)+16px)] pt-4">{children}</main>
      )}
      <TabBar />
    </div>
  )
}
