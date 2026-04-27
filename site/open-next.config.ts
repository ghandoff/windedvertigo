// open-next.config.ts — OpenNext for Cloudflare configuration
// https://opennext.js.org/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Using static-assets cache (no R2 required). ISR pages are served from
// build-time snapshots. Switch back to r2-incremental-cache once the
// wv-site-opennext-cache R2 bucket is available in the deploy account.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
