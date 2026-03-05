/**
 * Admin — Reservoir Status
 *
 * Cross-platform health dashboard showing content counts, user stats,
 * entitlements, reflection activity, and content freshness across
 * all reservoir apps.
 */

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import Link from "next/link";
import ReservoirStatusDashboard from "./reservoir-status-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "reservoir status",
  description: "cross-platform health dashboard for the reservoir",
};

export default async function ReservoirStatusPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/admin"
          className="text-sm opacity-40 hover:opacity-70 transition-opacity"
        >
          ← admin
        </Link>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        reservoir status
      </h1>
      <p className="text-sm text-cadet/50 mb-10">
        cross-platform health across creaseworks, deep-deck, and vertigo-vault
      </p>

      <ReservoirStatusDashboard />
    </main>
  );
}
