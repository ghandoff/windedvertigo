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
    <main
      className="min-h-screen px-4 pt-8 pb-24 sm:px-6 sm:pt-16 sm:pb-16"
      style={{
        background:
          "linear-gradient(175deg, rgba(255,235,210,0.18) 0%, rgba(255,255,255,0) 40%)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <Link
          href="/"
          className="text-sm hover:opacity-80 transition-opacity mb-4 sm:mb-6 inline-block"
          style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
        >
          &larr; creaseworks
        </Link>

        {/* playful heading with decorative accent */}
        <div className="relative mb-6 sm:mb-8">
          {/* small decorative dot cluster — desktop only */}
          <div
            className="hidden sm:block absolute -left-6 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--wv-sienna)", opacity: 0.3 }}
          />
          <div
            className="hidden sm:block absolute -left-3 top-1/2 -translate-y-1/2 -translate-x-0.5 w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--wv-redwood)", opacity: 0.2 }}
          />

          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2"
            style={{ color: "var(--wv-cadet)" }}
          >
            what do you have on hand?
          </h1>
          <p
            className="text-sm sm:text-base leading-relaxed"
            style={{ color: "var(--wv-cadet)", opacity: 0.55 }}
          >
            tell us what&apos;s around — cardboard, sticks, fabric, whatever —
            and we&apos;ll find playdates that work with your stuff.
          </p>
        </div>

        <MatcherInputForm
          materials={materials}
          forms={forms}
          slots={slots}
          contexts={contexts}
        />
      </div>
    </main>
  );
}
