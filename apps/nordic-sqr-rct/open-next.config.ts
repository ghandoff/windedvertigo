import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import { scheduled } from "./src/lib/scheduled.js";

// Run the Next.js build from the monorepo root so Turbopack can resolve the
// hoisted `next` package. OpenNext runs buildCommand with
// cwd=apps/nordic-sqr-rct; the `cd ../..` navigates to the monorepo root.
const BUILD_CMD = "cd ../.. && npm run build -w nordic-sqr-rct";

export default defineCloudflareConfig({
  buildCommand: BUILD_CMD,
  openNextConfig: {
    default: {
      override: {
        // Wire the cron scheduled() handler defined in src/lib/scheduled.js.
        // @ts-ignore — cloudflare worker type not in base OpenNext types
        scheduled: async (controller: any, env: any, ctx: any) =>
          scheduled(controller, env, ctx),
      },
    },
  },
});
