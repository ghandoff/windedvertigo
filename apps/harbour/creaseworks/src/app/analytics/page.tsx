/**
 * /analytics — admin-only analytics dashboard.
 *
 * Renders the AnalyticsDashboard client component which fetches
 * aggregate run analytics from /api/analytics/runs. Visibility
 * scoping is handled server-side (admin sees all, org sees org,
 * user sees own).
 */

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import Link from "next/link";
import AnalyticsDashboard from "./analytics-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "analytics",
  description: "reflection analytics and usage dashboard.",
};

export default async function AnalyticsPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">analytics</h1>
          <p className="text-sm text-cadet/50 mt-1">
            aggregate reflection data across all users
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-cadet/50 hover:text-redwood transition-colors"
        >
          ← admin hub
        </Link>
      </div>

      <AnalyticsDashboard />
    </main>
  );
}
