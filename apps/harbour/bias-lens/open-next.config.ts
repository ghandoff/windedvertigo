import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config — no R2 incremental cache needed for this PoC
// bias-lens has no ISR or static revalidation, so memory cache is fine
export default defineCloudflareConfig({});
