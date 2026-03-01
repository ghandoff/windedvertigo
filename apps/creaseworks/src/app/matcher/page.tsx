/**
 * /matcher — playdate finder.
 *
 * The most playful page in creaseworks. A child should be able to
 * look at this and know exactly what to do: pick your stuff, pick
 * your place, and find something fun to make together.
 *
 * Server component that fetches picker data and passes to the
 * client-side form component.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "playdate finder",
  description:
    "tell us what stuff you have around the house and we'll find playdates that work. cardboard, sticks, fabric, tape — whatever you can find!",
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
      className="min-h-screen px-4 pt-8 pb-24 sm:px-6 sm:pt-14 sm:pb-16"
      style={{
        background:
          "linear-gradient(175deg, rgba(255,235,210,0.25) 0%, rgba(228,196,137,0.06) 30%, rgba(255,255,255,0) 55%)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <Link
          href="/"
          className="text-sm hover:opacity-80 transition-opacity mb-5 sm:mb-7 inline-flex items-center gap-1.5"
          style={{ color: "var(--wv-cadet)", opacity: 0.45 }}
        >
          <span>&larr;</span> creaseworks
        </Link>

        {/* ── playful hero heading ──────────────────────────── */}
        <div className="relative mb-8 sm:mb-10">
          {/* decorative floating shapes — desktop only */}
          <div
            className="hidden sm:block absolute -left-10 top-2 w-5 h-5 rounded-lg"
            style={{
              backgroundColor: "var(--wv-champagne)",
              opacity: 0.4,
              transform: "rotate(12deg)",
            }}
          />
          <div
            className="hidden sm:block absolute -left-6 top-12 w-3 h-3 rounded-full"
            style={{
              backgroundColor: "var(--wv-sienna)",
              opacity: 0.25,
            }}
          />
          <div
            className="hidden sm:block absolute -right-6 top-4 w-4 h-4 rounded-full"
            style={{
              backgroundColor: "var(--wv-redwood)",
              opacity: 0.15,
            }}
          />

          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-3"
            style={{ color: "var(--wv-cadet)" }}
          >
            let&apos;s find something to make!{" "}
            <span
              className="inline-block"
              style={{
                animation:
                  "heroWave 2s ease-in-out infinite",
              }}
            >
              🎨
            </span>
          </h1>
          <p
            className="text-base sm:text-lg leading-relaxed max-w-xl"
            style={{ color: "var(--wv-cadet)", opacity: 0.55 }}
          >
            look around — what stuff do you have? cardboard boxes, sticks, old
            t-shirts, tape? pick what you find and we&apos;ll show you something
            amazing to make together.
          </p>
        </div>

        <MatcherInputForm
          materials={materials}
          forms={forms}
          slots={slots}
          contexts={contexts}
        />
      </div>

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
