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

import { MatcherInputFormProps, Material } from "./types";
import { FilterSection } from "./filter-section";
import { Pill } from "./pill";
import { useMatcherState } from "./use-matcher-state";
import { MatcherResults } from "./matcher-results";

export default function MatcherInputForm({
  materials,
  forms,
  slots,
  contexts,
}: MatcherInputFormProps) {
  const {
    selectedMaterials,
    setSelectedMaterials,
    selectedForms,
    setSelectedForms,
    selectedSlots,
    setSelectedSlots,
    selectedContexts,
    setSelectedContexts,
    materialSearch,
    setMaterialSearch,
    expandedFormGroups,
    loading,
    error,
    results,
    resultsRef,
    filteredMaterialsByForm,
    hasSelection,
    totalSelections,
    toggleSet,
    toggleFormGroup,
    handleSubmit,
    handleClear,
    materialTitleMap,
  } = useMatcherState(materials);

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
                        className="text-xs font-medium uppercase tracking-wider"
                        style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
                      >
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
                      {mats.map((mat: Material) => (
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

      {/* --- results --- */}
      <MatcherResults
        results={results}
        loading={loading}
        resultsRef={resultsRef as React.RefObject<HTMLDivElement>}
        selectedMaterialsSize={selectedMaterials.size}
      />
    </div>
  );
}
