---
name: port-health
description: >
  Shortcut for running /health on the port project specifically. Equivalent to
  invoking /health with port.windedvertigo.com as the target. Prefer /health for
  all new usage — it works across all WV projects. This skill exists for muscle
  memory / backward compatibility.
---

# Port health (shortcut)

This is a convenience alias. Run the `/health` skill with the port project as context:

> "Run `/health` — project is **port**, live URL is `https://port.windedvertigo.com`"

## What it runs

| Stage | Script |
|-------|--------|
| TypeScript | `cd port && npx tsc --noEmit` |
| Smoke (26 routes) | `node port/scripts/smoke-test.mjs` |
| Security headers | `node port/scripts/security-audit.mjs` |
| Supabase health | `cd port && node scripts/smoke-supabase.mjs` |
| Load stages 1–5 | `npx autocannon` against `https://port.windedvertigo.com` |

See `/health` for the full protocol and reporting format.
