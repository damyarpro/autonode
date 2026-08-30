import { env } from '../env.ts'
import { runDueSteps } from '../service.ts'

let timer: NodeJS.Timeout | null = null

/** Drains due nurture steps on an interval. One pass at a time, never overlapping. */
export function startWorker(): void {
  if (timer || !env.workerEnabled) return
  let running = false

  timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      const sent = await runDueSteps()
      if (sent > 0) console.log(`[worker] delivered ${sent} nurture step(s)`)
    } catch (error) {
      console.error('[worker] pass failed:', (error as Error).message)
    } finally {
      running = false
    }
  }, env.workerIntervalMs)

  timer.unref()
}

export function stopWorker(): void {
  if (timer) clearInterval(timer)
  timer = null
}
