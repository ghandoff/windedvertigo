/**
 * Admin page: harbour CMS sync + force-redeploy.
 *
 * Two-card dashboard for triggering Notion CMS content syncs (via GitHub
 * Actions) and force-redeploying harbour ecosystem Vercel apps.
 */

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import Link from "next/link";
import HarbourSyncDashboard from "./harbour-sync-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "harbour sync",
  description:
    "trigger Notion CMS content sync or force-redeploy harbour ecosystem apps.",
};

export default async function HarbourSyncPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <div className="mb-2">
        <Link
          href="/admin"
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--wv-cadet)", opacity: 0.4 }}
        >
          ← admin
        </Link>
      </div>

      <h1
        className="text-3xl font-semibold tracking-tight mb-2"
        style={{ color: "var(--wv-cadet)" }}
      >
        harbour sync
      </h1>
      <p className="text-sm mb-10" style={{ color: "var(--wv-cadet)", opacity: 0.5 }}>
        the cron job syncs Notion content daily at 06:00 UTC. use these
        controls to trigger an immediate sync or force-redeploy harbour
        ecosystem apps.
      </p>

      <HarbourSyncDashboard />
    </main>
  );
}
