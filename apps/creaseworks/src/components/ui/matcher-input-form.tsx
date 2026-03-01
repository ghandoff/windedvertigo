"use client";

/**
 * Matcher input form — interactive client component.
 *
 * Materials picker (grouped by form), forms checklist, slots toggles,
 * context filters, submit, and results rendering.
 *
 * MVP 3 — matcher.
 * Session 12: mobile-first responsive redesign — collapsible accordion
 *   sections, larger touch targets (44px min), sticky submit bar on
 *   mobile, selection summary chips, and responsive result cards.
 */

import { useState, useRef, useMemo, useId } from "react";
import MatcherResultCard from "@/components/ui/matcher-result-card";
import { MaterialIllustration } from "@/components/material-illustration";
import { apiUrl } from "@/lib/api-url";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

interface Material {
  id: string;
  title: string;
  form_primary: string;
}

interface MatcherInputFormProps {
  materials: Material[];
  forms: string[];
  slots: string[];
  contexts: string[];
}

interface MatcherResult {
  ranked: any[];
  meta: {
    contextFiltersApplied: string[];
    totalCandidates: number;
    totalAfterFilter: number;
  };
}

/* ------------------------------------------------------------------ */
/*  collapsible section component                                      */
/* ------------------------------------------------------------------ */

/**
 * Accordion-style section that starts expanded on desktop, collapsed on
 * mobile (via the defaultOpen prop). Shows a count badge when items are
 * selected and the section is collapsed.
 */
function FilterSection({
  title,
  subtitle,
  selectedCount,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  selectedCount: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section
      className="rounded-xl border transition-colors"
      style={{ borderColor: "rgba(39, 50, 72, 0.1)", backgroundColor: "var(--wv-white)" }}
    >
      {/* section header — always visible, acts as toggle */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <h2
            className="text-sm font-semibold truncate"
            style={{ color: "var(--wv-cadet)", opacity: 0.8 }}
          >
            {title}
          </h2>
          {selectedCount > 0 && (
            <span
              className="flex-shrink-0 inline-flex items-center justify-center rounded-full text-xs font-medium"
              style={{
                backgroundColor: "var(--wv-redwood)",
                color: "var(--wv-white)",
                minWidth: 22,
                height: 22,
                padding: "0 6px",
              }}
            >
              {selectedCount}
            </span>
          )}
        </div>
        {/* chevron indicator */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="flex-shrink-0 transition-transform duration-200"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            opacity: 0.4,
          }}
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="var(--wv-cadet)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* collapsible body */}
      {open && (
        <div id={panelId} role="region" className="px-4 pb-4 sm:px-5 sm:pb-5">
          {subtitle && (
            <p
              className="text-xs mb-3"
              style={{ color: "var(--wv-cadet)", opacity: 0.45 }}
            >
              {subtitle}
            </p>
          )}
          {children}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  pill button component — 44px min touch target                      */
/* ------------------------------------------------------------------ */

function Pill({
  label,
  selected,
  accentColor = "var(--wv-redwood)",
  onClick,
}: {
  label: string;
  selected: boolean;
  accentColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3.5 py-2 text-sm sm:text-xs sm:px-3 sm:py-1.5 transition-all border select-none active:scale-95"
      style={{
        backgroundColor: selected ? accentColor : "transparent",
        color: selected ? "var(--wv-white)" : "var(--wv-cadet)",
        borderColor: selected ? accentColor : "rgba(39, 50, 72, 0.2)",
        opacity: selected ? 1 : 0.7,
        minHeight: 44,
      }}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  main component                                                     */
/* ------------------------------------------------------------------ */

export default function MatcherInputForm({
  materials,
  forms,
  slots,
  contexts,
}: MatcherInputFormProps) {
  // selection state
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(
    new Set(),
  );
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set());
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [selectedContexts, setSelectedContexts] = useState<Set<string>>(
    new Set(),
  );

  // search filter for materials
  const [materialSearch, setMaterialSearch] = useState("");

  // mobile: track which material form-groups are expanded
  const [expandedFormGroups, setExpandedFormGroups] = useState<Set<string>>(
    new Set(),
  );

  // submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MatcherResult | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // group materials by form_primary
  const materialsByForm = useMemo(() => {
    const groups = new Map<string, Material[]>();
    for (const mat of materials) {
      const form = mat.form_primary || "other";
      const list = groups.get(form) ?? [];
      list.push(mat);
      groups.set(form, list);
    }
    return groups;
  }, [materials]);

  // filter materials by search term
  const filteredMaterialsByForm = useMemo(() => {
    if (!materialSearch.trim()) return materialsByForm;
    const query = materialSearch.toLowerCase();
    const filtered = new Map<string, Material[]>();
    for (const [form, mats] of materialsByForm) {
      const matching = mats.filter(
        (m: Material) =>
          m.title.toLowerCase().includes(query) ||
          form.toLowerCase().includes(query),
      );
      if (matching.length > 0) filtered.set(form, matching);
    }
    return filtered;
  }, [materialsByForm, materialSearch]);

  const hasSelection =
    selectedMaterials.size > 0 ||
    selectedForms.size > 0 ||
    selectedSlots.size > 0 ||
    selectedContexts.size > 0;

  const totalSelections =
    selectedMaterials.size +
    selectedForms.size +
    selectedSlots.size +
    selectedContexts.size;

  // toggle helpers
  function toggleSet(
    set: Set<string>,
    setter: (s: Set<string>) => void,
    value: string,
  ) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  function toggleFormGroup(form: string) {
    const next = new Set(expandedFormGroups);
    if (next.has(form)) next.delete(form);
    else next.add(form);
    setExpandedFormGroups(next);
  }

  async function handleSubmit() {
    if (!hasSelection) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/matcher"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materials: Array.from(selectedMaterials),
          forms: Array.from(selectedForms),
          slots: Array.from(selectedSlots),
          contexts: Array.from(selectedContexts),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `request failed (${res.status})`);
      }

      const data: MatcherResult = await res.json();
      setResults(data);

      // scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      setError(err.message || "something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setSelectedMaterials(new Set());
    setSelectedForms(new Set());
    setSelectedSlots(new Set());
    setSelectedContexts(new Set());
    setMaterialSearch("");
    setExpandedFormGroups(new Set());
    setResults(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // resolve material titles for the selection summary
  const materialTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const mat of materials) map.set(mat.id, mat.title);
    return map;
  }, [materials]);

  return (
    <div>
      {/* --- input form --- */}
      <div className="space-y-3 sm:space-y-4">
        {/* ---- materials picker ---- */}
        <FilterSection
          title="materials you have on hand"
          selectedCount={selectedMaterials.size}
          defaultOpen={true}
        >
          {/* search bar — larger touch target on mobile */}
          <input
            type="text"
            placeholder="search materials…"
            aria-label="search materials"
            value={materialSearch}
            onChange={(e) => setMaterialSearch(e.target.value)}
            className="w-full rounded-lg border px-4 py-3 sm:px-3 sm:py-2 text-sm mb-3 outline-none focus:ring-2"
            style={{
              borderColor: "rgba(39, 50, 72, 0.15)",
              color: "var(--wv-cadet)",
              minHeight: 44,
            }}
          />

          {/* materials grouped by form, each sub-group collapsible on mobile */}
          <div
            className="space-y-1 max-h-[50vh] sm:max-h-72 overflow-y-auto rounded-lg border p-2 sm:p-3 -webkit-overflow-scrolling-touch"
            style={{ borderColor: "rgba(39, 50, 72, 0.1)" }}
          >
            {Array.from(filteredMaterialsByForm.entries()).map(
              ([form, mats]) => {
                // on mobile, collapse form groups by default to reduce scroll
                const groupSelected = mats.filter((m) =>
                  selectedMaterials.has(m.id),
                ).length;
                const isExpanded = expandedFormGroups.has(form);

                return (
                  <div key={form} className="py-1">
                    {/* form group header — tappable to expand/collapse */}
                    <button
                      type="button"
                      onClick={() => toggleFormGroup(form)}
                      className="w-full flex items-center justify-between py-2 px-1 sm:py-1 sm:px-0 text-left"
                    >
                      <span
                        className="text-xs font-medium tracking-wider"
                        style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
                      >
                        
                                                <MaterialIllustration formPrimary={form} size={18} />
                                                {form}
                        {groupSelected > 0 && (
                          <span
                            className="ml-1.5 normal-case tracking-normal"
                            style={{ color: "var(--wv-redwood)", opacity: 1 }}
                          >
                            ({groupSelected})
                          </span>
                        )}
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="flex-shrink-0 transition-transform duration-150 sm:hidden"
                        style={{
                          transform: isExpanded
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          opacity: 0.3,
                        }}
                      >
                        <path
                          d="M4 6L8 10L12 6"
                          stroke="var(--wv-cadet)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    {/* material pills — always visible on desktop (sm+),
                        collapsible on mobile */}
                    <div
                      className={`flex flex-wrap gap-2 mt-1 ${
                        isExpanded ? "" : "hidden sm:flex"
                      }`}
                    >
                      {mats.map((mat) => (
                        <Pill
                          key={mat.id}
                          label={mat.title}
                          selected={selectedMaterials.has(mat.id)}
                          onClick={() =>
                            toggleSet(
                              selectedMaterials,
                              setSelectedMaterials,
                              mat.id,
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              },
            )}
            {filteredMaterialsByForm.size === 0 && (
              <p
                className="text-xs py-4 text-center"
                style={{ color: "var(--wv-cadet)", opacity: 0.4 }}
              >
                no materials match your search.
              </p>
            )}
          </div>

          {/* selected summary chips — mobile-friendly scrollable row */}
          {selectedMaterials.size > 0 && (
            <div className="mt-3">
              <p
                className="text-xs mb-1.5"
                style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
              >
                {selectedMaterials.size} material
                {selectedMaterials.size !== 1 ? "s" : ""} selected
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedMaterials).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-label="remove"
                    onClick={() =>
                      toggleSet(
                        selectedMaterials,
                        setSelectedMaterials,
                        id,
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all active:scale-95"
                    style={{
                      backgroundColor: "rgba(177, 80, 67, 0.1)",
                      color: "var(--wv-redwood)",
                    }}
                  >
                    {materialTitleMap.get(id) ?? id}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M5 5L11 11M11 5L5 11"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </FilterSection>

        {/* ---- forms checklist ---- */}
        <FilterSection
          title="types of materials"
          selectedCount={selectedForms.size}
          defaultOpen={true}
        >
          <div className="flex flex-wrap gap-2">
            {forms.map((form) => (
              <Pill
                key={form}
                label={form}
                selected={selectedForms.has(form)}
                onClick={() =>
                  toggleSet(selectedForms, setSelectedForms, form)
                }
              />
            ))}
          </div>
        </FilterSection>

        {/* ---- context constraints ---- */}
        <FilterSection
          title="where are you playing?"
          subtitle="we'll only show playdates that work in all of these."
          selectedCount={selectedContexts.size}
          defaultOpen={true}
        >
          <div className="flex flex-wrap gap-2">
            {contexts.map((ctx) => (
              <Pill
                key={ctx}
                label={ctx}
                selected={selectedContexts.has(ctx)}
                accentColor="var(--wv-sienna)"
                onClick={() =>
                  toggleSet(selectedContexts, setSelectedContexts, ctx)
                }
              />
            ))}
          </div>
        </FilterSection>

        {/* ---- slots (optional) ---- */}
        {slots.length > 0 && (
          <FilterSection
            title="extras (optional)"
            subtitle="we'll bump up playdates that use these."
            selectedCount={selectedSlots.size}
            defaultOpen={false}
          >
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <Pill
                  key={slot}
                  label={slot}
                  selected={selectedSlots.has(slot)}
                  accentColor="var(--wv-sienna)"
                  onClick={() =>
                    toggleSet(selectedSlots, setSelectedSlots, slot)
                  }
                />
              ))}
            </div>
          </FilterSection>
        )}

        {/* ---- actions — desktop inline, mobile sticky bottom bar ---- */}
        <div className="hidden sm:flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!hasSelection || loading}
            aria-describedby={error ? "matcher-error" : undefined}
            className="rounded-lg px-6 py-2.5 text-sm font-medium transition-all disabled:opacity-40"
            style={{
              backgroundColor: "var(--wv-redwood)",
              color: "var(--wv-white)",
            }}
          >
            {loading ? "matching…" : "find playdates"}
          </button>

          {hasSelection && (
            <button
              type="button"
              onClick={handleClear}
              className="text-sm transition-opacity hover:opacity-80"
              style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
            >
              clear all
            </button>
          )}
        </div>

        {error && (
          <p id="matcher-error" className="text-sm mt-2" style={{ color: "var(--wv-redwood)" }}>
            {error}
          </p>
        )}
      </div>

      {/* ---- mobile sticky action bar ---- */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-4 pt-3 sm:hidden"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(39, 50, 72, 0.1)",
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
        }}
      >
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasSelection || loading}
          aria-describedby={error ? "matcher-error" : undefined}
          className="flex-1 rounded-lg py-3.5 text-sm font-medium transition-all disabled:opacity-40 active:scale-[0.98]"
          style={{
            backgroundColor: "var(--wv-redwood)",
            color: "var(--wv-white)",
            minHeight: 48,
          }}
        >
          {loading
            ? "matching…"
            : hasSelection
              ? `find playdates (${totalSelections} filter${totalSelections !== 1 ? "s" : ""})`
              : "select filters to start"}
        </button>

        {hasSelection && (
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 rounded-lg py-3.5 px-4 text-sm transition-opacity active:scale-95"
            style={{
              color: "var(--wv-cadet)",
              opacity: 0.5,
              minHeight: 48,
            }}
          >
            clear
          </button>
        )}
      </div>

      {/* spacer for mobile sticky bar so content isn't hidden behind it */}
      <div className="h-20 sm:hidden" />

      {/* --- loading skeleton --- */}
      {loading && (
        <div className="mt-8 sm:mt-12 space-y-3" aria-busy="true" aria-label="loading results">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border animate-pulse h-32"
              style={{
                borderColor: "rgba(39, 50, 72, 0.06)",
                backgroundColor: "rgba(39, 50, 72, 0.04)",
              }}
            />
          ))}
        </div>
      )}

      {/* --- results --- */}
      {results && !loading && (
        <div ref={resultsRef} className="mt-8 sm:mt-12" role="region" aria-label="matcher results" aria-live="polite">
          <div className="mb-4 sm:mb-6">
            <h2
              className="text-lg sm:text-xl font-semibold tracking-tight mb-1"
              style={{ color: "var(--wv-cadet)" }}
            >
              {results.ranked.length} playdate
              {results.ranked.length !== 1 ? "s" : ""} found
            </h2>
            <p
              className="text-xs"
              style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
            >
              searched {results.meta.totalCandidates} playdates
              {results.meta.contextFiltersApplied.length > 0 &&
                ` · ${results.meta.totalAfterFilter} fit your setting (${results.meta.contextFiltersApplied.join(", ")})`}
            </p>
          </div>

          {results.ranked.length === 0 ? (
            <div
              className="rounded-xl border p-6 sm:p-8 text-center"
              style={{ borderColor: "rgba(39, 50, 72, 0.1)", backgroundColor: "var(--wv-white)" }}
            >
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
              >
                {results.meta.contextFiltersApplied.length > 0
                  ? `no playdates match all of your setting constraints — try removing ${results.meta.contextFiltersApplied.join(" or ")} to see more.`
                  : selectedMaterials.size > 3
                    ? "we couldn't find a perfect fit — try selecting fewer materials to broaden the search."
                    : "nothing matched yet. try adding more materials or changing where you're playing."}
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {results.ranked.map((playdate) => (
                <MatcherResultCard
                  key={playdate.playdateId}
                  playdate={playdate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

