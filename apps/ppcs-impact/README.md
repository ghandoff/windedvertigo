# ppcs-impact — PPCS 2026 Engagement Dashboard

Live: **https://windedvertigo.com/portfolio/ppcs-2026-impact/**
Cloudflare Worker `wv-ppcs-impact` — D1 metrics API + static front-end.

## The one rule: this repo is the single source of truth

**Never hand-deploy from a laptop copy.** A stale local copy will silently revert
the live styling (it happened 2026-06-17). Instead:

```
edit → commit → push to main → CI deploys automatically
```

`.github/workflows/deploy-ppcs-impact.yml` deploys on every push to `main` that
touches `apps/ppcs-impact/**`. Merged = live, for every device and teammate.

## Two kinds of change

| You want to change… | Do this | Redeploy needed? |
|---|---|---|
| **Numbers** (the metrics) | Update the D1 `metrics` row (`k='current'`) | **No** — the page fetches D1 live. Decoupled from styling, so it can't revert the look. |
| **Styling / layout / copy** | Edit `assets/` (+ `src/` for worker logic), commit, push | Yes — CI handles it. |

Updating numbers via an asset redeploy is what causes style drift. Keep them separate.

## Layout

- `src/index.js` — worker (route base, `/api/metrics` from D1, static assets via `env.ASSETS`)
- `assets/` — front-end (`index.html`, icons, mosaic art, logo)
- `wrangler.jsonc` — D1 id + bindings + routes
- `deploy.command` — manual deploy escape hatch (only if CI is down; runs `wrangler login` + `deploy`)
- `backup-2026-06-16/` — full restorable snapshot + `RESTORE.md` rollback runbook

## First-time setup (one-off)

CI needs the repo secret `CLOUDFLARE_API_TOKEN` (shared across the monorepo's deploy
workflows). If deploys fail at auth, the token needs rotating — see the header of
`.github/workflows/deploy-ppcs-impact.yml`.
