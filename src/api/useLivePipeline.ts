import { useEffect, useRef, useState } from 'react'
import { apiUrl, getJson, type StreamEvent } from './client'

export type LivePipeline = {
  /** Live values keyed `<nodeId>.<slot>` / `kpi.<name>`; empty when offline. */
  metrics: Record<string, number>
  connected: boolean
  /** Counter per edge id; bumping it makes that edge fire a one-off pulse. */
  pulses: Record<string, number>
  /** Node ids touched by the most recent event, for a short highlight. */
  hotNodes: Record<string, number>
}

const EMPTY: LivePipeline = { metrics: {}, connected: false, pulses: {}, hotNodes: {} }

/**
 * Reads the funnel's real numbers and then follows the event stream. When the
 * API is unreachable this stays empty and the canvas renders the fallbacks
 * baked into src/data/pipeline.ts, so the board never breaks.
 */
export function useLivePipeline(): LivePipeline {
  const [state, setState] = useState<LivePipeline>(EMPTY)
  const refreshTimer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadMetrics = async () => {
      try {
        const data = await getJson<{ metrics: Record<string, number> }>('/api/pipeline')
        if (!cancelled) setState((prev) => ({ ...prev, metrics: data.metrics, connected: true }))
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, connected: false }))
      }
    }

    void loadMetrics()

    const source = new EventSource(apiUrl('/api/stream'))
    source.onopen = () => setState((prev) => ({ ...prev, connected: true }))
    source.onerror = () => setState((prev) => ({ ...prev, connected: false }))
    source.onmessage = (message) => {
      let event: StreamEvent
      try {
        event = JSON.parse(message.data) as StreamEvent
      } catch {
        return
      }
      setState((prev) => ({
        ...prev,
        pulses: event.edgeId ? { ...prev.pulses, [event.edgeId]: (prev.pulses[event.edgeId] ?? 0) + 1 } : prev.pulses,
        hotNodes: event.nodeId ? { ...prev.hotNodes, [event.nodeId]: Date.now() } : prev.hotNodes,
      }))

      // A burst of events should cost one refetch, not one each.
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
      refreshTimer.current = window.setTimeout(() => void loadMetrics(), 400)
    }

    const poll = window.setInterval(() => void loadMetrics(), 30_000)

    return () => {
      cancelled = true
      source.close()
      window.clearInterval(poll)
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
    }
  }, [])

  return state
}
