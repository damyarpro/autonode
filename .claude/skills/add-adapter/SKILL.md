---
name: add-adapter
description: Wire a new external service into the backend — a messaging channel, an AI provider, a payment gateway, a voice or video service. Use whenever integrating anything that needs credentials or talks to a third party.
---

# Add an adapter

Every external service sits behind an interface with a real implementation and a
fallback. **The app must boot and run its whole funnel with an empty `.env`.**

## Steps

1. **Interface** — add or extend it in `server/adapters/types.ts`. Keep it
   narrow: the smallest set of methods the funnel actually calls.

2. **Fallback first** — write the no-credential implementation before the real
   one (`channels/store-only.ts` and `ai/template.ts` are the models). It must
   do something honest and useful: record the message with a `simulated` status,
   return deterministic copy. Never throw and never no-op silently.

3. **Real implementation** — a file under the matching `server/adapters/`
   subdirectory. Read credentials from `server/env.ts`, never
   `process.env` directly. **Wrap every outbound call in try/catch and fall back
   rather than dropping the work on the floor.**

4. **Registry** — select between them in `server/adapters/registry.ts` using a
   `hasX()` helper from `env.ts`. Add the service to `adapterStatus()` so
   `GET /api/health` reports which half is live.

5. **Environment** — add the variables to `.env.example` with a comment saying
   where to get them and what happens without them. Never commit a real value.

6. **Docs** — update the "What is actually real" table in `README.md` and in
   `CLAUDE.md`. Both must stay honest.

7. **Verify** — `npm run build`, `npm test`, `npm run e2e`, and
   `curl localhost:8787/api/health` to see the adapter reported.

## Webhooks

An inbound webhook needs protection. Follow the existing two shapes: a secret
path segment (Telegram) or an HMAC signature over the raw body
(`POST /api/webhooks/:channel`). Make it idempotent — the `(source, external_id)`
unique index and the `payments.provider_ref` check exist because senders retry.
