"use client";

/**
 * Matcher input form — playful, child-friendly material picker.
 *
 * Transforms the filter experience from a boring form into a treasure
 * hunt: kids and parents pick what's around the house, choose where
 * they're playing, and hit the big bouncy "let's play!" button.
 *
 * Child-accessible: large touch targets, emoji-rich pills, simple
 * language, visual feedback, and a "treasure basket" showing picks.
 */

import { MatcherInputFormProps, Material } from "./types";
import { FilterSection } from "./filter-section";
import { Pill } from "./pill";
import { useMatcherState } from "./use-matcher-state";
import { MatcherResults } from "./matcher-results";
import { getMaterialEmoji } from "./material-emoji";

/* ── emoji maps for material forms ────────────────────────────────── */

const FORM_EMOJI: Record<string, string> = {
  paper: "📄",
  cardboard: "📦",
  fabric: "🧵",
  wood: "🪵",
  plastic: "🫙",
  metal: "🔩",
  natural: "🌿",
  food: "🍎",
  clay: "🏺",
  string: "🧶",
  tape: "🩹",
  paint: "🎨",
  recycled: "♻️",
  found: "🔍",
  other: "✨",
};

const CONTEXT_EMOJI: Record<string, string> = {
  indoors: "🏠",
  outdoors: "🌳",
  kitchen: "🍳",
  garden: "🌻",
  park: "🏞️",
  beach: "🏖️",
  classroom: "🏫",
  car: "🚗",
  "rainy day": "🌧️",
  quiet: "🤫",
  messy: "🎨",
};

const SLOT_EMOJI: Record<string, string> = {
  scissors: "✂️",
  glue: "🫗",
  markers: "🖍️",
  water: "💧",
  oven: "🔥",
  hammer: "🔨",
};

function getEmoji(
  map: Record<string, string>,
  key: string,
  fallback = "✨",
): string {
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (lower.includes(k)) return v;
  }
  return fallback;
}

/* ── component ────────────────────────────────────────────────────── */

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
    materialFormMap,
  } = useMatcherState(materials);

  return (
    <div>
      {/* --- treasure basket: selected items float at top --- */}
      {hasSelection && (
        <div
          className="mb-5 rounded-2xl border-2 border-dashed px-5 py-4"
          style={{
            borderColor: "rgba(203, 120, 88, 0.3)",
            backgroundColor: "rgba(255, 235, 210, 0.15)",
            animation: "basketAppear 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🧺</span>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--wv-sienna)" }}
            >
              your treasure basket
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--wv-cadet)", opacity: 0.4 }}
            >
              {totalSelections} thing{totalSelections !== 1 ? "s" : ""} picked
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedMaterials).map((id) => (
              <button
                key={id}
                type="button"
                aria-label={`remove ${materialTitleMap.get(id) ?? id}`}
                onClick={() =>
                  toggleSet(selectedMaterials, setSelectedMaterials, id)
                }
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-90"
                style={{
                  backgroundColor: "rgba(177, 80, 67, 0.12)",
                  color: "var(--wv-redwood)",
                }}
              >
                <span>{getMaterialEmoji(materialTitleMap.get(id) ?? id, materialFormMap.get(id))}</span>
                {materialTitleMap.get(id) ?? id}
                <span style={{ fontSize: "0.9em", opacity: 0.6 }}>✕</span>
              </button>
            ))}
            {Array.from(selectedForms).map((f) => (
              <button
                key={`form-${f}`}
                type="button"
                aria-label={`remove ${f}`}
                onClick={() => toggleSet(selectedForms, setSelectedForms, f)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-90"
                style={{
                  backgroundColor: "rgba(203, 120, 88, 0.12)",
                  color: "var(--wv-sienna)",
                }}
              >
                {f}
                <span style={{ fontSize: "0.9em", opacity: 0.6 }}>✕</span>
              </button>
            ))}
            {Array.from(selectedContexts).map((c) => (
              <button
                key={`ctx-${c}`}
                type="button"
                aria-label={`remove ${c}`}
                onClick={() =>
                  toggleSet(selectedContexts, setSelectedContexts, c)
                }
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-90"
                style={{
                  backgroundColor: "rgba(203, 120, 88, 0.1)",
                  color: "var(--wv-sienna)",
                }}
              >
                {getEmoji(CONTEXT_EMOJI, c)} {c}
                <span style={{ fontSize: "0.9em", opacity: 0.6 }}>✕</span>
              </button>
            ))}
            {Array.from(selectedSlots).map((s) => (
              <button
                key={`slot-${s}`}
                type="button"
                aria-label={`remove ${s}`}
                onClick={() => toggleSet(selectedSlots, setSelectedSlots, s)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-90"
                style={{
                  backgroundColor: "rgba(228, 196, 137, 0.2)",
                  color: "var(--wv-cadet)",
                  opacity: 0.7,
                }}
              >
                {getEmoji(SLOT_EMOJI, s, "⭐")} {s}
                <span style={{ fontSize: "0.9em", opacity: 0.6 }}>✕</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- input sections --- */}
      <div className="space-y-4">
        {/* ---- materials: "what's around the house?" ---- */}
        <FilterSection
          title="what's around the house?"
          subtitle="tap everything you can find!"
          emoji="🔎"
          selectedCount={selectedMaterials.size}
          defaultOpen={true}
        >
          {/* search bar — friendly placeholder */}
          <div className="relative mb-3">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base pointer-events-none"
              style={{ opacity: 0.4 }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="search for stuff…"
              aria-label="search materials"
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
              className="w-full rounded-xl border pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sienna/30"
              style={{
                borderColor: "rgba(39, 50, 72, 0.1)",
                color: "var(--wv-cadet)",
                minHeight: 48,
                backgroundColor: "rgba(255, 255, 255, 0.8)",
              }}
            />
          </div>

          {/* materials grouped by form — each group is a mini treasure trove */}
          <div
            className="space-y-2 max-h-[55vh] overflow-y-auto rounded-xl border p-3 -webkit-overflow-scrolling-touch"
            style={{
              borderColor: "rgba(39, 50, 72, 0.06)",
              backgroundColor: "rgba(255, 255, 255, 0.5)",
            }}
          >
            {Array.from(filteredMaterialsByForm.entries()).map(
              ([form, mats]) => {
                const groupSelected = mats.filter((m) =>
                  selectedMaterials.has(m.id),
                ).length;
                const isExpanded = expandedFormGroups.has(form);
                const formEmoji =
                  FORM_EMOJI[form.toLowerCase()] ?? FORM_EMOJI.other;

                return (
                  <div key={form} className="py-1">
                    {/* form group header */}
                    <button
                      type="button"
                      onClick={() => toggleFormGroup(form)}
                      className="w-full flex items-center justify-between py-2 px-2 text-left rounded-lg hover:bg-champagne/20 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">{formEmoji}</span>
                        <span
                          className="text-xs font-bold uppercase tracking-wider"
                          style={{ color: "var(--wv-cadet)", opacity: 0.6 }}
                        >
                          {form}
                        </span>
                        {groupSelected > 0 && (
                          <span
                            className="text-xs font-bold"
                            style={{ color: "var(--wv-redwood)" }}
                          >
                            ({groupSelected})
                          </span>
                        )}
                      </span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="flex-shrink-0 sm:hidden"
                        style={{
                          transition:
                            "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
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

                    {/* material pills — always visible on desktop, collapsible on mobile */}
                    <div
                      className={`flex flex-wrap gap-2 mt-1.5 ${
                        isExpanded ? "" : "hidden sm:flex"
                      }`}
                    >
                      {mats.map((mat: Material) => (
                        <Pill
                          key={mat.id}
                          label={mat.title}
                          emoji={getMaterialEmoji(mat.title, mat.form_primary)}
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
                className="text-sm py-6 text-center"
                style={{ color: "var(--wv-cadet)", opacity: 0.4 }}
              >
                hmm, nothing matches that search. try a different word!
              </p>
            )}
          </div>
        </FilterSection>

        {/* ---- forms: "what kind of stuff?" ---- */}
        <FilterSection
          title="what kind of stuff?"
          subtitle="pick the types of materials you like to use."
          emoji="🧩"
          selectedCount={selectedForms.size}
          defaultOpen={true}
        >
          <div className="flex flex-wrap gap-2">
            {forms.map((form) => (
              <Pill
                key={form}
                label={form}
                emoji={FORM_EMOJI[form.toLowerCase()] ?? "✨"}
                selected={selectedForms.has(form)}
                onClick={() =>
                  toggleSet(selectedForms, setSelectedForms, form)
                }
              />
            ))}
          </div>
        </FilterSection>

        {/* ---- context: "where's the fun happening?" ---- */}
        <FilterSection
          title="where's the fun happening?"
          subtitle="we'll only show playdates that work here."
          emoji="🗺️"
          selectedCount={selectedContexts.size}
          defaultOpen={true}
        >
          <div className="flex flex-wrap gap-2">
            {contexts.map((ctx) => (
              <Pill
                key={ctx}
                label={ctx}
                emoji={getEmoji(CONTEXT_EMOJI, ctx, "📍")}
                selected={selectedContexts.has(ctx)}
                accentColor="var(--wv-sienna)"
                onClick={() =>
                  toggleSet(selectedContexts, setSelectedContexts, ctx)
                }
              />
            ))}
          </div>
        </FilterSection>

        {/* ---- slots: "bonus stuff!" ---- */}
        {slots.length > 0 && (
          <FilterSection
            title="bonus stuff!"
            subtitle="got any of these? we'll find even more playdates."
            emoji="⭐"
            selectedCount={selectedSlots.size}
            defaultOpen={false}
          >
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <Pill
                  key={slot}
                  label={slot}
                  emoji={getEmoji(SLOT_EMOJI, slot, "⭐")}
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

        {/* ---- desktop: big playful action button ---- */}
        <div className="hidden sm:flex items-center gap-4 pt-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!hasSelection || loading}
            aria-describedby={error ? "matcher-error" : undefined}
            className="rounded-2xl px-8 py-4 text-base font-bold transition-all disabled:opacity-30 active:scale-95"
            style={{
              backgroundColor: "var(--wv-redwood)",
              color: "var(--wv-white)",
              boxShadow: hasSelection
                ? "0 4px 20px rgba(177, 80, 67, 0.3)"
                : "none",
              transform: hasSelection ? "scale(1)" : "scale(0.98)",
              transition:
                "all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {loading ? (
              <>
                <span className="inline-block animate-spin mr-2">🔮</span>
                searching…
              </>
            ) : (
              <>let&apos;s play! 🎉</>
            )}
          </button>

          {hasSelection && (
            <button
              type="button"
              onClick={handleClear}
              className="text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--wv-cadet)", opacity: 0.45 }}
            >
              start over
            </button>
          )}
        </div>

        {error && (
          <p
            id="matcher-error"
            className="text-sm mt-2"
            style={{ color: "var(--wv-redwood)" }}
          >
            {error}
          </p>
        )}
      </div>

      {/* ---- mobile sticky action bar ---- */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-4 pt-3 sm:hidden"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.97)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "2px solid rgba(203, 120, 88, 0.15)",
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
        }}
      >
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasSelection || loading}
          aria-describedby={error ? "matcher-error" : undefined}
          className="flex-1 rounded-2xl py-4 text-base font-bold transition-all disabled:opacity-30 active:scale-[0.97]"
          style={{
            backgroundColor: "var(--wv-redwood)",
            color: "var(--wv-white)",
            minHeight: 52,
            boxShadow: hasSelection
              ? "0 4px 16px rgba(177, 80, 67, 0.25)"
              : "none",
          }}
        >
          {loading ? (
            <>
              <span className="inline-block animate-spin mr-2">🔮</span>
              searching…
            </>
          ) : hasSelection ? (
            <>
              let&apos;s play! 🎉{" "}
              <span className="opacity-60">
                ({totalSelections})
              </span>
            </>
          ) : (
            "pick some stuff to start!"
          )}
        </button>

        {hasSelection && (
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 rounded-xl py-3.5 px-4 text-sm font-medium transition-opacity active:scale-95"
            style={{
              color: "var(--wv-cadet)",
              opacity: 0.45,
              minHeight: 48,
            }}
          >
            clear
          </button>
        )}
      </div>

      {/* spacer for mobile sticky bar */}
      <div className="h-24 sm:hidden" />

      {/* --- results --- */}
      <MatcherResults
        results={results}
        loading={loading}
        resultsRef={resultsRef as React.RefObject<HTMLDivElement>}
        selectedMaterialsSize={selectedMaterials.size}
      />

      {/* --- keyframes --- */}
      <style>{`
        @keyframes basketAppear {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pillCheckPop {
          from { transform: scale(0); }
          to   { transform: scale(1); }
        }
        @keyframes filterBadgePop {
          0%   { transform: scale(0.5); }
          60%  { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes basketAppear { from, to { opacity: 1; transform: none; } }
          @keyframes pillCheckPop { from, to { transform: scale(1); } }
          @keyframes filterBadgePop { from, to { transform: scale(1); } }
        }
      `}</style>
    </div>
  );
}
