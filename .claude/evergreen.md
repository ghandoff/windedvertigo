# evergreen — windedvertigo

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

| token | hex | role |
|---|---|---|
| cadet | #273248 | primary dark / backgrounds |
| redwood | #b15043 | accent / CTA |
| sienna | #cb7858 | secondary accent |
| champagne | #ffebd2 | on-dark text / highlights only (never a background) |

**champagne is a font colour, not a fill.** use white for tile/card backgrounds.

---

## IP & licensing

- **PRME framework content is CC BY 4.0**. any public display of framework content must be free and publicly accessible, with attribution to PRME and LEGO Foundation.
- **tools and software are winded.vertigo IP** — separate from the open-licensed "Works."

---

## accessibility non-negotiables

- **`prefers-reduced-motion`**: kill all animation.
- **`:focus-visible`**: 3px blue (#3B82F6) outline, 2px offset, on every interactive element.
- **contrast**: test every combination to WCAG AAA (7:1 for body text).
- **typography**: 16px base, line-height 1.6, max-width 70ch for reading.
- **form accessibility**: every input has `aria-label` or a `<label>`. errors linked via `aria-describedby`.
- **skip-to-content** link on every page.
- **ARIA landmarks**: labelled navs, mains, asides.

---

## external API facts (stable regardless of our tooling)

- **Notion API rate limit: 3 requests/second**.
- **Notion multi-databases**: use `notion.search()`, not `databases.query()`.
- **Neon connection limit**: 100 concurrent. always use `POSTGRES_URL` (pooled) for app code.
- **Neon serverless driver**: one SQL statement per HTTP call.

---

## repo purposes (the sub-apps that live here)

| path | purpose |
|---|---|
| `site/` | the public marketing site at `windedvertigo.com` (Next.js 16 app router) |
| `port/` | the internal ops hub at `port.windedvertigo.com` (Next.js 16, Auth.js + Google OAuth) |
| `ancestry/` | the genealogy app with its own Neon Postgres (family-tree schema) |

**the docent lives at `port/app/docent/`** — the interactive setup tour for new team members. gated behind port's Google auth.

---

## team glossary

- **winded.vertigo / w.v** — the collective / company name
- **the collective** — the full team
- **PRME** — Principles for Responsible Management Education (UN Global Compact)
- **whirlpool** — monthly community learning event (public-facing)
- **fruitstand** — internal team meeting
- **the harbour** — the metaphor we use for the whole product suite
- **the port** — our internal ops hub (`port.windedvertigo.com`)

---

*last audited: 2026-04-17. if a claim here stops being true, edit or demote it — don't leave it rotting.*
