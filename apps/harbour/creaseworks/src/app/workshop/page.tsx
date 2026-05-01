/**
 * /workshop — "my workshop" persistent material inventory.
 *
 * users declare what materials they have at home. this becomes
 * their personal "brick collection" — pre-fills the matcher and
 * enables material mastery tracking over time.
 *
 * layout: visual icon grid grouped by form, with function tags.
 * tap to add/remove materials from your inventory.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-helpers";
import { getUserMaterials } from "@/lib/queries/user-materials";
import { getAllMaterials } from "@/lib/queries/materials";
import WorkshopGrid from "@/components/workshop/workshop-grid";

export const metadata: Metadata = {
  title: "my workshop",
  description: "your personal collection of materials — tap what you have on hand.",
};

export const dynamic = "force-dynamic";

export default async function WorkshopPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [userMaterials, allMaterials] = await Promise.all([
    getUserMaterials(session.userId),
    getAllMaterials(),
  ]);

  const ownedIds = new Set(userMaterials.map((m) => m.materialId));

  return (
    <main className="px-4 pt-8 pb-24 sm:px-6 sm:pt-14 sm:pb-16">
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 className="text-2xl sm:text-3xl font-bold font-serif text-cadet mb-2">
          my workshop
        </h1>
        <p className="text-sm text-cadet/60 mb-8" style={{ maxWidth: 500 }}>
          tap materials you have at home. we&rsquo;ll use your workshop to find
          playdates that work with what you already have.
        </p>

        <div
          className="rounded-2xl p-6"
          style={{
            background: "var(--wv-cream)",
            border: "1.5px solid rgba(39, 50, 72, 0.08)",
          }}
        >
          <WorkshopGrid
            allMaterials={allMaterials}
            ownedIds={Array.from(ownedIds)}
          />
        </div>
      </div>
    </main>
  );
}
