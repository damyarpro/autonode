---
name: verify
description: Run the project's full verification loop — typecheck, build, domain tests, the end-to-end funnel script, and a browser pass over all five tabs — and report exactly what passed and what did not. Use before claiming any change is done, before committing, and whenever asked to check that the app still works.
---

# Verify

Run these in order. **Stop at the first red step and fix it before continuing** —
a later green step does not excuse an earlier red one.

## 1. Types and bundle

```bash
npm run typecheck
npm run build
```

`typecheck` covers three projects (`tsconfig.app`, `tsconfig.node`,
`tsconfig.server`). A server-only type error will not show up in `npm run dev`,
which is why this step is not optional.

## 2. Domain tests

```bash
npm test
```

Pure-function tests over `server/domain/`. If a change added a rule — a
threshold, a weight, a schedule — and no test moved, the change is not covered.
Add the test rather than reporting a pass.

## 3. End-to-end funnel

```bash
npm run e2e
```

Drives one lead from capture to a reinvested payment against a real server on a
throwaway database. Required whenever `server/service.ts`, `server/routes/`,
`server/db/` or an adapter changed.

## 4. Browser pass

Only when the UI changed. Start the app, then drive it:

```bash
npm run dev   # background; wait for both :8787 and :5173 to answer
```

Use Chromium at `/opt/pw-browsers/chromium` through the globally installed
Playwright. Two things matter:

- **`waitUntil: 'domcontentloaded'`, never `'networkidle'`.** The board holds an
  open SSE connection, so `networkidle` never fires and the call times out.
- **Route-blocking `/api` for the offline check must match on the pathname**,
  not the glob `**/api/**` — that glob also blocks Vite's own `/src/api/*`
  module requests and the page renders blank.

Check, at a 412×915 viewport:

1. All five tabs render and the tab bar shows five items.
2. `POST /api/leads` while the board is open raises the Lead Inbox badge with no
   reload.
3. With `/api` blocked, the board still renders 22 nodes from the fallbacks and
   the header chip reads "داده‌ی نمونه".
4. The console has no errors.

## Reporting

Say which steps ran and their real result. If a step was skipped, say it was
skipped and why. Never write "all tests pass" for a run that did not happen.
