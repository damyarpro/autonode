# monitiezai — sales automation

A working sales pipeline behind a live node-graph dashboard. A lead arrives,
gets scored from its own event history, is routed hot / warm / cold, walks a
nurture sequence, books a meeting, checks out, pays — and a slice of that
payment is allocated back to the channel that produced it. The canvas shows all
of it as it happens.

<!-- Run `npm run dev` and open http://127.0.0.1:5173/#/sales-automation -->

## Quick start

```bash
npm install
npm run seed -- --fresh   # optional: a month of sample leads to look at
npm run dev               # API on :8787, dashboard on :5173
```

Then open <http://127.0.0.1:5173/#/sales-automation>.

**No credentials are required.** With an empty environment the whole funnel
runs: channels record their outbound messages instead of delivering them, copy
comes from templates instead of a model, and checkout is a local page that moves
no money. `GET /api/health` always reports which half is real.

## What is actually real

| Piece | State |
| --- | --- |
| Lead capture, scoring, routing, nurture sequences, CRM stages | real, runs locally |
| Telegram | **real delivery** with `TELEGRAM_BOT_TOKEN` — send and receive |
| Instagram / LinkedIn / YouTube / Website | signed webhook in, messages recorded not delivered (these need a business account and platform review) |
| Outreach copy and next-best-action | templates by default; Claude with `ANTHROPIC_API_KEY` |
| Checkout and payments | local mock — **no gateway, no money** |
| ElevenLabs / Higgsfield / Vapi | not wired; the canvas counts content rows the seed creates |

Copy `.env.example` to `.env` to turn any of these on. `.env` is gitignored;
never commit a token.

## Turning Telegram on

1. Create a bot with [@BotFather](https://t.me/botfather) and copy the token.
2. Put `TELEGRAM_BOT_TOKEN` and a fixed `TELEGRAM_WEBHOOK_SECRET` in `.env`
   (`node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`).
3. Expose the API on a public URL and set `PUBLIC_URL` to it.
4. `npm run telegram:register`.

Send `/start` to the bot: the lead shows up on `/#/leads`, the first nurture
message really arrives, and replying to it re-scores the lead.

## How it is put together

```
server/
  domain/       pure, tested logic: scoring · routing · sequences · pipeline-view
  db/           node:sqlite schema and every query
  adapters/     one interface per external service, real or fallback
  routes/       capture · leads · pipeline · SSE stream · webhooks · checkout
  service.ts    the orchestration: capture → score → route → nurture → sale → loop
src/
  data/pipeline.ts   layout, copy and the fallback numbers for the canvas
  api/               fetch client and the live metrics + SSE hook
  pages/             board · leads · inbox
```

**Scoring** (`server/domain/scoring.ts`) reads the append-only `lead_events`
table: channel intent sets a floor, each event adds weight, and every
contribution halves after ten days so an old burst never keeps a lead hot.
Nothing is stored ahead of the log, so a score can always be re-derived.

**Routing** (`server/domain/routing.ts`) is `hot ≥ 80`, `warm ≥ 55`, cold below.
The reference board labelled cold as `<45`, which left 45–54 unassigned; the
edge label says `cold <55` so the picture and the code agree.

**Live canvas.** `src/data/pipeline.ts` holds the layout, the bilingual copy and
a fallback number for every slot. `GET /api/pipeline` returns the same slots
keyed `<nodeId>.<slot>`, and `GET /api/stream` pushes each domain event with the
edge it travels along, so a real lead fires a real pulse. With the API down the
board falls back to the seeded numbers and keeps working.

**Adapters.** `server/adapters/registry.ts` picks the real implementation when
credentials exist and a working fallback otherwise, so no code path is
conditional on having a key.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API and dashboard together |
| `npm run dev:api` / `npm run dev:web` | either half on its own |
| `npm test` | domain tests (`node --test`) |
| `npm run e2e` | drives one lead capture → paid → reinvested on a throwaway database |
| `npm run seed -- --fresh` | rebuild the sample database |
| `npm run build` | typecheck and production bundle |

## Before deploying this

The dashboard and the API have **no authentication** — they are built for
`127.0.0.1`. Put an auth layer in front of both before exposing them. The
Telegram webhook is protected by a secret path segment, and the generic
`POST /api/webhooks/:channel` requires an HMAC signature once
`WEBHOOK_SIGNING_SECRET` is set.

Built with Vite, React, TypeScript, Tailwind CSS, `@xyflow/react`, Fastify and
`node:sqlite`.
