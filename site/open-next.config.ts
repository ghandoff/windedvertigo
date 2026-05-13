// open-next.config.ts — OpenNext for Cloudflare configuration
// https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

// KV-based incremental cache — stores ISR page renders in the KV namespace
// bound as NEXT_INC_CACHE_KV (wv-site-next-cache, created 2026-05-13).
// This enables revalidate = N to actually cache rendered pages across requests
// rather than re-rendering on every request. First request cold (~30s Notion),
// subsequent requests within revalidate window served from KV (~50ms).
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
