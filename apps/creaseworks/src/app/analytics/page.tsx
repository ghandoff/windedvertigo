/**
 * Analytics dashboard page — aggregate run statistics.
 *
 * Requires authentication. Shows run analytics based on visibility:
 *   - Admins see all runs
 *   - Org members see their org’s runs
 *   - No org: only own runs
 *
 * MVP 7 — run analytics dashboard.
 */

import { requireAuth } from "@/lib/auth-helpers";
import AnalyticsDashboard from "./analytics-dashboard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireAuth();

  return (
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
      <div className="mb-2">
        <h1 className="text-3xl font-semibold tracking-tight">analytics</h1>
      </div>
      <p className="text-sm text-cadet/50 mb-8">
        aggregate statistics across your runs — patterns used, evidence captured,
        and trends over time.
      </p>

      <AnalyticsDashboard />
    </main>
  );
}
