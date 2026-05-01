/**
 * Admin playdates page — full catalog view with content review.
 *
 * Requires admin access. Shows every ready playdate with pack filter
 * toggles and content completeness indicators. Admins can expand any
 * card to preview its full content (find/fold/unfold, materials,
 * design notes) without leaving the admin area.
 *
 * The initial load fetches lightweight data with boolean completeness
 * flags. Full content is lazy-loaded via the API when a card is expanded.
 */

import { requireAdmin } from "@/lib/auth-helpers";
import { getAdminPlaydates } from "@/lib/queries/playdates";
import { getAllPacksWithPlaydateIds } from "@/lib/queries/packs";
import AdminPlaydateBrowser from "@/components/admin/admin-playdate-browser";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPlaydatesPage() {
  await requireAdmin();

  const [playdates, packMappings] = await Promise.all([
    getAdminPlaydates(),
    getAllPacksWithPlaydateIds(),
  ]);

  return (
    <main className="min-h-screen px-6 py-16 max-w-5xl mx-auto">
      <header className="mb-12">
        <Link href="/admin" className="text-sm text-cadet/50 hover:text-cadet mb-4 inline-block">
          &larr; admin
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          all playdates
        </h1>
        <p className="text-cadet/60 max-w-lg">
          every published playdate across all release channels.
          use the pack filters to preview what entitled users see.
          click any card to expand a content preview.
        </p>
      </header>

      <AdminPlaydateBrowser
        playdates={playdates}
        packMappings={packMappings}
      />
    </main>
  );
}
