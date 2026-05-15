import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No ISR or incremental cache needed — all routes are dynamic
export default defineCloudflareConfig({});
