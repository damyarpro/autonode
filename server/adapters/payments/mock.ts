import { randomUUID } from 'node:crypto'
import { env } from '../../env.ts'
import type { PaymentAdapter } from '../types.ts'

/**
 * A local checkout page that posts back to our own webhook. It moves no money
 * and talks to no gateway — a real provider goes behind this same interface,
 * and only on the owner's explicit request.
 */
export const mockPayments: PaymentAdapter = {
  provider: 'mock',
  live: false,

  async createCheckout({ leadId, dealId, amountToman }) {
    const ref = `mock_${randomUUID()}`
    const url = `${env.publicUrl}/api/checkout/page?ref=${ref}&lead=${leadId}&deal=${dealId}&amount=${amountToman}`
    return { url, ref }
  },
}
