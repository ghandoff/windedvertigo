"use client";

import { useState, useMemo } from "react";
import CollectionCard from "@/components/ui/collection-card";

interface CollectionItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon_emoji: string | null;
  cover_url: string | null;
  playdate_count: number;
  tried_count: number;
  found_count: number;
  folded_count: number;
  found_again_count: number;
  evidence_count: number;
}

type Filter = "all" | "not-tried" | "in-progress" | "completed";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "all" },
  { value: "not-tried", label: "not tried" },
  { value: "in-progress", label: "in progress" },
  { value: "completed", label: "completed" },
];

export default function PlaybookSearch({
  collections,
  hasProgress,
}: {
  collections: CollectionItem[];
  hasProgress: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    let result = collections;

    // text search
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)),
      );
    }

    // filter chips
    if (filter === "not-tried") {
      result = result.filter((c) => c.tried_count === 0);
    } else if (filter === "in-progress") {
      result = result.filter(
        (c) => c.tried_count > 0 && c.tried_count < c.playdate_count,
      );
    } else if (filter === "completed") {
      result = result.filter((c) => c.tried_count >= c.playdate_count);
    }

    return result;
  }, [collections, query, filter]);

  // only show filter chips if user has some progress
  const showFilters = hasProgress;

  return (
    <div>
      {/* search bar */}
      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search collections…"
          className="w-full rounded-lg border border-cadet/10 bg-white px-4 py-2.5 text-sm text-cadet placeholder:text-cadet/30 focus:outline-none focus:border-sienna/40 focus:ring-1 focus:ring-sienna/20 transition-colors"
        />
      </div>

      {/* filter chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                filter === f.value
                  ? "bg-redwood text-white"
                  : "bg-cadet/5 text-cadet/50 hover:bg-cadet/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* results */}
      {filtered.length === 0 ? (
        <p className="text-sm text-cadet/40 py-8 text-center">
          {query.trim()
            ? `no collections matching "${query}"`
            : "no collections match that filter."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 mb-12">
          {filtered.map((c) => (
            <CollectionCard
              key={c.id}
              slug={c.slug}
              title={c.title}
              description={c.description}
              iconEmoji={c.icon_emoji}
              playdateCount={c.playdate_count}
              progress={
                hasProgress
                  ? {
                      tried: c.tried_count,
                      found: c.found_count,
                      folded: c.folded_count,
                      foundAgain: c.found_again_count,
                    }
                  : null
              }
              evidenceCount={c.evidence_count}
              coverUrl={c.cover_url}
            />
          ))}
        </div>
      )}

      {/* result count when filtered */}
      {(query.trim() || filter !== "all") && filtered.length > 0 && (
        <p className="text-[10px] text-cadet/30 -mt-10 mb-12 text-center">
          showing {filtered.length} of {collections.length} collection
          {collections.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
