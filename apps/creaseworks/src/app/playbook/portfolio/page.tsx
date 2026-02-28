/**
 * /playbook/portfolio — visual gallery of all evidence across reflections.
 *
 * A visual mosaic of photos, quotes, and observations captured
 * during playdates. Filterable by evidence type and playdate.
 * Each tile opens in a lightbox with full context.
 *
 * Practitioner tier feature.
 * Phase C — evidence portfolio.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import { getReadyPlaydatesForPicker } from "@/lib/queries/runs";
import PortfolioGallery from "./portfolio-gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "portfolio",
  description: "your evidence portfolio — photos, quotes, and observations from creative play.",
};

export default async function PortfolioPage() {
  const session = await requireAuth();

  // Practitioner gate — same logic as run form
  const isPractitioner =
    session.isInternal || session.isAdmin || !!session.orgId;

  // Playdates for the filter dropdown
  const playdates = await getReadyPlaydatesForPicker();

  return (
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
      {/* back link */}
      <Link
        href="/playbook"
        className="text-xs text-cadet/40 hover:text-cadet/60 transition-colors mb-6 inline-block"
      >
        &larr; back to playbook
      </Link>

      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1">
        your portfolio
      </h1>
      <p className="text-sm text-cadet/50 mb-8">
        photos, quotes, and observations from your reflections — all in one
        place.
      </p>

      {isPractitioner ? (
        <PortfolioGallery
          playdates={playdates.map((p) => ({
            slug: p.slug,
            title: p.title,
          }))}
        />
      ) : (
        <div
          className="rounded-xl border p-8 text-center"
          style={{
            borderColor: "rgba(203, 120, 88, 0.15)",
            backgroundColor: "rgba(203, 120, 88, 0.04)",
          }}
        >
          <p className="text-sm text-cadet/60 mb-2">
            the portfolio collects photos, quotes, and observations from
            your reflections into a visual gallery.
          </p>
          <p
            className="text-sm font-medium"
            style={{ color: "var(--wv-sienna)" }}
          >
            upgrade to practitioner to unlock this feature.
          </p>
        </div>
      )}
    </main>
  );
}
