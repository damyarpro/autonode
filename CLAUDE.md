# Autonode (موج ابزار) — project rules

Persian-first mobile web app with a real backend. Five tabs plus a
live sales-automation board. Read this before changing anything.

## Commands

```bash
npm run dev        # API on :8787 and the app on :5173, together
npm run dev:api    # API alone
npm run dev:web    # Vite alone
npm run build      # typecheck (app + server) and production bundle
npm run typecheck  # tsc -b across all three tsconfig projects
npm test           # node --test over server/**/*.test.ts (domain + HTTP routes)
npm run e2e        # one lead, capture to reinvested budget, on a throwaway DB
npm run seed -- --fresh   # rebuild the sample database
npm start          # production: one process, API + built app on one origin
```

**Never report work as done without `npm run build`, `npm test` and, when the
funnel or the API changed, `npm run e2e`.** All three must be green.

## Architecture

```
server/
  domain/     pure functions, no I/O — scoring, routing, sequences, levels,
              pipeline-view. This is where the logic lives and where tests go.
  db/         schema.sql + queries.ts. Every SQL statement in the project is in
              queries.ts or routes/app.ts; nothing else touches the database.
  adapters/   one interface per external service in types.ts, a real
              implementation and a working fallback, chosen by registry.ts.
              media/ holds the voice and video pair, voice/ the dialler.
  tools/      the AI tool runner and its offline templates.
  content/    the content factory: produce, schedule, publish when due.
  calls/      briefs, slots, bookings, reminders and the referral ask.
  media/      voice-over and ad-video jobs, persisted and never throwing.
  jobs/       the worker pass: due nurture steps, due content, due call work.
  routes/     thin HTTP layer. Validate input, call service/queries, return.
  auth.ts     opt-in authentication; a no-op with no password configured.
  service.ts  orchestration: capture → score → route → nurture → sale → loop.
shared/
  aiToolSpecs.ts   the AI tool contract, imported by both halves.
  business.ts      the business profile both halves read and write.
  boardGraph.ts    a board's whole graph, stored as one snapshot per version.
src/
  data/       brand.ts · tools.ts · levels.ts · pipeline.ts · nodeGuide.ts ·
              nodeKinds.ts — every list, label and node explanation. The board
              palette is derived from tools.ts, never restated.
  components/board/  the editable canvas: palette, context menu, undo/redo.
  components/ AppShell · TabBar · SideRail · PageBanner · Card · Icon — shared
              chrome. The tab list is in data/nav.ts: the bar and the rail are
              two renderings of one list.
  api/        fetch client and hooks. No component calls fetch directly.
  i18n/       t()/n() plus errors.ts, which turns the server's field:code
              answers into sentences.
  pages/      one file per route.
docs/screenshots/  what the README shows; regenerate with the `shoot` skill.
```

`.claude/skills/` holds five project skills — `verify`, `add-tool`,
`add-adapter`, `add-page`, `shoot`. Reach for the matching one instead of
rediscovering the conventions. `.github/workflows/ci.yml` runs typecheck, build,
tests and the e2e script on every push; `pages.yml` publishes the built app to
GitHub Pages on `main`.

**Deployment is single-origin.** With `SERVE_STATIC=true` the API also serves
`dist/`, so the session cookie is sent with every request and no CORS is
involved. Keep it that way: a split deployment breaks cookie auth. The
`Dockerfile` builds that one process; `/data` is the only writable path.

## Rules that must hold

1. **One source of truth per list.** Tools, levels, pipeline nodes, their copy
   and each node's explanation live in `src/data/*.ts`. Never hard-code a tool
   name, a level title, a node label or what a node does in a component. Adding
   a tool means editing `tools.ts` and nothing else. The product name is in `src/data/brand.ts`; copy that mentions
   it writes `{brand}` and passes through `withBrand()`.

2. **Every user-visible string is bilingual.** Type `Bi = { fa: string; en: string }`.
   Render through `useI18n().t()`. A string that only exists in one language is
   a bug. Numbers go through `n()` / `num()` so Persian digits stay consistent.

3. **Responsive, and RTL is the default — not afterthoughts.** `lg` (1024px)
   is the one phone/desktop switch: below it the bottom tab bar, above it the
   side rail, with `--tabbar` collapsing to zero so a full-height page really
   is. Write the phone layout as the base and add `md:`/`lg:` on top; a page
   that got worse at 390px is a failed change however good it looks at 1512px.
   Nothing may scroll horizontally down to 320px. Use logical properties —
   `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`/`text-end`.
   Never `ml-*`, `left-*` or `text-left` for layout that should mirror — a
   two-column desktop layout that hard-codes sides is mirrored wrong in
   Persian, which is this app's default language. The one exception is the
   React Flow canvas, which stays `dir="ltr"` and mirrors its node coordinates
   instead, because it positions by CSS transform.

4. **External services go behind an adapter.** Add the interface to
   `server/adapters/types.ts`, a real implementation, and a fallback that keeps
   the app working with no credentials. `registry.ts` picks between them.
   **The app must boot and run its whole funnel with an empty `.env`.**

5. **Never fake a feature.** A card whose destination is not built carries the
   `<SoonBadge />` and is not clickable. A number that is not measured is a
   fallback in `src/data/*.ts`, never invented at render time. Payments are a
   local mock and say so; no real gateway without the owner asking for one.

6. **Derived state is derived.** Lead scores come from `lead_events`, progress
   percentages from `level_progress`. Never store a value the log can produce.

7. **Logic in `domain/`, tested.** If a change adds a rule (a threshold, a
   weight, a schedule), it belongs in `server/domain/` as a pure function with a
   `.test.ts` beside it. Routes and components stay thin. A new route also earns
   a case in `server/routes/routes.test.ts`, which drives the real server with
   `app.inject()` on a throwaway database — set `DB_FILE` before importing
   anything from `server/`, since `env.ts` reads the environment once.

8. **The board survives a dead API.** `src/data/pipeline.ts` carries a fallback
   for every slot, and `useLivePipeline` degrades to it. Do not add a page that
   throws or blanks when `/api` is unreachable.

9. **Secrets never enter the repo.** `.env` and `data/` are gitignored. Only
   `.env.example` is committed. No token in a commit message, a comment or a
   test fixture.

10. **A contract shared by both halves lives in `shared/`.** `aiToolSpecs.ts` is
    imported by the server that runs the tools and the page that renders them.
    Never copy a shape across the boundary — change the contract and let both
    sides follow. Adding a tool there needs no code on either side.

11. **The server does not author user-facing prose.** It cannot satisfy rule 2,
    so validation failures come back as machine-readable `field:code` strings
    (`skills:required`, `business:too_long:600`) and the client — which drew the
    form from the same spec — turns them into sentences. Every code passes
    through `explainCode` in `src/i18n/errors.ts`; if you add one, add its rule
    or its field label there in the same commit.

## Conventions

- TypeScript everywhere, `strict`. Server imports carry the `.ts` extension.
- No default exports from `data/` or `domain/`; named exports only.
- Comments explain **why**, not what. If a line needs a "what" comment, rename
  it instead.
- Tailwind for styling; the palette lives in `tailwind.config.js`
  (`canvas`, `panel`, `card`, `hairline`, `accent`, `success`). Do not
  introduce raw hex colours in components except for a tool's brand tile.
- Animations are opt-out: everything decorative sits behind
  `@media (prefers-reduced-motion: reduce)`.
- New dependencies need a reason. `node:sqlite` and `node --test` were chosen
  over `better-sqlite3` and a test framework specifically to avoid them.

## What is real and what is not

| Piece | State |
| --- | --- |
| Capture, scoring, routing, nurture, CRM stages, growth loop | real |
| Profile, level progress, coach history | real, in the database |
| Business profile | real, at `#/business` — every generated word reads it |
| Content factory | real, at `#/content` — writes, schedules, publishes when due |
| Meetings, reminders, referral ask | real, at `#/calls` — slots, bookings, one ask per customer |
| Call brief | real — the dialling is what needs `VAPI_API_KEY` |
| Publishing destinations | real, per channel on the business profile; a channel without one cannot publish |
| Boards the owner builds | real, at `#/boards` — right-click palette, connect, group, undo, save |
| Board history | real — every save is a version; a restore adds one rather than rewinding |
| A public board | real — readable with no session; a private one answers exactly as a missing one |
| Telegram | real delivery with `TELEGRAM_BOT_TOKEN` |
| Website out | real with `WEBSITE_PUBLISH_URL` — a signed POST to your own endpoint |
| LinkedIn out | real with `LINKEDIN_ACCESS_TOKEN`; needs approved API access (never run live from here) |
| Instagram out | real with `INSTAGRAM_ACCESS_TOKEN`; needs App Review, and refuses text with no media (never run live) |
| YouTube out | real with a refresh token; needs a Google audit, and refuses a script with no video (never run live) |
| Inbound on all five | real — signed webhook, or Telegram's secret path |
| Call outcome | real — `POST /api/webhooks/vapi/:secret` records what happened (never run live) |
| Coach and outreach copy | Claude with `ANTHROPIC_API_KEY`, templates otherwise |
| Voice-over | timed, speakable script; real audio with `ELEVENLABS_API_KEY` (never run live from here) |
| Ad video | shot-by-shot storyboard; real render with `HIGGSFIELD_API_KEY` (never run live from here) |
| Checkout | local mock — no gateway, no money |
| Authentication | real, **opt-in** — off unless `APP_PASSWORD` or `APP_PASSWORD_HASH` is set |
| The seven AI tools | real, at `#/tools/:id` — structured output from Claude, templates otherwise |
| Sign-out | real, when a password is configured — there is no session to end otherwise |
| The two courses, subscription management, privacy settings | not built; `<SoonBadge />` |

Keep this table honest. If you build one of these, move the row and update the
README in the same commit.

## Security

Authentication is **opt-in**: with no `APP_PASSWORD` (or `APP_PASSWORD_HASH`)
the guard is a complete no-op and the app behaves as it does on a bare
checkout. Set one before exposing anything. `registerAuth(app)` is called
directly in `buildServer()`, **not** through `app.register` — a plugin body
would encapsulate the `preHandler` in a child context and every route would
answer unguarded.

Sessions are in memory, so a restart signs everyone out, and the failed-login
lockout is per process. `server/auth.ts` reads its variables from
`process.env` at call time rather than from `env.ts`, deliberately, so tests
can toggle them.

The Telegram webhook is protected by a secret path segment; the generic
`POST /api/webhooks/:channel` requires an HMAC signature when
`WEBHOOK_SIGNING_SECRET` is set. `POST /api/webhooks/payment` accepts only a
confirmation carrying the token `startCheckout` signed, and re-reads the deal
row so a valid token cannot confirm a different amount — the signing key is
random per boot when `CHECKOUT_SIGNING_SECRET` is unset, so this holds on an
empty `.env`.

## Working with Claude

- `claude-opus-5` is the model id; adaptive thinking, structured output via
  `messages.parse()` with `zodOutputFormat`. The stable system prompt is cached
  with `cache_control`.
- Every Claude call has a deterministic fallback and must not throw on failure —
  log a warning and fall back.
- A partial model answer is discarded whole rather than blended with the
  fallback, so the `producedBy` flag the UI shows stays truthful.
- The tool runner builds its zod schema from `spec.sections`, so a tool added to
  `shared/aiToolSpecs.ts` works without touching the adapter.
