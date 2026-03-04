# creaseworks image sync — implementation scope

## status summary

| tier | scope | status |
|---|---|---|
| **tier 1** | page covers on playdates + packs | ✅ complete |
| **tier 2** | page covers on collections | ✅ complete |
| **tier 3** | file properties on databases (illustration_url) | ✅ complete |
| **tier 4** | page body content with inline images (body_html) | ✅ complete |

all four tiers are shipped. the sync pipeline extracts notion page covers, file-property images, and page body content (rendered as HTML with re-uploaded inline images). all content is stored in neon postgres and rendered on user-facing pages with appropriate tier-based access controls.

---

## what's been built

### the expiring URL problem (solved)

notion serves file URLs that expire after **1 hour**. the pipeline handles this by downloading images during sync and re-uploading to R2 with permanent, deterministic keys.

### infrastructure

cloudflare R2 storage — shared with evidence photo uploads:

- **client:** `src/lib/r2.ts` — full S3-compatible client with `uploadBuffer()`, presigned upload/read/delete, and `getPublicUrl()`
- **bucket:** `creaseworks-evidence` (via `R2_BUCKET_NAME`)
- **env vars:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- **public URL:** `getPublicUrl(key)` returns CDN URL when `R2_PUBLIC_URL` is set, falls back to `/api/images/{key}` proxy

### sync pipeline

| file | role |
|---|---|
| `src/lib/sync/extract.ts` | `extractCover(page)` — handles both `external` (unsplash/URL) and `file` (uploaded) notion covers, returns `NotionImage` with url + optional expiry |
| `src/lib/sync/sync-image.ts` | `syncImageToR2(sourceUrl, notionPageId, imageSlot)` — downloads image, uploads to R2 with deterministic key `notion-images/{pageId}/{slot}.{ext}`, returns key or null on failure. 10MB size guard, MIME detection from headers or URL extension, never throws. |
| `src/lib/sync/playdates.ts` | extracts cover, syncs to R2, stores `cover_r2_key` + `cover_url` in playdates_cache |
| `src/lib/sync/packs.ts` | same pattern as playdates |
| `src/lib/sync/collections.ts` | same pattern as playdates |
| `src/lib/sync/incremental.ts` | `upsertPlaydate()`, `upsertPack()`, `upsertCollection()` all extract and sync covers on webhook events. `upsertMaterial()` does not (materials have no covers). |

### database

| migration | what it does |
|---|---|
| `032_cover_images.sql` | adds `cover_r2_key` and `cover_url` to `playdates_cache` and `packs_cache` |
| `034_collection_covers.sql` | adds `cover_r2_key` and `cover_url` to `collections` |

latest migration: **035_gallery_visible_fields.sql**

backwards compatibility is handled via `src/lib/db-compat.ts`:

- `hasCoverUrlColumn()` and `hasCollectionCoverUrlColumn()` check column existence at runtime
- `coverSelect(alias)` and `collectionCoverSelect(alias)` return safe SQL fragments (`alias.cover_url,` or `NULL AS cover_url,`)
- query functions use these helpers so the app works even if migrations haven't been applied yet

### components

| component | behaviour |
|---|---|
| `playdate-card.tsx` | accepts `coverUrl` prop, renders `<img>` with lazy loading when present, falls back to `PlaydateIllustration` component |
| `pack-card.tsx` | accepts `cover_url` in pack object, renders 100px banner image with `object-cover` |
| `collection-card.tsx` | accepts `coverUrl` prop, renders 100px header image with `object-cover` |

all three use `next/image` with a custom Cloudflare loader (`cloudflare-image-loader.ts`).

### R2 storage key convention

```
notion-images/
  {notion-page-id}/
    cover.jpg      ← page cover
    icon.png       ← page icon (if file, not emoji)
```

deterministic keys mean re-syncs overwrite cleanly. no orphan cleanup job needed.

### performance

- **full sync:** each image adds ~1–3 seconds (download + upload). with ~35 pages across playdates + packs + collections, that's ~35–105 seconds added to the daily cron. well within vercel's 300-second function timeout.
- **incremental sync:** webhook events sync one page at a time, so the image download is negligible (~2s).
- **R2 costs:** negligible. R2 has 10GB free storage and 10M free reads/month. cover images at ~200KB each = ~7MB total.
- **CDN caching:** when `R2_PUBLIC_URL` points to a cloudflare-fronted domain, images are cached at the edge automatically.

### what the collective has now

any member of the winded.vertigo collective can:

1. open a playdate, pack, or collection page in notion
2. click "add cover" and upload or paste an image
3. wait for the next sync (up to 24 hours for cron, or near-instant if webhooks are active)
4. see the cover image rendered on the creaseworks site — on cards and anywhere that data appears

no code changes needed per image. the pipeline handles everything.

---

## tier 3 — file property images (illustration_url)

shipped. the sync pipeline extracts `files & media` database properties (e.g. "illustration" on playdates):

| file | role |
|---|---|
| `src/lib/sync/extract.ts` | `extractFileProperty(props, key)` — extracts file URL from a Notion files property |
| `src/lib/sync/sync-image.ts` | same `syncImageToR2()` utility, key convention `notion-images/{pageId}/illustration.{ext}` |
| `src/lib/sync/playdates.ts` | extracts illustration file property, syncs to R2, stores `illustration_r2_key` + `illustration_url` |

frontend rendering:
- `illustration_url` is in `PLAYDATE_ENTITLED_COLUMNS` (not visible at teaser tier)
- `EntitledPlaydateView` renders it as a hero image above the headline
- access logging tracks `illustration_url` when present

### tier 4 — page body content as HTML (body_html)

shipped. the sync pipeline fetches notion page block children and converts them to HTML:

| file | role |
|---|---|
| `src/lib/sync/blocks.ts` | `fetchPageBodyHtml(pageId)` — fetches block children, recursively traverses nested blocks, converts to semantic HTML, re-uploads inline images to R2 |
| `src/lib/sync/playdates.ts` | calls `fetchPageBodyHtml()` and stores result in `body_html` |
| `src/lib/sync/packs.ts` | same pattern |
| `src/lib/sync/collections.ts` | same pattern |
| `src/lib/sync/incremental.ts` | `upsertPlaydate()`, `upsertPack()`, `upsertCollection()` all sync body content |

database: migration `036_rich_content.sql` added `body_html` to `playdates_cache`, `packs_cache`, and `collections`.

frontend rendering:
- `body_html` is in `PLAYDATE_ENTITLED_COLUMNS` (not visible at teaser tier)
- `EntitledPlaydateView` renders it in a section with `.cms-body` styling
- pack detail page (`/packs/[slug]`) renders `body_html` for both entitled and teaser views
- collection detail page (`/playbook/[slug]`) renders `body_html` below the description
- `.cms-body` CSS class in `globals.css` styles all Notion block types (headings, lists, figures, callouts, toggles, tables, code blocks, etc.)
- access logging tracks `body_html` when present

---

## open questions

1. **image optimisation:** should the sync pipeline resize/compress images before uploading to R2? (e.g. generate a 1200px-wide webp version for cards, plus a 400px thumbnail). this adds complexity but improves load times. could use sharp or cloudflare image resizing.

2. **fallback images:** what should cards show when no cover is set? playdates fall back to `PlaydateIllustration`; packs and collections show no image area. should there be a consistent fallback pattern across all three?

3. **notion webhook reliability:** are webhooks currently firing reliably? if so, cover images appear within seconds of being set in notion. if webhooks are flaky, the collective would need to wait for the daily cron.

4. **R2 bucket separation:** notion-synced images currently share the `creaseworks-evidence` bucket. worth separating into a dedicated `creaseworks-content` bucket for cleaner access control?

5. **~~next/image migration~~:** ✅ complete — all card components and content images now use `next/image` with a custom Cloudflare loader. see `cloudflare-image-loader.ts`.

6. **materials covers:** materials are the only synced entity type without cover support. is this intentional, or should materials get the same treatment as playdates/packs/collections?

---

*last updated: 4 march 2026*
