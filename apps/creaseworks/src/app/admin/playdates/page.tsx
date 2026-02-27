/**
 * Admin playdates page — full catalog view across all release channels.
 *
 * Requires admin access. Shows every ready playdate with its release_channel
 * and ip_tier so admins can audit what's public vs. internal.
 *
 * Pack filter toggles let the admin preview each pack's playdate set —
 * exactly what an entitled user would see.
 */

import { requireAdmin } from "@/lib/auth-helpers";
import { getAllReadyPlaydates } from "@/lib/queries/playdates";
import { getAllPacksWithPlaydateIds } from "@/lib/queries/packs";
import AdminPlaydateBrowser from "@/components/admin/admin-playdate-browser";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPlaydatesPage() {
  await requireAdmin();

  const [playdates, packMappings] = await Promise.all([
    getAllReadyPlaydates(),
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
        </p>
      </header>

      <AdminPlaydateBrowser
        playdates={playdates}
        packMappings={packMappings}
      />
    </main>
  );
}
