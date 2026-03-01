/**
 * /admin/campaigns — manage campaign metadata.
 *
 * Campaigns are promotional groupings (scavenger hunts, partner activations).
 * Playdate association is via campaign_tags[] on playdates_cache; this page
 * manages the display metadata (title, description, active flag).
 */

import { requireAdmin } from "@/lib/auth-helpers";
import { getAllCampaigns } from "@/lib/queries/campaigns";
import Link from "next/link";
import CampaignForm from "./campaign-form";
import CampaignTable from "./campaign-table";

export const metadata = { title: "campaigns — admin" };
export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  await requireAdmin();
  const campaigns = await getAllCampaigns();

  const active = campaigns.filter((c) => c.active);
  const inactive = campaigns.filter((c) => !c.active);

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <header className="mb-10">
        <Link
          href="/admin"
          className="text-sm text-cadet/50 hover:text-cadet mb-4 inline-block"
        >
          &larr; admin
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          campaigns
        </h1>
        <p className="text-cadet/60 max-w-lg">
          create and manage promotional campaigns. tag playdates via
          <code className="text-xs bg-cadet/5 px-1.5 py-0.5 rounded mx-1">
            campaign_tags
          </code>
          in Notion to associate them with a campaign slug.
        </p>
      </header>

      {/* create form */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold tracking-tight mb-4">
          new campaign
        </h2>
        <CampaignForm />
      </section>

      {/* active campaigns */}
      {active.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold tracking-tight mb-1">active</h2>
          <p className="text-sm text-cadet/40 mb-4">
            {active.length} campaign{active.length !== 1 ? "s" : ""} live
          </p>
          <CampaignTable campaigns={active} />
        </section>
      )}

      {/* inactive campaigns */}
      {inactive.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight mb-1">
            inactive
          </h2>
          <p className="text-sm text-cadet/40 mb-4">
            {inactive.length} campaign{inactive.length !== 1 ? "s" : ""}{" "}
            deactivated
          </p>
          <CampaignTable campaigns={inactive} />
        </section>
      )}

      {campaigns.length === 0 && (
        <p className="text-cadet/40 text-center py-12">
          no campaigns yet — use the form above to create one.
        </p>
      )}
    </main>
  );
}
