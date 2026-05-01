# evergreen — harbour-apps

> this file holds winded.vertigo facts and standards that don't drift when Claude Code ships new features.
> if a line here would become redundant with a future Claude capability, it belongs in `CLAUDE.md` instead.
>
> audit quarterly. demote stale items to `.claude/archive/`.

---

## writing & brand (team-wide)

- **all copy is lowercase** — except professional identities, corporate names, and acronyms (API, AI, CMS, PRME, URL).
- **british english spelling**: "colour", "organisation", "programme" (except computer programs). use "s" not "z" (organise, recognise).
- **oxford comma**: always.
- **date format**: day/month/year (03 january 2025). never month/day/year.
- **time format**: 12-hour with punctuation (5:30 p.m.).
- **brand name**: always "winded.vertigo" with lowercase and period. never "Winded Vertigo" or "WindedVertigo". code uses "wv" prefix.
- **file naming**: kebab-case everywhere.

## brand palette

source of truth: `packages/tokens/`. never hardcode hex values in code.

| token | hex | role |
|---|---|---|
| `--wv-cadet` | #273248 | primary dark / backgrounds |
| `--wv-redwood` | #b15043 | accent / CTA |
| `--wv-sienna` | #cb7858 | secondary accent |
| `--wv-champagne` | #ffebd2 | on-dark text / highlights only (never a background) |

**champagne is a font colour, not a fill.** use white for tile/card backgrounds.

---

## IP & licensing

- **PRME framework content is CC BY 4.0**: depth.chart `/harbour/skills` page must always be free and publicly accessible. revenue comes from tooling layers (assessment generator, exports).
- **always include attribution** to PRME and LEGO Foundation on any page displaying framework content.
- **tools and software are winded.vertigo IP** — separate from the open-licensed "Works."

---

## accessibility non-negotiables

these map to WCAG AAA and broader design principles — they won't drift with tool updates.

- **`prefers-reduced-motion`**: kill all animation (including pulses, transitions, marquees).
- **`:focus-visible`**: 3px blue (#3B82F6) outline, 2px offset, on every interactive element.
- **contrast**: test every combination to WCAG AAA (7:1 for body text).
  - accent-on-dark uses `--color-accent-on-dark` (#e09878) at 5.5:1 AA minimum.
- **typography**: 16px base, line-height 1.6, letter-spacing 0.02em, max-width 70ch for reading.
- **form accessibility**: every input has `aria-label` or a `<label>`. errors linked via `aria-describedby`.
- **skip-to-content** link on every page.
- **ARIA landmarks**: labelled navs (`aria-label="main navigation"`), mains, asides.
- **`prefers-contrast: more`**: bumps body text to pure black.
- **automated audit**: `npm run test:a11y` (axe-core). run before shipping any visual change.

---

## external API facts (won't change with Claude updates)

these are facts about third-party services, not about our tools.

- **Notion API rate limit: 3 requests/second**. monitor as more projects sync.
- **Notion multi-databases**: use `notion.search()`, not `databases.query()` (doesn't work with multi-databases).
- **Neon connection limit**: 100 concurrent. always use `POSTGRES_URL` (pooled) for app code; `POSTGRES_URL_NON_POOLING` only for migrations.
- **Neon serverless driver**: one SQL statement per HTTP call. multi-statement SQL files must be split.
- **Stripe test mode keys** (`sk_test_*`) are safe for development. never deploy to production.

---

## system coupling (evergreen until we refactor)

- **shared auth cookies**: creaseworks and vertigo-vault share session cookies on `.windedvertigo.com`. changes to `AUTH_SECRET` in one break sessions in the other. change both together.
- **Notion is editorial CMS; Neon Postgres is system of record** for users, organisations, entitlements. content flows one direction: Notion → Postgres cache → app.

---

## team glossary (external-facing terms)

- **winded.vertigo / w.v** — the collective / company name
- **the collective** — the full team (garrett, maria, payton, lamis, james, jamie…)
- **PRME** — Principles for Responsible Management Education (UN Global Compact)
- **PPCS** — PRME Pedagogy Certificate System
- **whirlpool** — monthly community learning event (public-facing)
- **fruitstand** — internal team meeting
- **campfire** — studio discussion format
- **the harbour** — our collection of public apps at `windedvertigo.com/harbour/*`
- **the port** — our internal ops hub at `port.windedvertigo.com`

---

*last audited: 2026-04-17. if a claim here stops being true, edit or demote it — don't leave it rotting.*
