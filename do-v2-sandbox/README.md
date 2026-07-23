# do-v2 sandbox

Three working prototype variants of the next windedvertigo.com/do
("families of services" instead of grid-of-assets), built for side-by-side
evaluation on public URLs. **This is a throwaway sandbox — production
(`wv-site`, `site/`) is untouched, and the worker has no routes on
windedvertigo.com.**

Spec: `docs/prompts/do-v2-sandbox-prompt.md` · design plan: `docs/do-v2/`.

## layout

- `data.mjs` — the copy lock: 7 families, 31 hooks, 5 profiles, proof strips,
  axis labels. **Single source of truth**; hooks verbatim from
  `docs/do-v2/profiles-problems-proof.md`.
- `build.mjs` — renders `public/{index,a,b,c}/index.html` + `public/shared/data.js`
  from `data.mjs`. Plain template literals, no framework. Run: `npm run build`.
- `public/shared/base.css` / `spine.js` — hand-authored shared layer
  (brand tokens, unfold accordion, plain-version toggle, hook spotlight,
  FLIP reorder, scoring).
- `public/` — the deployable static site (generated HTML is committed so the
  worker deploys without a build step if needed).

## the variants

- `/a` — **the quiet index.** Static-first hook list with a travelling
  spotlight; seven family rows unfold in place. The control condition.
- `/b` — **faders over filters.** `/a` plus the desk: 5 profile presets +
  3 discrete 3-position switches (native range inputs, detented). Re-sort is
  an honest FLIP animation — no fake "matching…" delay. State lives in the
  URL (`?p=p1&a1=0…`).
- `/c` — **what brings you here?** Three-beat scripted entry (profile → hook
  → the page folds itself), skippable at every beat, focus-managed.

Every page: full content server-rendered in the HTML, `noindex`,
`?plain=1` + a visible plain-version toggle, reduced-motion safe,
keyboard operable.

## deploy

```
cd do-v2-sandbox && npm run deploy
```

Requires `CLOUDFLARE_API_TOKEN` (same account as the other workers). Deploys
to `https://wv-do-v2.<account-subdomain>.workers.dev`. To tear down:
`npx wrangler delete`.

## deliberate deviations from the design plan

Recorded from the phase-0 critique (accepted 2026-07-23): discrete detents
instead of continuous faders; no artificial matching delay; static-first hook
list instead of a one-line-at-a-time ticker; sandbox is noindexed and only
publicly-cleared proof artifacts are linked (PPCS dashboard, values.auction,
crease.works — the rest are marked "pending public-link clearance"); wink
lines are unfilled slots awaiting team copy.
