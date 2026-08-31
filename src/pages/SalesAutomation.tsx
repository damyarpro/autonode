import { useState } from 'react'
import KpiBar from '../components/KpiBar'
import NodeSheet from '../components/NodeSheet'
import PipelineCanvas from '../components/PipelineCanvas'
import AppHeader from '../components/AppHeader'
import AppShell from '../components/AppShell'
import { heading, nodes } from '../data/pipeline'
import { useI18n } from '../i18n/I18nProvider'
import { useLivePipeline } from '../api/useLivePipeline'

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
        <span className="pointer-events-none absolute end-6 top-4 z-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/25">
          {t(heading.band)}
        </span>
        <PipelineCanvas metrics={live.metrics} pulses={live.pulses} hotNodes={live.hotNodes} onOpenNode={setOpenId} />
      </main>

      <footer className="border-t border-hairline bg-panel/70 px-5 py-2.5 text-[10px] leading-relaxed text-white/30">
        {t(heading.disclaimer)}
      </footer>

      <NodeSheet node={openNode} onClose={() => setOpenId(null)} />
    </AppShell>
  )
}
