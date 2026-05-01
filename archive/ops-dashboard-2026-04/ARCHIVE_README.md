# ops-dashboard archive (2026-04)

## What this is

A snapshot of the `ops-dashboard/` directory that previously lived at the monorepo root. It was a separate git clone of `ghandoff/wv-ops` containing an early Next.js 14 / React 18 prototype of the ops dashboard with a different visual language than what eventually shipped as `ops/` (windedvertigo's Next.js 16 / React 19 ops command center).

## Why it's archived (not deleted)

Seven unique React components were built here that don't exist in the current `ops/`:

- `DispatchCard.tsx` — scheduled-task status card
- `FinancialMetricCard.tsx` — financial-metric display
- `MeetingCard.tsx` — meeting display
- `ProjectCard.tsx` — project status card
- `SectionHeader.tsx` — section grouping
- `TaskCard.tsx` — task display
- `TeamMemberCard.tsx` — team-member card

Plus `lib/data.ts` (the type definitions those components import from) and 8 markdown docs documenting the original design intent.

These represent real design exploration that may be worth revisiting when ops/ adds new dashboard sections.

## Why these aren't in `ops/components/` directly

The components were written for Next 14 / React 18 against a different `lib/data` shape. They don't compile against ops/'s current dependency graph without rework. Rather than break ops/ at integration time, they're parked here until someone wants to port them — at which point the Next 16 / React 19 type updates and the lib/data interface bridging are both straightforward but intentional work.

## Source

- Cloned from `git@github.com:ghandoff/wv-ops.git`, single commit `90e2484 init: winded.vertigo ops command center`
- Standalone repo archived on GitHub (or pending archive) as part of the monorepo restructure (see `~/.claude/plans/graceful-popping-willow.md` Phase A.1)

## Layout

```
archive/ops-dashboard-2026-04/
├── ARCHIVE_README.md       # this file
├── components/             # 7 .tsx files preserved verbatim
├── lib/                    # data.ts + any other shared lib code
├── docs/                   # original markdown docs (CHECKLIST, DEPLOYMENT, etc.)
├── next.config.mjs         # original Next 14 config (reference)
└── deploy.sh               # original deploy script (reference)
```

## To revive a component

```ts
// 1. Copy the .tsx into ops/components/
// 2. Update imports: { DispatchTask } from "@/lib/data"  →  ops/'s real data type
// 3. Tailwind classes mostly translate as-is; double-check `dark-card`/`dark-text` etc.
// 4. Verify it renders inside an ops/ page; React 19 + Server Components ergonomics may need a `"use client"` directive (already present on the originals).
```
