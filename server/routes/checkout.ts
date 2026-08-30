import type { FastifyInstance } from 'fastify'
import { startCheckout } from '../service.ts'

const escape = (value: string) => value.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`)

export default async function checkout(app: FastifyInstance) {
  app.post('/api/checkout/:leadId', async (request, reply) => {
    const leadId = Number((request.params as { leadId: string }).leadId)
    const { amountToman } = (request.body ?? {}) as { amountToman?: number }
    const result = await startCheckout(leadId, amountToman ? Number(amountToman) : undefined)
    if (!result) return reply.code(404).send({ error: 'not found' })
    return result
  })

  /** The mock gateway's page. Its button posts to our own payment webhook. */
  app.get('/api/checkout/page', async (request, reply) => {
    const query = request.query as Record<string, string>
    const payload = {
      leadId: Number(query.lead),
      dealId: Number(query.deal),
      ref: query.ref ?? '',
      amountToman: Number(query.amount),
    }
    reply.type('text/html').send(`<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Checkout (mock)</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07070c;color:#fff;
       font:14px/1.6 system-ui,sans-serif}
  .card{width:min(420px,90vw);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:28px;
        background:linear-gradient(160deg,#181822,#0b0b11)}
  h1{margin:0 0 4px;font-size:17px}
  p{margin:0;color:rgba(255,255,255,.45);font-size:12px}
  .amount{margin:20px 0;font-size:26px;font-weight:600}
  button{width:100%;padding:12px;border:0;border-radius:10px;background:#34d399;color:#052e22;
         font-weight:600;font-size:14px;cursor:pointer}
  .done{margin-top:14px;color:#34d399;font-size:12px}
  .note{margin-top:18px;color:rgba(255,255,255,.3);font-size:11px}
</style>
<div class="card">
  <h1>Mock checkout</h1>
  <p>ref ${escape(payload.ref)}</p>
  <div class="amount">${payload.amountToman.toLocaleString('en-US')} <span style="font-size:13px;opacity:.5">Toman</span></div>
  <button id="pay">Confirm payment</button>
  <div class="done" id="done" hidden>Payment recorded. You can close this tab.</div>
  <div class="note">No gateway is involved and no money moves. This page only posts a
  confirmation back to this server so the funnel can close.</div>
</div>
<script>
  const payload = ${JSON.stringify(payload)};
  document.getElementById('pay').addEventListener('click', async (event) => {
    event.target.disabled = true;
    const response = await fetch('/api/webhooks/payment', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    document.getElementById('done').hidden = false;
    document.getElementById('done').textContent = response.ok
      ? 'Payment recorded. You can close this tab.'
      : 'Already recorded.';
  });
</script>`)
  })
}
