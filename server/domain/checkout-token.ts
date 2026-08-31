import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The mock checkout page runs in the buyer's browser and posts the confirmation
 * back to us, so the confirmation endpoint is reachable by anyone who can reach
 * the server. Without a token, anyone could claim a payment happened and write
 * a sale — and the growth loop would reinvest against money that never moved.
 *
 * So the server signs the four facts of a checkout when it creates one, and
 * only accepts a confirmation that carries the same signature back. This is
 * not a gateway and it is still not money; it is what stops a stranger from
 * writing rows in someone else's funnel.
 */
export type CheckoutFacts = {
  leadId: number
  dealId: number
  ref: string
  amountToman: number
}

/** The signed material, in a fixed order so both sides hash the same string. */
const canonical = (facts: CheckoutFacts) =>
  [facts.leadId, facts.dealId, facts.ref, facts.amountToman].join('|')

export function signCheckout(facts: CheckoutFacts, secret: string): string {
  return createHmac('sha256', secret).update(canonical(facts)).digest('hex')
}

/**
 * Constant-time comparison. A different-length token is rejected before
 * `timingSafeEqual`, which throws on mismatched buffers.
 */
export function verifyCheckout(facts: CheckoutFacts, token: string, secret: string): boolean {
  if (!secret || !token) return false
  const expected = Buffer.from(signCheckout(facts, secret))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
