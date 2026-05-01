/**
 * /matcher — the "find" phase of find, fold, unfold, find again.
 *
 * All four find modes live on this single page:
 *   - classic picker  → ?mode=classic
 *   - explore rooms   → (default, no param)
 *   - challenge       → ?mode=challenge
 *   - scavenger hunt  → ?mode=hunt
 *
 * Server component fetches all data once. Mode switching happens
 * entirely client-side (no server round-trip → instant transitions).
 *
 * Background is cadet blue for contrast — UDL accessibility concern
 * with white-on-champagne readability.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "find",
  description:
    "look around — what do you notice? pick what you find and we'll show you something amazing to make together.",
};

import { getAllMaterials } from "@/lib/queries/materials";
import {
  getDistinctForms,
  getDistinctSlots,
  getDistinctContexts,
} from "@/lib/queries/matcher";
import FindPhaseShell from "@/components/matcher/find-phase-shell";
import type { FindMode } from "@/components/matcher/find-mode-selector";
import { materialSlug } from "@/lib/material-slug";

export const dynamic = "force-dynamic";

const VALID_MODES = new Set<FindMode>(["classic", "rooms", "challenge", "hunt"]);

/** Max pre-selected materials accepted from ?materials=<csv>. Matches the
 *  hero's 12-tile cap; extras are silently truncated. */
const MAX_PRESELECT = 12;

export default async function MatcherPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; materials?: string }>;
}) {
  const params = await searchParams;

  const [materials, forms, slots, contexts] = await Promise.all([
    getAllMaterials(),
    getDistinctForms(),
    getDistinctSlots(),
    getDistinctContexts(),
  ]);

  const raw = params.mode as FindMode | undefined;
  const initialMode: FindMode =
    raw && VALID_MODES.has(raw) ? raw : "rooms";

  /* Parse ?materials=<csv> into a de-duplicated, capped, known-only slug
     list. Unknown slugs drop silently — the landing hero only emits slugs
     that come from the same material list the server fetched, but a stale
     share link or hand-typed URL shouldn't error. */
  const initialMaterialSlugs: string[] = [];
  if (params.materials) {
    const known = new Set(materials.map((m) => materialSlug(m.title)));
    const seen = new Set<string>();
    for (const raw of params.materials.split(",")) {
      const slug = raw.trim();
      if (!slug) continue;
      if (seen.has(slug)) continue;
      if (!known.has(slug)) continue;
      seen.add(slug);
      initialMaterialSlugs.push(slug);
      if (initialMaterialSlugs.length >= MAX_PRESELECT) break;
    }
  }

  return (
    <main className="px-4 pt-8 pb-24 sm:px-6 sm:pt-14 sm:pb-16">
      <FindPhaseShell
        initialMode={initialMode}
        materials={materials}
        forms={forms}
        slots={slots}
        contexts={contexts}
        initialMaterialSlugs={initialMaterialSlugs}
      />

      <style>{`
        @keyframes heroWave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(10deg) scale(1.1); }
          75% { transform: rotate(-5deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes heroWave { from, to { transform: none; } }
        }
      `}</style>
    </main>
  );
}
