---
name: shoot
description: Drive the running app in a headless browser and capture screenshots of its screens. Use when asked to look at the app, show what a change looks like, or confirm a page renders.
---

# Screenshot the app

Chromium is at `/opt/pw-browsers/chromium`; Playwright is installed globally at
`/opt/node22/lib/node_modules/playwright`. Do not run `playwright install`.

```js
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('ERROR', String(e)))
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()))

await page.goto('http://127.0.0.1:5173/#/tools', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1400)
await page.screenshot({ path: 'out/tools.png' })
await browser.close()
```

## Two traps

- **Never `waitUntil: 'networkidle'`.** The board holds an SSE connection open,
  so it never fires and `goto` times out after 30s.
- **To simulate a dead API, match on the pathname**, not `**/api/**`:

  ```js
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => route.abort())
  ```

  The glob also blocks Vite's `/src/api/*` module requests and the page renders
  blank, which looks like an app bug and is not.

## Viewports

412×915 for the five tabs (they are mobile-first), 1440×900 for the sales board
and the leads and inbox pages.

Write screenshots to the session scratchpad, not the repo. Always read the
images back and say what you actually see, including anything that looks wrong.
