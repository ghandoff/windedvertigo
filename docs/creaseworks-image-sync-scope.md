# creaseworks image sync — implementation scope

## status summary

| tier | scope | status |
|---|---|---|
| **tier 1** | page covers on playdates + packs | ✅ complete |
| **tier 2** | page covers on collections | ✅ complete |
| **tier 3** | file properties on databases | not started — requires notion schema changes |
| **tier 4** | page body content with inline images | not started — separate initiative |

tiers 1 and 2 are fully shipped. the sync pipeline extracts notion page covers, downloads them to cloudflare R2, stores deterministic keys in neon postgres, and renders them on all three card components (playdate, pack, collection). both full sync (daily cron) and incremental sync (webhooks) handle covers.

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

all three use raw `<img>` tags with lazy loading (not next/image).

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

## what's next

### tier 3 — file properties on databases (requires notion schema changes)

if the collective wants to attach images as **database properties** (e.g. a "hero image" files field on playdates, or a "thumbnail" on packs), the notion databases need to be modified first:

1. add a `files & media` property to the relevant notion database
2. add `extractFiles()` to extract.ts:

```typescript
export function extractFiles(props: Properties, key: string): NotionImage[] {
  const prop = props[key];
  if (!prop || prop.type !== "files") return [];
  return (prop.files ?? []).map((f: any) => {
    if (f.type === "external") return { url: f.external.url };
    if (f.type === "file") return { url: f.file.url, expiry: f.file.expiry_time };
    return null;
  }).filter(Boolean);
}
```

3. sync each file to R2 using the same `syncImageToR2()` utility (key convention: `notion-images/{pageId}/{propertyName}/{index}.{ext}`)
4. store an array of R2 keys in a JSONB column

this tier is only needed if the collective wants **multiple images per page** or wants images to be a first-class database column (filterable, sortable in notion). for most use cases, page covers are sufficient.

### tier 4 — page body content with inline images (separate initiative)

the most complex tier. notion page bodies are made of "blocks" — paragraphs, headings, images, callouts, etc. syncing these requires:

1. fetching block children via `notion.blocks.children.list(pageId)`
2. recursively traversing nested blocks
3. converting to HTML or markdown
4. extracting and re-uploading any `image` blocks to R2
5. storing the rendered content in a `body_html` or `body_blocks` JSONB column

this is a significant effort (~2–3 days) and changes the sync from "properties only" to "full page content."

---

## open questions

1. **image optimisation:** should the sync pipeline resize/compress images before uploading to R2? (e.g. generate a 1200px-wide webp version for cards, plus a 400px thumbnail). this adds complexity but improves load times. could use sharp or cloudflare image resizing.

2. **fallback images:** what should cards show when no cover is set? playdates fall back to `PlaydateIllustration`; packs and collections show no image area. should there be a consistent fallback pattern across all three?

3. **notion webhook reliability:** are webhooks currently firing reliably? if so, cover images appear within seconds of being set in notion. if webhooks are flaky, the collective would need to wait for the daily cron.

4. **R2 bucket separation:** notion-synced images currently share the `creaseworks-evidence` bucket. worth separating into a dedicated `creaseworks-content` bucket for cleaner access control?

5. **next/image migration:** all three card components use raw `<img>` tags. migrating to next/image would add automatic resizing, format conversion (webp/avif), and lazy loading optimisation — but requires configuring `remotePatterns` for the R2 public URL domain.

6. **materials covers:** materials are the only synced entity type without cover support. is this intentional, or should materials get the same treatment as playdates/packs/collections?

---

*last updated: 28 february 2026*
