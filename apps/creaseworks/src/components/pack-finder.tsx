"use client";

import { useState } from "react";
import Link from "next/link";

interface Pack {
  slug: string;
  title: string;
  description: string | null;
  playdate_count: number;
  price_cents: number | null;
  currency: string;
}

type Situation = "classroom" | "sibling" | "rainy" | "summer" | "all" | null;

const SITUATIONS: { value: Situation; label: string; detail: string }[] = [
  {
    value: "classroom",
    label: "classroom or group",
    detail: "activities for a class, playgroup, or co-op",
  },
  {
    value: "sibling",
    label: "new baby in the house",
    detail: "play that helps older kids adjust",
  },
  {
    value: "rainy",
    label: "stuck indoors",
    detail: "quick boredom busters, no prep needed",
  },
  {
    value: "summer",
    label: "summer break",
    detail: "outdoor adventures and longer projects",
  },
  {
    value: "all",
    label: "everything!",
    detail: "full access to all 30 playdates",
  },
];

// Mapping from situation to pack slug
const SITUATION_TO_SLUG: Record<string, string> = {
  classroom: "classroom-starter",
  sibling: "new-baby-sibling",
  rainy: "rainy-day-rescue",
  summer: "summer-play-camp",
  all: "the-whole-collection",
};

export default function PackFinder({ packs }: { packs: Pack[] }) {
  const [situation, setSituation] = useState<Situation>(null);
  const [showCompare, setShowCompare] = useState(false);

  const recommendedSlug = situation ? SITUATION_TO_SLUG[situation] : null;
  const recommended = recommendedSlug
    ? packs.find((p) => p.slug === recommendedSlug) ?? null
    : null;

  return (
    <div className="mb-10">
      {/* Guided finder */}
      <div
        className="rounded-xl border p-5 mb-4"
        style={{
          borderColor: "rgba(203, 120, 88, 0.15)",
          backgroundColor: "rgba(203, 120, 88, 0.03)",
        }}
      >
        <h2 className="text-sm font-semibold text-cadet mb-1">
          which pack fits you?
        </h2>
        <p className="text-xs text-cadet/40 mb-4">
          pick what best describes your situation.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {SITUATIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSituation(s.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                situation === s.value
                  ? "bg-redwood text-white"
                  : "bg-cadet/5 text-cadet/60 hover:bg-cadet/10"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* recommendation */}
        {recommended && (
          <div
            className="rounded-lg border px-4 py-3 animate-in fade-in duration-300"
            style={{
              borderColor: "rgba(177, 80, 67, 0.2)",
              backgroundColor: "rgba(177, 80, 67, 0.05)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-redwood/60 mb-0.5">
                  our pick for you
                </p>
                <p className="text-sm font-semibold text-cadet">
                  {recommended.title}
                </p>
                <p className="text-xs text-cadet/50 mt-0.5">
                  {recommended.playdate_count} playdates
                  {recommended.price_cents != null &&
                    ` · $${(recommended.price_cents / 100).toFixed(2)}`}
                </p>
              </div>
              <Link
                href={`/packs/${recommended.slug}`}
                className="shrink-0 rounded-lg bg-redwood px-4 py-2 text-xs font-medium text-white hover:bg-sienna transition-colors"
              >
                view pack
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Compare toggle */}
      <button
        onClick={() => setShowCompare(!showCompare)}
        className="text-xs text-cadet/40 hover:text-cadet/60 transition-colors mb-4"
      >
        {showCompare ? "hide comparison" : "compare all packs"} {showCompare ? "↑" : "↓"}
      </button>

      {/* Comparison table */}
      {showCompare && packs.length > 0 && (
        <div className="rounded-xl border border-cadet/10 overflow-hidden mb-6">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-cadet/3">
                <th className="text-left px-4 py-2.5 font-semibold text-cadet/60">
                  pack
                </th>
                <th className="text-center px-3 py-2.5 font-semibold text-cadet/60">
                  playdates
                </th>
                <th className="text-center px-3 py-2.5 font-semibold text-cadet/60">
                  price
                </th>
                <th className="text-center px-3 py-2.5 font-semibold text-cadet/60">
                  per playdate
                </th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {packs.map((p) => {
                const perPlaydate =
                  p.price_cents != null && p.playdate_count > 0
                    ? (p.price_cents / 100 / p.playdate_count).toFixed(2)
                    : null;
                const isRec = p.slug === recommendedSlug;
                return (
                  <tr
                    key={p.slug}
                    className={`border-t border-cadet/5 ${
                      isRec ? "bg-redwood/3" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium ${
                            isRec ? "text-redwood" : "text-cadet"
                          }`}
                        >
                          {p.title}
                        </span>
                        {isRec && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-redwood/60 bg-redwood/10 px-1.5 py-0.5 rounded-full">
                            pick
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-center px-3 py-3 text-cadet/60">
                      {p.playdate_count}
                    </td>
                    <td className="text-center px-3 py-3 font-medium text-cadet">
                      {p.price_cents != null
                        ? `$${(p.price_cents / 100).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="text-center px-3 py-3 text-cadet/40">
                      {perPlaydate ? `$${perPlaydate}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/packs/${p.slug}`}
                        className="text-redwood hover:text-sienna transition-colors font-medium"
                      >
                        view →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
