// open-next.config.ts — OpenNext for Cloudflare configuration
// https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

// Use KV for ISR so `revalidate: N` pages actually get cached at runtime.
// The previous staticAssetsIncrementalCache was read-only (cache populated
// at build time only), so any page that went stale re-rendered from scratch
// on every request — under concurrency that meant N parallel Notion calls
// per page, queued behind Notion's 3 req/sec rate limit. A 50-burst against
// /harbour/regenerative-practices-catalogue measured p95 ~1.9s; expect that
// to drop to within a small multiple of the sequential ~370ms TTFB after
// this change.
//
// Binding: NEXT_INC_CACHE_KV (declared in wrangler.jsonc).
// Namespace: wv-site-next-cache (id 0d2ae2b7b83c4b5997ffc0305e6eda21).
// Auth for build-time populate: CLOUDFLARE_API_TOKEN in env (same auth the
// deploy step uses), no `wrangler login` interactive flow required.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
