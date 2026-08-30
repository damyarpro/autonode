# monitiezai — Sales Automation demo canvas

An interactive, bilingual (فارسی / English) node-graph dashboard that lays out a
whole revenue funnel on one pan-and-zoom canvas: content production → channel
distribution → unified lead capture → score-based routing → AI follow-up and
sales calls → payment → a growth loop that feeds the ad budget back into the
top of the funnel.

> **This is a demo.** Every number and connection is illustrative. Nothing here
> talks to a real content tool, CRM, messaging platform or payment gateway.

## Running it

```bash
npm install
npm run dev     # http://127.0.0.1:5173/#/sales-automation
npm run build   # type-check + production bundle
```

## How it is put together

| Path | Role |
| --- | --- |
| `src/data/pipeline.ts` | **Single source of truth** — KPIs, nodes, edges and layout coordinates, each string carrying both `en` and `fa`. Reshape the graph here. |
| `src/components/nodes/StageNode.tsx` | The one card component behind every box; variants cover the green payment nodes and the wide content-factory card. |
| `src/components/nodes/LoopbackEdge.tsx` | Dashed reinvestment edges that run along a shared rail above the layout. |
| `src/components/PipelineCanvas.tsx` | React Flow wiring: node/edge mapping, RTL mirroring, initial viewport. |
| `src/components/KpiBar.tsx` | Header metrics with a locale-aware count-up. |
| `src/i18n/I18nProvider.tsx` | Locale state, `dir` switching, Persian digit formatting. |

### RTL

React Flow positions nodes by CSS transform, so the canvas itself always stays
`dir="ltr"`. For Persian the layout is mirrored instead (`x → layoutWidth - x -
width`) and each card's own text direction flips, which makes the funnel read
right-to-left without fighting the viewport maths.

Built with Vite, React, TypeScript, Tailwind CSS and `@xyflow/react`.
