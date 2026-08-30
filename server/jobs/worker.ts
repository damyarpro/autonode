import { env } from '../env.ts'
import { runDueSteps } from '../service.ts'
import { publishDue } from '../content/factory.ts'
import { runDueCallWork } from '../calls/calls.ts'

let timer: NodeJS.Timeout | null = null

/**
 * One pass over everything the board is supposed to do on its own: nurture
 * steps that came due, scheduled content that reached its slot, and the call
 * reminders and referral asks the booking side queued.
 *
 * Each part is awaited separately so a failing adapter in one of them cannot
 * stop the other two — the board should keep moving on whatever still works.
 */
async function pass(): Promise<void> {
  const results = await Promise.allSettled([runDueSteps(), publishDue(), runDueCallWork()])
  const [steps, content, calls] = results

  if (steps.status === 'fulfilled' && steps.value > 0) {
    console.log(`[worker] delivered ${steps.value} nurture step(s)`)
  }
  if (content.status === 'fulfilled' && content.value > 0) {
    console.log(`[worker] published ${content.value} content piece(s)`)
  }
  if (calls.status === 'fulfilled' && (calls.value.reminders > 0 || calls.value.referrals > 0)) {
    console.log(`[worker] sent ${calls.value.reminders} reminder(s), ${calls.value.referrals} referral ask(s)`)
  }

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[worker] pass failed:', (result.reason as Error).message)
    }
  }
}

/** Drains due work on an interval. One pass at a time, never overlapping. */
export function startWorker(): void {
  if (timer || !env.workerEnabled) return
  let running = false

  timer = setInterval(async () => {
    if (running) return
    running = true
    try {
      await pass()
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
