# Creaseworks next/image Evaluation

> Session 49b — 2026-03-04

## Current State

### Image Sources

All dynamic images in creaseworks are stored in **Cloudflare R2** and served via `cdn.creaseworks.co` (Cloudflare CDN). The `getPublicUrl()` helper in `src/lib/r2.ts` returns `${R2_PUBLIC_URL}/${key}`.

Static assets (logo SVG in footer) use `apiUrl()` to prepend the basePath.

### Usage Audit

| Category | Count | Details |
|----------|-------|---------|
| `<img>` tags | 15 | Pack cards, playdate cards, collection cards, evidence photos, portfolio, admin browser, lightbox, footer logo, shared evidence page |
| `next/image` | 3 | Gallery page, admin gallery, log page — all use `cdn.creaseworks.co` URLs |
| CMS `<img>` (sync) | 1 | `blocks.ts` generates `<img>` in synced HTML from Notion |
| Blob URLs | 2 | `photo-quick-log-button.tsx`, `evidence-photo-upload.tsx` — camera/upload previews |

### Problem

The 3 existing `next/image` usages reference `https://cdn.creaseworks.co/` but **no `remotePatterns` or `images` config exists** in `next.config.ts`. Next.js blocks unregistered remote domains, so these likely error in production or bypass optimization entirely.

---

## Vercel Image Optimization Pricing

| Plan | Included | Overage | Notes |
|------|----------|---------|-------|
| **Hobby** (current) | 5,000 transforms/month | 402 error (hard cap) | Shared across ALL 6 projects in the account |
| **Pro** ($20/mo) | ~400K transforms (via $20 credit at $5/1K) | $5 per 1,000 transforms | Credit offsets transforms first |

### Transform Math

Each unique `(src, width, quality)` combo = 1 transform. `next/image` generates `srcset` with multiple widths (640, 750, 828, 1080, 1200, 1920, 2048, 3840 by default). A single image visit can consume 1-3 transforms depending on viewport.

**Conservative estimate for creaseworks pilot (50 users):**
- ~200 unique images in catalogue
- Each viewed at ~2 widths on average
- = ~400 transforms initially, then cached
- Well within 5K Hobby limit for launch

**Risk:** As image library grows and users browse more, transforms compound. Gallery pages with 20+ thumbnails are heavy consumers.

---

## Recommendation: Cloudflare Custom Loader

Since all dynamic images already flow through **Cloudflare CDN** (`cdn.creaseworks.co`), the optimal approach is a **custom image loader** that passes the URL through unchanged. This gives us `next/image` benefits without consuming any Vercel transform quota:

### Benefits of next/image (even without Vercel optimization)
- **Lazy loading** — images below the fold don't load until scrolled into view
- **Automatic `srcset`** — responsive sizing via `sizes` prop
- **Layout shift prevention** — `width`/`height` or `fill` reserves space
- **Priority hints** — `priority` prop for above-fold hero images
- **Blur placeholder** — shimmer effect while loading (requires `blurDataURL` for remote images)

### How It Works

A custom loader tells Next.js to skip Vercel's `/_next/image` proxy and return the original URL directly:

```typescript
// src/lib/cloudflare-image-loader.ts
export default function cloudflareImageLoader({ src }: { src: string }) {
  return src; // Cloudflare CDN already handles caching + delivery
}
```

Configure in `next.config.ts`:
```typescript
images: {
  loader: 'custom',
  loaderFile: './src/lib/cloudflare-image-loader.ts',
}
```

### Trade-offs

| Aspect | Vercel Optimizer | Cloudflare Passthrough |
|--------|-----------------|----------------------|
| Format conversion (WebP/AVIF) | Yes | No (serves original format) |
| On-the-fly resize | Yes | No (serves original size) |
| Transform quota usage | Yes (5K/mo) | None |
| CDN caching | Vercel Edge | Cloudflare (already configured) |
| Cost at scale | $5/1K transforms on Pro | Free |
| Lazy loading | Yes | Yes |
| Layout shift prevention | Yes | Yes |
| srcset generation | Yes (resized) | Yes (original at all sizes) |

**For pilot launch**, Cloudflare passthrough is the right call. Images are already reasonably sized (uploaded via the evidence flow which could add client-side resize later). When/if we need on-the-fly resizing, we can add **Cloudflare Image Resizing** ($0 extra on Pro plan, $20/mo on free) which integrates with the same CDN URL pattern.

### Migration Scope

**Migrate to `next/image`:**
- `pack-card.tsx` — pack cover images (static catalogue)
- `playdate-card.tsx` — playdate cover images
- `collection-card.tsx` — collection cover images
- `admin-playdate-browser.tsx` (x2) — admin thumbnails
- `playbook-search.tsx` — search result thumbnails
- `portfolio-gallery.tsx` — portfolio evidence photos
- `evidence/shared/[token]/page.tsx` — shared evidence photos
- `evidence-lightbox.tsx` — lightbox full-size images

**Keep as `<img>`:**
- `photo-quick-log-button.tsx` (x2) — blob URLs from camera/upload (not remote)
- `evidence-photo-upload.tsx` — blob URL preview
- `footer.tsx` — inline SVG with `apiUrl()` (static, no benefit from next/image)
- `blocks.ts` — CMS-synced HTML (pre-rendered, not a React component tree)

**Already `next/image` (fix config):**
- `gallery/page.tsx` — gallery evidence
- `admin/gallery/page.tsx` — admin gallery
- `log/page.tsx` — log evidence
