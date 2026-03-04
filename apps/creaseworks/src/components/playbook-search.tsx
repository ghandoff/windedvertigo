"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import CollectionCard from "@/components/ui/collection-card";
import { apiUrl } from "@/lib/api-url";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

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

interface PlaydateResult {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  primary_function: string | null;
  cover_url: string | null;
  collection_title: string | null;
  collection_slug: string | null;
  match_field: string;
}

type Filter = "all" | "not-tried" | "in-progress" | "completed";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "all" },
  { value: "not-tried", label: "not tried" },
  { value: "in-progress", label: "in progress" },
  { value: "completed", label: "completed" },
];

/* ------------------------------------------------------------------ */
/*  debounce hook                                                      */
/* ------------------------------------------------------------------ */

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ------------------------------------------------------------------ */
/*  component                                                          */
/* ------------------------------------------------------------------ */

export default function PlaybookSearch({
  collections,
  hasProgress,
}: {
  collections: CollectionItem[];
  hasProgress: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [playdateResults, setPlaydateResults] = useState<PlaydateResult[]>([]);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce the query for server-side search (300ms)
  const debouncedQuery = useDebouncedValue(query, 300);

  // ── client-side collection filtering (instant) ──
  const filteredCollections = useMemo(() => {
    let result = collections;

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)),
      );
    }

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

  // ── server-side playdate search (debounced) ──
  const fetchPlaydates = useCallback(async (q: string) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();

    if (q.length < 2) {
      setPlaydateResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);

    try {
      const res = await fetch(
        apiUrl(`/api/search?q=${encodeURIComponent(q)}`),
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error("search failed");
      const data = await res.json();
      setPlaydateResults(data.playdates ?? []);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("[search]", err);
        setPlaydateResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchPlaydates(debouncedQuery);
  }, [debouncedQuery, fetchPlaydates]);

  const showFilters = hasProgress;
  const isSearching = query.trim().length >= 2;
  const hasPlaydateResults = playdateResults.length > 0;

  return (
    <div>
      {/* search bar */}
      <div className="mb-4 relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search playdates and collections…"
          className="w-full rounded-lg border border-cadet/10 bg-white px-4 py-2.5 text-sm text-cadet placeholder:text-cadet/30 focus:outline-none focus:border-sienna/40 focus:ring-1 focus:ring-sienna/20 transition-colors"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div
              className="w-4 h-4 border-2 rounded-full animate-spin"
              style={{ borderColor: "#e8ddd0", borderTopColor: "#cb7858" }}
            />
          </div>
        )}
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

      {/* ── playdate results (server-side, only when searching) ── */}
      {isSearching && hasPlaydateResults && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-cadet/40 mb-3">
            playdates
          </h3>
          <div className="space-y-1.5">
            {playdateResults.map((p) => (
              <Link
                key={p.id}
                href={
                  p.collection_slug
                    ? `/playbook/${p.collection_slug}`
                    : `/sampler/${p.slug}`
                }
                className="flex items-center gap-3 rounded-lg border border-cadet/5 px-4 py-3 hover:border-sienna/20 hover:bg-champagne/5 transition-colors"
              >
                {p.cover_url ? (
                  <div className="relative w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                    <Image
                      src={p.cover_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-md bg-champagne/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm opacity-40">🎨</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-cadet truncate">
                    {p.title}
                  </p>
                  <p className="text-2xs text-cadet/40 truncate">
                    {p.headline ??
                      (p.collection_title
                        ? `in ${p.collection_title}`
                        : p.primary_function ?? "")}
                  </p>
                </div>
                {p.match_field !== "title" && (
                  <span className="text-2xs text-cadet/20 flex-shrink-0">
                    {p.match_field === "material"
                      ? "material match"
                      : p.match_field === "description"
                        ? "description"
                        : p.match_field === "headline"
                          ? "headline"
                          : ""}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── collection heading (when both sections are shown) ── */}
      {isSearching && hasPlaydateResults && filteredCollections.length > 0 && (
        <h3 className="text-xs font-semibold uppercase tracking-widest text-cadet/40 mb-3">
          collections
        </h3>
      )}

      {/* ── collection results (client-side) ── */}
      {filteredCollections.length === 0 && !hasPlaydateResults ? (
        <p className="text-sm text-cadet/40 py-8 text-center">
          {query.trim()
            ? `nothing matching "${query}"`
            : "no collections match that filter."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 mb-12">
          {filteredCollections.map((c) => (
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
      {(query.trim() || filter !== "all") &&
        (filteredCollections.length > 0 || hasPlaydateResults) && (
          <p className="text-2xs text-cadet/30 -mt-10 mb-12 text-center">
            {isSearching && hasPlaydateResults
              ? `${playdateResults.length} playdate${playdateResults.length !== 1 ? "s" : ""}, `
              : ""}
            {filteredCollections.length} of {collections.length} collection
            {collections.length !== 1 ? "s" : ""}
          </p>
        )}
    </div>
  );
}
