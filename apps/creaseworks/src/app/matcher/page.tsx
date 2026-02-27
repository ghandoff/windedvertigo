/**
 * /matcher — public playdate matcher page.
 *
 * Server component that fetches picker data (materials, forms, slots,
 * contexts) and passes them to the client-side form component.
 *
 * MVP 3 — matcher.
 * Session 12: mobile-first responsive layout — reduced padding on
 *   small screens, responsive heading, shorter intro copy on mobile.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "playdate matcher",
  description:
    "tell us what materials you have on hand and we'll find playdates that work. cardboard, sticks, fabric, tape — whatever's around.",
};
import { getAllMaterials } from "@/lib/queries/materials";
import {
  getDistinctForms,
  getDistinctSlots,
  getDistinctContexts,
} from "@/lib/queries/matcher";
import MatcherInputForm from "@/components/matcher/matcher-input-form";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function MatcherPage() {
  const [materials, forms, slots, contexts] = await Promise.all([
    getAllMaterials(),
    getDistinctForms(),
    getDistinctSlots(),
    getDistinctContexts(),
  ]);

  return (
    <main className="min-h-screen px-4 pt-8 pb-24 sm:px-6 sm:pt-16 sm:pb-16 max-w-5xl mx-auto">
      <Link
        href="/"
        className="text-sm hover:opacity-80 transition-opacity mb-4 sm:mb-6 inline-block"
        style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
      >
        &larr; creaseworks
      </Link>

      <h1
        className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2"
        style={{ color: "var(--wv-cadet)" }}
      >
        what do you have on hand?
      </h1>
      <p
        className="mb-6 sm:mb-8 text-sm sm:text-base"
        style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
      >
        tell us what&apos;s around — cardboard, sticks, fabric, whatever —
        and we&apos;ll find playdates that work with your stuff.
      </p>

      <MatcherInputForm
        materials={materials}
        forms={forms}
        slots={slots}
        contexts={contexts}
      />
    </main>
  );
}
