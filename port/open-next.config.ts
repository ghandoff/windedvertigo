import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import { scheduled } from "./lib/scheduled";

export default defineCloudflareConfig({
  /**
   * The scheduled() export hooks into wrangler.jsonc `triggers.crons`.
   * Single `0 * * * *` trigger dispatches all 32 cron jobs via hourly router
   * in port/lib/scheduled.ts.
   *
   * See: https://opennext.js.org/cloudflare/config
   */
  scheduled,
});
