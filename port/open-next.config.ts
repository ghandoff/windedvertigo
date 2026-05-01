import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import { scheduled } from "./lib/scheduled";

export default defineCloudflareConfig({
  /**
   * The scheduled() export hooks into wrangler.jsonc `triggers.crons`.
   * Two cron triggers are registered:
   *   "0 * * * *"   — hourly router: dispatches all 32+ vercel.json jobs via
   *                   CRON_TABLE in port/lib/scheduled.ts
   *   every-5-min — sweep-stuck-proposals (can't
   *                   use hourly router — handled by controller.cron branch)
   *
   * See: https://opennext.js.org/cloudflare/config
   */
  scheduled,
});
