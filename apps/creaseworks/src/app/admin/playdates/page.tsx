/**
 * Admin playdates page — full catalog view across all release channels.
 *
 * Requires admin access. Shows every ready playdate with its release_channel
 * and ip_tier so admins can audit what's public vs. internal.
 */

import { requireAdmin } from "@/lib/auth-helpers";
import { getAllReadyPlaydates } from "@/lib/queries/playdates";
import { PlaydateCard } from "@/components/ui/playdate-card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPlaydatesPage() {
  await requireAdmin();
  const playdates = await getAllReadyPlaydates();

  // Group by release_channel for easy scanning
  const sampler = playdates.filter((p: any) => p.release_channel === "sampler");
  const internal = playdates.filter((p: any) => p.release_channel === "internal-only");
  const campaign = playdates.filter(
    (p: any) => p.release_channel !== "sampler" && p.release_channel !== "internal-only",
  );

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
          the public sampler shows only the &ldquo;sampler&rdquo; channel.
        </p>
      </header>

      {/* sampler channel */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-1">
          sampler
          <span className="text-sm font-normal text-cadet/50 ml-2">
            ({sampler.length} playdates — visible to everyone)
          </span>
        </h2>
        <p className="text-xs text-cadet/40 mb-4">
          these are the playdates the public sees at /sampler
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sampler.map((p: any) => (
            <PlaydateCard
              key={p.id}
              slug={p.slug}
              title={p.title}
              headline={p.headline}
              primaryFunction={p.primary_function}
              arcEmphasis={p.arc_emphasis ?? []}
              contextTags={p.context_tags ?? []}
              frictionDial={p.friction_dial}
              startIn120s={p.start_in_120s}
              hasFindAgain={p.has_find_again}
              runCount={p.run_count}
            />
          ))}
        </div>
      </section>

      {/* campaign channel */}
      {campaign.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-1">
            campaign
            <span className="text-sm font-normal text-cadet/50 ml-2">
              ({campaign.length} playdates — visible via campaign links only)
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaign.map((p: any) => (
              <PlaydateCard
                key={p.id}
                slug={p.slug}
                title={p.title}
                headline={p.headline}
                primaryFunction={p.primary_function}
                arcEmphasis={p.arc_emphasis ?? []}
                contextTags={p.context_tags ?? []}
                frictionDial={p.friction_dial}
                startIn120s={p.start_in_120s}
                hasFindAgain={p.has_find_again}
                runCount={p.run_count}
              />
            ))}
          </div>
        </section>
      )}

      {/* internal-only */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-1">
          internal-only
          <span className="text-sm font-normal text-cadet/50 ml-2">
            ({internal.length} playdates — pack-gated or hidden)
          </span>
        </h2>
        <p className="text-xs text-cadet/40 mb-4">
          these are only visible to entitled users or internal team
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {internal.map((p: any) => (
            <PlaydateCard
              key={p.id}
              slug={p.slug}
              title={p.title}
              headline={p.headline}
              primaryFunction={p.primary_function}
              arcEmphasis={p.arc_emphasis ?? []}
              contextTags={p.context_tags ?? []}
              frictionDial={p.friction_dial}
              startIn120s={p.start_in_120s}
              hasFindAgain={p.has_find_again}
              runCount={p.run_count}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
