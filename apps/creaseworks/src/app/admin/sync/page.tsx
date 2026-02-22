/**
 * Admin page: manual Notion sync trigger.
 *
 * Single button to trigger a full sync, with status feedback.
 *
 * MVP 4 — admin pages and rate limiting.
 */

import { requireAdmin } from "@/lib/auth-helpers";
import SyncTrigger from "./sync-trigger";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        notion sync
      </h1>
      <p className="text-sm text-cadet/50 mb-8">
        the cron job syncs content from Notion every day at 06:00 UTC.
        use this button to trigger an immediate sync — useful after
        editing patterns, materials, or packs in Notion.
      </p>

      <SyncTrigger />
    </main>
  );
}
