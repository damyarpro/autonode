# monitiezai — project rules

Persian-first mobile web app (MonetizeAI) with a real backend. Five tabs plus a
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
  tools/      the AI tool runner and its offline templates.
  routes/     thin HTTP layer. Validate input, call service/queries, return.
  auth.ts     opt-in authentication; a no-op with no password configured.
  service.ts  orchestration: capture → score → route → nurture → sale → loop.
shared/
  aiToolSpecs.ts   the AI tool contract, imported by both halves.
src/
  data/       tools.ts · levels.ts · pipeline.ts — every list and label.
  components/ AppShell · TabBar · PageBanner · Card · Icon — shared chrome.
  api/        fetch client and hooks. No component calls fetch directly.
  pages/      one file per route.
docs/screenshots/  what the README shows; regenerate with the `shoot` skill.
```

`.claude/skills/` holds five project skills — `verify`, `add-tool`,
`add-adapter`, `add-page`, `shoot`. Reach for the matching one instead of
rediscovering the conventions. `.github/workflows/ci.yml` runs typecheck, build,
tests and the e2e script on every push.

## Rules that must hold

1. **One source of truth per list.** Tools, levels, pipeline nodes and their
   copy live in `src/data/*.ts`. Never hard-code a tool name, a level title or a
   node label in a component. Adding a tool means editing `tools.ts` and
   nothing else.

2. **Every user-visible string is bilingual.** Type `Bi = { fa: string; en: string }`.
   Render through `useI18n().t()`. A string that only exists in one language is
   a bug. Numbers go through `n()` / `num()` so Persian digits stay consistent.

3. **RTL is the default, not an afterthought.** Use logical properties —
   `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`/`text-end`.
   Never `ml-*`, `left-*` or `text-left` for layout that should mirror. The one
   exception is the React Flow canvas, which stays `dir="ltr"` and mirrors its
   node coordinates instead, because it positions by CSS transform.

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
    form from the same spec — turns them into sentences. If you add a code,
    add its translation in `explainError` in the same commit.

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
| Telegram | real delivery with `TELEGRAM_BOT_TOKEN` |
| Instagram / LinkedIn / YouTube / Website | signed webhook in; outbound is recorded, not delivered |
| Coach and outreach copy | Claude with `ANTHROPIC_API_KEY`, templates otherwise |
| Checkout | local mock — no gateway, no money |
| Authentication | real, **opt-in** — off unless `APP_PASSWORD` or `APP_PASSWORD_HASH` is set |
| The seven AI tools | real, at `#/tools/:id` — structured output from Claude, templates otherwise |
| The two courses, subscription management, privacy settings, sign-out | not built; `<SoonBadge />` |

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
`WEBHOOK_SIGNING_SECRET` is set. **`POST /api/webhooks/payment` has neither**,
so on a public deployment anyone can claim a mock payment happened — a
pre-existing gap, and the first one to close.

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
