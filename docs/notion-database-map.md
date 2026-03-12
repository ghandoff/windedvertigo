# notion database map

the winded.vertigo collective currently authors content across **16 notion databases** that feed into three contexts, plus **1 unified CMS** that is progressively replacing page-specific legacy databases.

---

## creaseworks app

synced daily at 06:00 UTC via vercel cron + real-time notion webhooks for incremental updates.

| database | id | what the collective can author | where it appears on site |
|---|---|---|---|
| **playdates** | `b446ffd5-d166-4a31-b4f5-f6a93aadaab8` | title, headline, status, age range, tinkering tier, arc emphasis, context tags, friction dial, IP tier, primary function, release channel | `/sampler`, `/playbook`, `/packs/[slug]`, playdate cards across all views |
| **materials** | `a6b32bc6-e021-41a4-b6f4-3d528e814d71` | form (primary), functions, connector modes, context tags, shareability, do-not-use flag, examples/notes | linked to playdates — shown in playdate detail views and run logging |
| **packs** | `beb34e7b-86cd-4f20-b9be-641431b99e5f` | title, description, status, linked playdates | `/packs`, pack cards, profile "your journey" |
| **collections** | `312e4ee7-4ba4-8139-b891-fcd21e275a21` | title, description, icon emoji, sort order, status, linked playdates with display order | `/playbook` — the main content grid |
| **reflections** | `67215537-b307-49f6-b0db-d6ca7a514c78` | title, playdate link, context of use, date, context tags, trace evidence, what changed, next iteration, linked materials | `/reflections`, profile activity feed |

### sync architecture

the creaseworks sync pipeline lives in `src/lib/sync/` and follows a dependency-ordered flow:

```
notion → materials → playdates → collections → packs → runs → postgres cache
```

each database has a dedicated sync module that extracts notion properties, resolves relations, and upserts into the corresponding `_cache` table in neon postgres. archived or deleted pages are soft-deleted.

key files:

- `src/lib/notion.ts` — client initialisation, rate limiting (350ms), paginated query helper
- `src/lib/sync/index.ts` — orchestrates full sync in dependency order
- `src/lib/sync/incremental.ts` — single-page sync for webhook events
- `src/lib/sync/extract.ts` — property extraction helpers (all values normalised to lowercase)
- `src/lib/sync/playdates.ts` — playdate sync with material relation resolution
- `src/lib/sync/materials.ts` — materials sync
- `src/lib/sync/packs.ts` — packs sync with playdate relation resolution
- `src/lib/sync/collections.ts` — collections sync with playdate display order
- `src/lib/sync/runs.ts` — reflections/runs sync (preserves app-created runs)
- `src/app/api/cron/sync-notion/route.ts` — daily cron endpoint (bearer token auth)
- `src/app/api/webhooks/notion/route.ts` — webhook listener (HMAC-SHA256 verification)

### current gaps

- **images:** the sync does not currently pull notion file/image properties — cover images, inline images, and file attachments are not synced to postgres or rendered on-site
- **rich text:** only plain text is extracted from rich text fields — formatting (bold, italic, links) is stripped during sync
- **page content:** only database properties are synced — notion page body content (blocks) is not fetched

---

## static site (apps/site)

synced manually via `npm run sync` from the monorepo root, and automatically via GitHub Actions daily at 06:00 UTC. content is fetched from notion, transformed into JSON, and used during the site build.

### active databases

| database | id | generates | consumed by |
|---|---|---|---|
| **quadrants** | `1c171d25825b418caf94805dc1568352` | `package-builder-content.json` (merged) | `/do/` page |
| **outcomes** | `b8ff41d2d4ef41559e01c2d952a3a1da` | `package-builder-content.json` (merged) | `/do/` page |
| **portfolio assets** | `5e27b792adbb4a958779900fb59dd631` | `portfolio-assets.json` | `/portfolio/` pages |
| **vertigo vault** | `223e4ee74ba4805f8c92cda6e2b8ba00` | `vertigo-vault.json` + cover images | `/vertigo-vault/` (redirects to `/harbour/vertigo-vault/`) and runtime fetch in vertigo-vault app |
| **site content CMS** | `09a046a556c1455e80073546b8f83297` | `site-content-{page}.json` per page value | `/what/` (live), `/what-v2/` (dev); `/we/` and `/do/` planned |
| **members** | `9d0e6ae1d7574503b611a5c289e44f5b` | member images + HTML fragments | `/we/` (currently hardcoded HTML) |
| **services** | `28fe4ee74ba480869709d4d364d388e5` | services HTML | `/do/` (via standalone sync script) |

### removed databases

| database | id | removed | reason |
|---|---|---|---|
| ~~what page~~ | `311e4ee74ba480268ad9de5a14d6dce4` | Mar 2026 | retired — `/what/` now reads from Site Content CMS via `site-content-what.json`; `what-page.json` is no longer generated |
| ~~what page v2~~ | `312e4ee74ba48102aea3e9f1a8828685` | Mar 2026 | superseded by Site Content CMS — the legacy v2 database was an intermediate step; the CMS now generates `site-content-what.json` which the development `/what-v2/` page consumes |

### CMS migration status

the Site Content CMS (`09a046a5`) was created to consolidate per-page notion databases into a single database with a "Page" select property. migration is incremental:

| page | legacy source | CMS file | migration status |
|---|---|---|---|
| `/what/` | ~~`what-page.json`~~ (retired) | `site-content-what.json` | **partial** — live `/what/` uses hardcoded body with CMS metadata overlay only; full CMS-driven redesign on `feature/what-redesign` branch (waiting on backdrop images) |
| `/we/` | hardcoded HTML + member images | `site-content-we.json` | **planned** — CMS data is generated but page not yet wired |
| `/do/` | `package-builder-content.json` (Quadrants+Outcomes+Examples) | `site-content-do.json` | **planned** — CMS data is generated but page not yet wired |
| `/` (home) | n/a | `site-content-home.json` | **planned** — CMS data is generated |
| `/harbour/` | n/a | `site-content-harbour.json` | **planned** — harbour is a separate Next.js app |

once each page is wired to its CMS file, the corresponding legacy database can be retired from `notion-config.js`.

### vertigo vault architecture

the original vertigo vault was built as a standalone learning-resource tool for a client. it now lives at `/harbour/vertigo-vault/` as part of the monetised harbour hub.

```
user visits:  windedvertigo.com/vertigo-vault/activities
     ↓ 301 permanent redirect (vercel.json)
canonical:    windedvertigo.com/harbour/vertigo-vault/activities
     ↓ rewrite (vercel.json)
served from:  vertigo-vault-ghandoffs-projects.vercel.app/harbour/vertigo-vault/activities
     ↓
app code:     apps/vertigo-vault/ (Next.js, basePath: /harbour/vertigo-vault)
```

the `/vertigo-vault` redirect ensures existing client links remain accessible. the vertigo vault app also fetches `vertigo-vault.json` at runtime for activity data.

### sync scripts

- `scripts/fetch-notion.js` — main content fetcher with retry logic (3 attempts), generates JSON for all databases above
- `scripts/notion-config.js` — centralised database ID configuration and property mappings
- `scripts/sync-notion-members.js` — members sync with image download (standalone)
- `scripts/sync-notion-services.js` — services sync, generates HTML for the `/do/` page (standalone)

---

## nordic-sqr-rct app

a separate systematic review tool. notion databases are queried in real-time (no caching layer).

| database | id | purpose |
|---|---|---|
| **reviewers** | `b74c6186d782449985ac3dee528a1977` | reviewer profiles, credentials, consent, training status |
| **intake** | `8229473837b249789a1163d109b617ef` | study intake records with full citation metadata |
| **scores** | `9dc69b99d6dc427db9c58b0446e215d2` | quality assessment ratings (Q1–Q11 likert scale) |

### key files

- `src/lib/notion.js` — client with retry wrapper (exponential backoff + jitter)
- API routes under `src/app/api/` for CRUD operations on all three databases

---

## environment variables

### creaseworks

```
NOTION_TOKEN            — notion integration token
NOTION_DB_PLAYDATES     — playdates database id
NOTION_DB_MATERIALS     — materials database id
NOTION_DB_PACKS         — packs database id
NOTION_DB_REFLECTIONS   — reflections database id
NOTION_DB_COLLECTIONS   — collections database id
NOTION_WEBHOOK_SECRET   — HMAC secret for webhook verification
CRON_SECRET             — bearer token for cron endpoint
```

### nordic-sqr-rct

```
NOTION_TOKEN            — notion integration token
NOTION_REVIEWER_DB      — reviewers database id
NOTION_INTAKE_DB        — intake database id
NOTION_SCORES_DB        — scores database id
```

### root scripts

```
NOTION_TOKEN            — notion integration token (used by fetch-notion.js)
```

---

## what the collective can author today vs. what needs work

### works now (text content)

the collective can edit any text property in the five creaseworks notion databases and changes sync automatically. this covers titles, descriptions, headlines, tags, status fields, age ranges, tinkering tiers, and all relation links between databases.

for the static site, the collective can edit content in the Site Content CMS database and it syncs to per-page JSON files. the `/what-v2/` development page already reads from the CMS. other pages will be wired incrementally.

### needs work (images + rich content)

to enable full visual authoring through notion, the following would need to be built:

1. **cover images on playdates and packs** — extend sync modules to extract notion file properties, download/upload images to a CDN (e.g. vercel blob or R2), store URLs in postgres, render in card components
2. **inline images in descriptions** — parse notion rich text blocks for image references, handle upload/CDN pipeline
3. **page body content** — fetch notion block children for full page content (instructions, step-by-step guides), transform to HTML/markdown for rendering
4. **gallery/portfolio images** — the static site scripts already handle member images; a similar pattern could be extended to other content types

---

*last updated: 4 march 2026*
