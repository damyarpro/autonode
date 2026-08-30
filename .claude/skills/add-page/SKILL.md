---
name: add-page
description: Add a new screen or tab to the app, following the shell, RTL and bilingual conventions. Use when creating any new route under src/pages.
---

# Add a page

## Shape

```tsx
export default function MyPage() {
  const { t, num } = useI18n()
  return (
    <AppShell>            {/* flush when the page owns its own scrolling */}
      <PageBanner icon="Wrench" title={COPY.title} subtitle={COPY.subtitle} />
      …
    </AppShell>
  )
}
```

- `AppShell` supplies the fixed bottom tab bar and the safe-area padding. Use
  `flush` for pages that scroll internally — the coach chat and the canvas.
- Build from `Card`, `CardHead`, `Row`, `PrimaryButton`, `ProgressBar`,
  `SoonBadge` in `src/components/Card.tsx` and `Icon`/`IconTile` in
  `src/components/Icon.tsx`. Do not invent new chrome.
- Register the route in `src/App.tsx`. Add it to `TABS` in
  `src/components/TabBar.tsx` only if it is one of the five tabs.

## Copy and numbers

Put a `COPY` object at the top of the file with `{ fa, en }` for every string,
and render through `t()`. Numbers go through `num()` (formatted) or `n()`
(digits only) so Persian digits stay consistent. A page with a bare Persian
string literal in JSX is not finished.

## RTL

Logical properties only: `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`,
`text-start`/`text-end`. A drawer or side panel belongs **in flow** next to the
content, not `fixed` over it — a fixed panel with `start-0` lands on the wrong
side in RTL and covers the header.

## Data

If the page needs server data, add the fetch to `src/api/` as a hook and have
the page consume it. No component calls `fetch` directly. The hook must degrade:
set an `online` flag and render an empty state rather than throwing when `/api`
is unreachable.

## Verify

`npm run build`, then screenshot the page at 412×915 and read it — in both
languages if it has meaningful copy.
