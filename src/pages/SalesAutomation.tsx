import { useState } from 'react'
import KpiBar from '../components/KpiBar'
import NodeSheet from '../components/NodeSheet'
import PipelineCanvas from '../components/PipelineCanvas'
import AppHeader from '../components/AppHeader'
import AppShell from '../components/AppShell'
import { heading, nodes } from '../data/pipeline'
import { useI18n } from '../i18n/I18nProvider'
import { useLivePipeline } from '../api/useLivePipeline'

/**
 * The live board. The shell is `flush`, so this page is exactly one viewport
 * tall at both sizes — `--tabbar` is 62px under `lg` and 0 above it, which is
 * why the header, the KPI strip and the footer all have to earn their height:
 * whatever they take, the canvas loses.
 */
export default function SalesAutomation() {
  const { t } = useI18n()
  const live = useLivePipeline()
  const [openId, setOpenId] = useState<string | null>(null)
  const openNode = nodes.find((node) => node.id === openId) ?? null

  return (
    <AppShell flush>
      <AppHeader connected={live.connected} />

      <KpiBar metrics={live.metrics} />

      <main className="relative min-h-0 flex-1">
        <span className="pointer-events-none absolute end-4 top-3 z-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25 lg:end-6 lg:top-4 lg:text-[11px]">
          {t(heading.band)}
        </span>
        <PipelineCanvas metrics={live.metrics} pulses={live.pulses} hotNodes={live.hotNodes} onOpenNode={setOpenId} />
      </main>

      <footer className="border-t border-hairline bg-panel/70 px-4 py-2 text-[10px] leading-relaxed text-white/30 lg:px-5 lg:py-2.5">
        {t(heading.disclaimer)}
      </footer>

      <NodeSheet node={openNode} onClose={() => setOpenId(null)} />
    </AppShell>
  )
}
