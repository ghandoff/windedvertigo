// open-next.config.ts — OpenNext for Cloudflare configuration
// https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Using static-assets cache for now. kvIncrementalCache requires wrangler to
// be logged in during the build step (it pre-populates the KV namespace), which
// is not compatible with the current local deploy workflow.
//
// TODO: switch to kvIncrementalCache once `wrangler login` is run locally, or
// a CLOUDFLARE_API_TOKEN env var is wired into the deploy script.
// KV namespace already created: wv-site-next-cache (NEXT_INC_CACHE_KV binding).
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
