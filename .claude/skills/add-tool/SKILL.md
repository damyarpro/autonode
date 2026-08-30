---
name: add-tool
description: Add, edit or remove an entry in the external tool directory or the in-app AI tool grid on the Tools tab. Use whenever the user wants a new service listed, a description or category changed, or a tool removed.
---

# Add a tool

Everything on the Tools tab comes from `src/data/tools.ts`. **Edit that file and
nothing else** — no component hard-codes a tool.

## External tool

Append to `externalTools`:

```ts
{
  name: 'ServiceName',                      // shown as-is, not translated
  description: { fa: '…', en: '…' },        // one short line, both languages
  category: 'design',                       // one of TOOL_CATEGORIES
  icon: 'PenTool',                          // must exist in src/components/Icon.tsx
  color: '#8b5cf6',                         // the brand tile colour
  url: 'https://…',                         // real, working link
}
```

Rules:

- `icon` must be a key of the `ICONS` registry in `src/components/Icon.tsx`. If
  the icon you want is not there, add the named import to that registry too —
  never `import * as icons`, which defeats tree-shaking.
- Keep `description` to one line; the card truncates.
- A new category means adding it to `TOOL_CATEGORIES` **and**
  `CATEGORY_LABEL`; the filter row renders from those two.

## In-app AI tool

Append to `aiTools`. Set `to` only when the destination route actually exists.
A tool without `to` renders a `<SoonBadge />` and is not clickable — that is
deliberate, and better than a dead link.

## After editing

```bash
npm run build
```

Then open `#/tools` and confirm the card renders, the category filter includes
it, and the search matches its name and both descriptions.
