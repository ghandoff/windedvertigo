"use client";

import { useState, useMemo } from "react";
import { PlaydateCard } from "./ui/playdate-card";
import type { PlaydateMaterial } from "./ui/playdate-card";

interface PlaydateItem {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  release_channel: string | null;
  status: string;
  primary_function: string | null;
  arc_emphasis: string[];
  context_tags: string[];
  friction_dial: number | null;
  start_in_120s: boolean;
  has_find_again?: boolean;
  run_count: number;
  tinkering_tier: string | null;
  cover_url?: string | null;
  gallery_visible_fields?: string[] | null;
}

type SortKey = "title" | "energy" | "popularity";

const FUNCTION_OPTIONS = [
  "express",
  "inspire",
  "elaborate",
  "build structure",
  "create space / stage",
  "enable movement",
  "connect / stitch",
  "divide / revise",
  "organize / sort",
  "coordinate / share",
  "capture / remember",
];

const ARC_OPTIONS = ["explore", "connect", "transform"];

const ENERGY_OPTIONS = [
  { value: "calm", label: "calm (1–2)", min: 1, max: 2 },
  { value: "moderate", label: "moderate (3)", min: 3, max: 3 },
  { value: "active", label: "active (4–5)", min: 4, max: 5 },
];

interface PlaydateGridProps {
  playdates: PlaydateItem[];
  /** Serializable entries — Maps can't cross the RSC → client boundary */
  packInfoEntries: [string, { packSlug: string; packTitle: string }][];
  /** Serializable material entries per playdate */
  materialsEntries?: [string, PlaydateMaterial[]][];
  showChannelBadge?: boolean;
}

export default function PlaydateGrid({
  playdates,
  packInfoEntries,
  materialsEntries,
  showChannelBadge = false,
}: PlaydateGridProps) {
  const packInfoMap = useMemo(() => new Map(packInfoEntries), [packInfoEntries]);
  const materialsMap = useMemo(() => new Map(materialsEntries ?? []), [materialsEntries]);
  const [search, setSearch] = useState("");
  const [functionFilter, setFunctionFilter] = useState("");
  const [arcFilter, setArcFilter] = useState("");
  const [energyFilter, setEnergyFilter] = useState("");
  const [quickStartOnly, setQuickStartOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("title");

  const filtered = useMemo(() => {
    let items = playdates;

    // text search
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.headline?.toLowerCase().includes(q) ||
          p.primary_function?.toLowerCase().includes(q),
      );
    }

    // function filter
    if (functionFilter) {
      items = items.filter((p) => p.primary_function === functionFilter);
    }

    // arc emphasis filter
    if (arcFilter) {
      items = items.filter((p) => p.arc_emphasis?.includes(arcFilter));
    }

    // energy filter
    if (energyFilter) {
      const opt = ENERGY_OPTIONS.find((o) => o.value === energyFilter);
      if (opt) {
        items = items.filter(
          (p) =>
            p.friction_dial !== null &&
            p.friction_dial >= opt.min &&
            p.friction_dial <= opt.max,
        );
      }
    }

    // quick start
    if (quickStartOnly) {
      items = items.filter((p) => p.start_in_120s);
    }

    // sort
    items = [...items].sort((a, b) => {
      if (sortBy === "energy") {
        return (a.friction_dial ?? 99) - (b.friction_dial ?? 99);
      }
      if (sortBy === "popularity") {
        return (b.run_count ?? 0) - (a.run_count ?? 0);
      }
      return a.title.localeCompare(b.title);
    });

    return items;
  }, [playdates, search, functionFilter, arcFilter, energyFilter, quickStartOnly, sortBy]);

  const hasFilters = search || functionFilter || arcFilter || energyFilter || quickStartOnly;

  return (
    <div>
      {/* filter bar */}
      <div className="mb-6 space-y-3">
        {/* search + sort row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search playdates..."
            className="flex-1 rounded-lg border border-cadet/15 px-3 py-2 text-sm text-cadet placeholder:text-cadet/30 focus:outline-none focus:border-sienna/40 transition-colors"
            style={{ backgroundColor: "var(--wv-cream)" }}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-lg border border-cadet/15 bg-white px-3 py-2 text-sm text-cadet/70 focus:outline-none focus:border-sienna/40 transition-colors"
          >
            <option value="title">sort: a → z</option>
            <option value="energy">sort: energy level</option>
            <option value="popularity">sort: most tried</option>
          </select>
        </div>

        {/* filter pills row */}
        <div className="flex flex-wrap gap-2">
          <select
            value={functionFilter}
            onChange={(e) => setFunctionFilter(e.target.value)}
            className="rounded-full border border-cadet/15 bg-white px-3 py-1.5 text-xs text-cadet/70 focus:outline-none focus:border-sienna/40 transition-colors"
          >
            <option value="">all functions</option>
            {FUNCTION_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <select
            value={arcFilter}
            onChange={(e) => setArcFilter(e.target.value)}
            className="rounded-full border border-cadet/15 bg-white px-3 py-1.5 text-xs text-cadet/70 focus:outline-none focus:border-sienna/40 transition-colors"
          >
            <option value="">all arcs</option>
            {ARC_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            value={energyFilter}
            onChange={(e) => setEnergyFilter(e.target.value)}
            className="rounded-full border border-cadet/15 bg-white px-3 py-1.5 text-xs text-cadet/70 focus:outline-none focus:border-sienna/40 transition-colors"
          >
            <option value="">all energy levels</option>
            {ENERGY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setQuickStartOnly(!quickStartOnly)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              quickStartOnly
                ? "border-sienna/40 bg-sienna/10 text-sienna"
                : "border-cadet/15 bg-white text-cadet/50 hover:border-cadet/30"
            }`}
          >
            ready in 2 min
          </button>

          {hasFilters && (
            <button
              onClick={() => {
                setSearch("");
                setFunctionFilter("");
                setArcFilter("");
                setEnergyFilter("");
                setQuickStartOnly(false);
              }}
              className="rounded-full border border-cadet/15 bg-white px-3 py-1.5 text-xs text-cadet/40 hover:text-cadet/60 transition-colors"
            >
              clear all
            </button>
          )}
        </div>
      </div>

      {/* result count */}
      <p className="text-xs text-cadet/40 mb-4">
        {filtered.length} playdate{filtered.length !== 1 ? "s" : ""}
        {hasFilters ? " matching" : ""}
      </p>

      {/* grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-cadet/40 text-sm">
            no playdates match those filters — try loosening up.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 wv-stagger">
          {filtered.map((p) => {
            const pi = packInfoMap.get(p.id);
            return (
              <div key={p.id} className="relative">
                {showChannelBadge && p.release_channel && p.release_channel !== "sampler" && (
                  <span
                    className={`absolute top-2 left-2 z-10 rounded-full px-2 py-0.5 text-2xs font-semibold tracking-wide ${
                      p.release_channel === "internal-only"
                        ? "bg-cadet/60 text-white/80"
                        : "bg-sienna/70 text-white/90"
                    }`}
                  >
                    {p.release_channel}
                  </span>
                )}
                <PlaydateCard
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
                  packInfo={pi ? { packSlug: pi.packSlug, packTitle: pi.packTitle } : null}
                  tinkeringTier={p.tinkering_tier}
                  coverUrl={p.cover_url}
                  visibleFields={p.gallery_visible_fields}
                  materials={materialsMap.get(p.id) ?? null}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
