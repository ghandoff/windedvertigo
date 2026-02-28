# creaseworks image sync — implementation scope

## current state

the creaseworks sync pipeline pulls text properties from five notion databases into neon postgres cache tables. **no images are synced today.** the three content-facing databases (playdates, packs, collections) contain zero `files`-type properties — everything is text, select, multi_select, relation, checkbox, number, or status.

however, every notion page exposes two image sources that don't require database-level properties:

- **page cover** — a banner image set via notion's built-in cover feature (`page.cover` in the API)
- **page icon** — either an emoji or an uploaded image (`page.icon` in the API)

collections already sync the `icon` field as a text/emoji value, but if a user uploads an actual image as the icon, it would be ignored.

### the expiring URL problem

notion serves file URLs that expire after **1 hour**. this means:

- you cannot store a notion file URL in postgres and expect it to work later
- images **must** be downloaded during sync and re-uploaded to persistent storage
- both full sync (daily cron) and incremental sync (webhooks) need this pipeline

### existing infrastructure

cloudflare R2 storage is already configured for evidence photo uploads:

- **client:** `src/lib/r2.ts` — full S3-compatible client with presigned upload/read/delete
- **bucket:** `creaseworks-evidence` (via `R2_BUCKET_NAME`)
- **env vars:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- **public URL support:** `getPublicUrl(key)` returns a CDN-friendly URL when `R2_PUBLIC_URL` is set

the R2 client, bucket, and credentials can be reused directly. no new infrastructure needed.

---

## what to build

### tier 1 — page covers on playdates + packs (recommended first)

the highest-value image feature: cover images on playdate cards and pack cards throughout the site. this is what makes the sampler grid, playbook, and pack pages feel visual rather than text-only.

**effort:** ~4–6 hours

#### 1. add `extractCover()` to extract.ts

```typescript
export interface NotionImage {
  url: string;
  expiry?: string; // notion's expiry_time for file-type covers
}

export function extractCover(page: NotionPage): NotionImage | null {
  const cover = (page as any).cover;
  if (!cover) return null;
  if (cover.type === "external") {
    return { url: cover.external.url };
  }
  if (cover.type === "file") {
    return { url: cover.file.url, expiry: cover.file.expiry_time };
  }
  return null;
}
```

note: `external` covers (unsplash, pasted URLs) don't expire and could theoretically be stored as-is. but for consistency and resilience (external URLs can go dead), all covers should be re-uploaded to R2.

#### 2. create image sync utility — `src/lib/sync/sync-image.ts`

a shared utility that both full sync and incremental sync call:

```typescript
import { getR2Client } from "@/lib/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * download an image from a URL and upload it to R2.
 * returns the R2 storage key on success, null on failure.
 *
 * storage key convention: notion-images/{notionPageId}/cover.{ext}
 */
export async function syncImageToR2(
  sourceUrl: string,
  notionPageId: string,
  imageSlot: "cover" | "icon",
): Promise<string | null> {
  // 1. download from notion (or external URL)
  // 2. detect content type from response headers
  // 3. upload to R2 with deterministic key
  // 4. return the storage key
}

/**
 * given a storage key, return the public URL for rendering.
 */
export function imageUrl(r2Key: string | null): string | null {
  if (!r2Key) return null;
  return getPublicUrl(r2Key);
}
```

key design decisions:

- **deterministic keys** (`notion-images/{pageId}/cover.webp`) — re-syncing the same page overwrites the same key, no orphan cleanup needed
- **download server-side** — the sync runs on vercel functions, so it fetches the notion URL and streams to R2 directly. no browser involvement.
- **content type detection** — infer from the response `content-type` header, or from the URL extension as fallback
- **max size guard** — skip images larger than 10MB to avoid function timeouts
- **error resilience** — if the image download fails, log a warning and continue the sync (don't block text content)

#### 3. database migration — 032_cover_images.sql

```sql
-- add cover image columns to playdates and packs cache tables
ALTER TABLE playdates_cache
  ADD COLUMN IF NOT EXISTS cover_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

ALTER TABLE packs_cache
  ADD COLUMN IF NOT EXISTS cover_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT;
```

`cover_r2_key` is the R2 storage key (for deletion/re-upload). `cover_url` is the pre-computed public URL (for fast reads without calling R2 at query time).

#### 4. update playdates sync — `src/lib/sync/playdates.ts`

- add `coverR2Key: string | null` and `coverUrl: string | null` to `PlaydateRow`
- in `parsePlaydatePage()`, call `extractCover(page)` to get the source URL
- in `upsertRow()`, if a cover exists and either:
  - `cover_r2_key` is null (first sync), or
  - `notion_last_edited` has changed since last sync

  then call `syncImageToR2(sourceUrl, notionId, "cover")` and store the key + public URL
- add `cover_r2_key` and `cover_url` to the INSERT and ON CONFLICT UPDATE

#### 5. update packs sync — `src/lib/sync/packs.ts`

same pattern as playdates.

#### 6. update incremental sync — `src/lib/sync/incremental.ts`

the `upsertPlaydate()` and `upsertPack()` functions need the same cover extraction + R2 upload logic. factor the image sync into the shared utility so both paths call the same function.

#### 7. update components to render covers

- `PlaydateCard` — add optional `coverUrl` prop, render as `<img>` or next/image with aspect ratio container
- `PackCard` — same pattern
- query functions (`getReadyPlaydates`, `getPacksForOrg`, etc.) — add `cover_url` to SELECT

---

### tier 2 — page covers on collections (incremental)

**effort:** ~1–2 hours (follows the tier 1 pattern exactly)

- add `cover_r2_key` / `cover_url` columns to `collections` table
- update `src/lib/sync/collections.ts` to extract and sync covers
- update `src/lib/sync/incremental.ts` for collections
- update collection cards on the playbook page

---

### tier 3 — file properties on databases (future, requires notion schema changes)

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

3. sync each file to R2 using the same utility (key convention: `notion-images/{pageId}/{propertyName}/{index}.{ext}`)
4. store an array of R2 keys in a JSONB column

this tier is only needed if the collective wants **multiple images per page** or wants images to be a first-class database column (filterable, sortable in notion). for most use cases, page covers are sufficient.

---

### tier 4 — page body content with inline images (future)

the most complex tier. notion page bodies are made of "blocks" — paragraphs, headings, images, callouts, etc. syncing these requires:

1. fetching block children via `notion.blocks.children.list(pageId)`
2. recursively traversing nested blocks
3. converting to HTML or markdown
4. extracting and re-uploading any `image` blocks to R2
5. storing the rendered content in a `body_html` or `body_blocks` JSONB column

this is a significant effort (~2–3 days) and changes the sync from "properties only" to "full page content." it's a separate initiative.

---

## implementation plan (tier 1)

### files to create

| file | purpose |
|---|---|
| `src/lib/sync/sync-image.ts` | shared image download → R2 upload utility |
| `migrations/032_cover_images.sql` | add cover columns to playdates_cache + packs_cache |

### files to modify

| file | change |
|---|---|
| `src/lib/sync/extract.ts` | add `extractCover()` and `NotionImage` type |
| `src/lib/sync/playdates.ts` | extract cover, call syncImageToR2, store key + URL |
| `src/lib/sync/packs.ts` | same as playdates |
| `src/lib/sync/incremental.ts` | add cover sync to upsertPlaydate() + upsertPack() |
| `src/lib/r2.ts` | add `uploadBuffer()` helper for server-side uploads (currently only has presigned URL generation) |
| `src/components/ui/playdate-card.tsx` | render cover image |
| `src/components/ui/pack-card.tsx` | render cover image |
| relevant query files | add `cover_url` to SELECT statements |

### R2 storage key convention

```
notion-images/
  {notion-page-id}/
    cover.jpg      ← page cover
    icon.png       ← page icon (if file, not emoji)
```

deterministic keys mean re-syncs overwrite cleanly. no orphan cleanup job needed.

### performance considerations

- **sync time:** each image adds ~1–3 seconds (download + upload). with 30 playdates + 5 packs, that's ~35–105 seconds added to the daily cron. well within vercel's 300-second function timeout.
- **incremental sync:** webhook events only sync one page at a time, so the image download is negligible (~2s).
- **R2 costs:** negligible. R2 has 10GB free storage and 10M free reads/month. cover images for 35 pages at ~200KB each = ~7MB total.
- **CDN caching:** if `R2_PUBLIC_URL` points to a cloudflare-fronted domain, images are cached at the edge automatically.

### what the collective gets

after tier 1, any member of the winded.vertigo collective can:

1. open a playdate or pack page in notion
2. click "add cover" and upload or paste an image
3. wait for the next sync (up to 24 hours for cron, or near-instant if webhooks are active)
4. see the cover image rendered on the creaseworks site — on cards, detail pages, and anywhere that playdate/pack data appears

no code changes needed per image. the pipeline handles everything.

---

## open questions

1. **image optimisation:** should the sync pipeline resize/compress images before uploading to R2? (e.g. generate a 1200px-wide webp version for cards, plus a 400px thumbnail). this adds complexity but improves load times. could use sharp or cloudflare image resizing.

2. **fallback images:** what should cards show when no cover is set? a solid brand-colour background? a generated gradient? a placeholder illustration?

3. **notion webhook reliability:** are webhooks currently firing reliably? if so, cover images will appear within seconds of being set in notion. if webhooks are flaky, the collective would need to wait for the 06:00 UTC cron.

4. **R2 bucket separation:** should notion-synced images go in the same `creaseworks-evidence` bucket, or a separate bucket (e.g. `creaseworks-content`)? same bucket is simpler; separate bucket gives cleaner access control.

---

*last updated: 27 february 2026*
