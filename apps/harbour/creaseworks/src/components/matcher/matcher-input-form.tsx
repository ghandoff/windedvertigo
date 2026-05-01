"use client";

/**
 * Matcher input form — playful, child-friendly material picker.
 *
 * "classic picker" mode — every material the app knows about, as one
 * continuous scroll of big tiles ordered from smallest (buttons, beads)
 * to biggest (trash bin, large cardboard boxes). No form buckets, no
 * drop-down reveals — the size axis IS the mental model.
 *
 * The cast still appears on each tile via resolveCharacterFromForm,
 * but their role shifted: they no longer label form categories, they
 * inhabit the scroll and let kids discover repetition patterns on
 * their own (seven Cords in a row = "oh, these all bend").
 *
 * Search bar survives for parents who know what they're looking for.
 */

import { Fragment, useEffect, useRef } from "react";
import { MatcherInputFormProps, Material } from "./types";
import { FilterSection } from "./filter-section";
import { EmojiTile } from "./emoji-tile";
import { useMatcherState } from "./use-matcher-state";
import { MatcherResults } from "./matcher-results";
import { getMaterialEmoji, getMaterialIcon } from "./material-emoji";
import { resolveCharacterFromForm } from "@windedvertigo/characters";
import { getSizeRank, getSizeTier } from "@/lib/material-size";

/* ── emoji maps for filter tiles ───────────────────────────────────
   FORM_EMOJI was removed when the classic picker dropped its form-bucket
   headers — the size axis replaced form-grouping as the organising
   principle. CONTEXT_EMOJI + SLOT_EMOJI remain for the two filter rows
   that still group discretely (contexts = "where", slots = "tools").  */

const CONTEXT_EMOJI: Record<string, string> = {
  indoors: "🏠",
  outdoors: "🌳",
  kitchen: "🍳",
  garden: "🌻",
  park: "🏞️",
  beach: "🏖️",
  classroom: "🏫",
  home: "🏡",
  "low-resource": "🌱",
  remote: "🏕️",
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
  // generic DB slot categories — more abstract than specific tools
  "found object": "🔍",
  "mark-maker": "✏️",
  "small parts": "🧩",
  surface: "⬜",
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
  slots,
  contexts,
  preselectedMaterialIds,
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
    loading,
    error,
    results,
    resultsRef,
    filteredMaterialsBySize,
    hasSelection,
    totalSelections,
    toggleSet,
    handleSubmit,
    handleClear,
    materialTitleMap,
    materialFormMap,
    materialEmojiMap,
    materialIconMap,
  } = useMatcherState(materials);

  /* Seed selectedMaterials once on mount when the URL brings along a
     preselected list (?materials=csv → FindPhaseShell → here). Using a
     ref so prop changes after mount don't clobber user edits. */
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!preselectedMaterialIds || preselectedMaterialIds.length === 0) return;
    seededRef.current = true;
    setSelectedMaterials(new Set(preselectedMaterialIds));
  }, [preselectedMaterialIds, setSelectedMaterials]);

  return (
    <div>
      {/* --- discovery bag: selected items float at top --- */}
      {hasSelection && (
        <div
          className="mb-5 rounded-2xl border-2 border-dashed px-5 py-4"
          style={{
            borderColor: "rgba(203, 120, 88, 0.3)",
            backgroundColor: "var(--wv-cream)",
            animation: "basketAppear 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎒</span>
            <span
              className="text-xs font-bold tracking-wider"
              style={{ color: "var(--wv-sienna)" }}
            >
              your discovery bag
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--wv-cadet)", opacity: 0.7 }}
            >
              {totalSelections} thing{totalSelections !== 1 ? "s" : ""} picked
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(selectedMaterials).map((id) => {
              const title = materialTitleMap.get(id) ?? id;
              const form = materialFormMap.get(id);
              const dbEmoji = materialEmojiMap.get(id);
              const dbIcon = materialIconMap.get(id);
              const iconPath = getMaterialIcon(title, form, dbEmoji, dbIcon);
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={`remove ${title}`}
                  onClick={() =>
                    toggleSet(selectedMaterials, setSelectedMaterials, id)
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all active:scale-90"
                  style={{
                    backgroundColor: "rgba(177, 80, 67, 0.15)",
                    color: "var(--wv-cadet)",
                  }}
                >
                  {iconPath ? (
                    <img src={iconPath} alt="" width={16} height={16} className="inline-block" />
                  ) : (
                    <span>{getMaterialEmoji(title, form, dbEmoji)}</span>
                  )}
                  {title}
                  <span style={{ fontSize: "0.9em", opacity: 0.6 }}>✕</span>
                </button>
              );
            })}
            {Array.from(selectedForms).map((f) => (
              <button
                key={`form-${f}`}
                type="button"
                aria-label={`remove ${f}`}
                onClick={() => toggleSet(selectedForms, setSelectedForms, f)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all active:scale-90"
                style={{
                  backgroundColor: "rgba(203, 120, 88, 0.15)",
                  color: "var(--wv-cadet)",
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
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all active:scale-90"
                style={{
                  backgroundColor: "rgba(203, 120, 88, 0.12)",
                  color: "var(--wv-cadet)",
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
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all active:scale-90"
                style={{
                  backgroundColor: "rgba(228, 196, 137, 0.2)",
                  color: "var(--wv-cadet)",
                  opacity: 0.9,
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
        {/* ---- context: "where's the fun happening?" — first so kids orient ---- */}
        <FilterSection
          title="where's the fun happening?"
          subtitle="we'll only show playdates that work here."
          emoji="🗺️"
          selectedCount={selectedContexts.size}
          defaultOpen={true}
        >
          <div
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 mx-auto"
            style={{ maxWidth: 720 }}
          >
            {contexts.map((ctx, i) => (
              <EmojiTile
                key={ctx}
                emoji={getEmoji(CONTEXT_EMOJI, ctx, "📍")}
                label={ctx}
                selected={selectedContexts.has(ctx)}
                accentColor="var(--wv-sienna)"
                onClick={() =>
                  toggleSet(selectedContexts, setSelectedContexts, ctx)
                }
                size="lg"
                fluid
                index={i}
              />
            ))}
          </div>
        </FilterSection>

        {/* ---- materials: "what's within reach?" ---- */}
        <FilterSection
          title="what's within reach?"
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
              className="w-full rounded-xl border pl-10 pr-4 py-3 text-sm outline-none focus:ring-2"
              style={{
                borderColor: "rgba(39, 50, 72, 0.12)",
                color: "var(--wv-cadet)",
                minHeight: 48,
                backgroundColor: "var(--wv-cream)",
              }}
            />
          </div>

          {/* continuous size-sorted scroll — every material, smallest to
              biggest. 2 cols on mobile, 3 on desktop, constrained so
              tiles feel the same size across breakpoints. The tier-
              milestone bands (injected inline in the .map below via
              col-span) replace the old text-only "↑ small stuff /
              big stuff ↓" hint — a non-reader kid can parse 🫘→📦
              without touching the copy.
              NOTE: no className="rounded-xl border" — globals.css line 678
              applies translateY(-4px) rotate(-0.5deg) on hover to any
              element matching .rounded-xl.border, which tilted the ENTIRE
              scroll container when a kid hovered over a tile.           */}
          <div
            className="p-3 -webkit-overflow-scrolling-touch"
            style={{
              borderRadius: 12,
              border: "1px solid rgba(39, 50, 72, 0.06)",
              backgroundColor: "rgba(255, 246, 232, 0.5)",
            }}
          >
            {filteredMaterialsBySize.length > 0 ? (
              <div
                className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mx-auto"
                style={{ maxWidth: 720 }}
              >
                {filteredMaterialsBySize.map((mat: Material, i) => {
                  const tier = getSizeTier(getSizeRank(mat));
                  const prev = i > 0 ? filteredMaterialsBySize[i - 1] : null;
                  const prevTier = prev ? getSizeTier(getSizeRank(prev)) : null;
                  const showTierHeader = tier.key !== prevTier?.key;
                  return (
                    <Fragment key={mat.id}>
                      {showTierHeader && (
                        <div
                          className="col-span-2 sm:col-span-3 flex items-center gap-3 pt-2"
                          aria-label={`size tier — ${tier.label}`}
                          style={{
                            paddingLeft: 4,
                            marginTop: i === 0 ? 0 : 8,
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              fontSize: 32,
                              lineHeight: 1,
                              filter: "drop-shadow(0 1px 0 rgba(39,50,72,0.08))",
                            }}
                          >
                            {tier.emoji}
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "var(--color-text-on-cream-muted)",
                            }}
                          >
                            {tier.label}
                          </span>
                          <span
                            aria-hidden="true"
                            style={{
                              flex: 1,
                              height: 1,
                              backgroundColor: "rgba(39, 50, 72, 0.08)",
                            }}
                          />
                        </div>
                      )}
                      <div className="flex flex-col items-center gap-1">
                        <EmojiTile
                          emoji={getMaterialEmoji(mat.title, mat.form_primary, mat.emoji)}
                          emojiSrc={getMaterialIcon(mat.title, mat.form_primary, mat.emoji, mat.icon) ?? undefined}
                          characterName={resolveCharacterFromForm(mat.form_primary, mat.title)}
                          label={mat.title}
                          selected={selectedMaterials.has(mat.id)}
                          onClick={() =>
                            toggleSet(selectedMaterials, setSelectedMaterials, mat.id)
                          }
                          size="xl"
                          fluid
                          index={i}
                        />
                    {mat.functions && mat.functions.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-center max-w-full px-1">
                        {mat.functions.slice(0, 2).map((fn: string) => (
                          <span
                            key={fn}
                            className="text-center leading-tight"
                            style={{
                              fontSize: "0.625rem",
                              // UDL fix: seafoam on cream @ 0.75 was ~1.9:1
                              // (illegible) — function labels are the
                              // pedagogical "what it does" signal, must read.
                              // Swap to cadet @ 65% for ~5.5:1 AA + keep a
                              // teal accent dot for colour-coding.
                              color: "var(--color-text-on-cream-muted)",
                              fontWeight: 600,
                              letterSpacing: "0.01em",
                            }}
                          >
                            {fn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                    </Fragment>
                  );
                })}
              </div>
            ) : (
              <p
                className="text-sm py-6 text-center"
                style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
              >
                hmm, nothing matches that search. try a different word!
              </p>
            )}

            {/* encouragement for unlisted items */}
            <p
              className="text-xs text-center py-3 mt-4 rounded-lg"
              style={{
                color: "var(--wv-cadet)",
                opacity: 0.55,
                backgroundColor: "rgba(39, 50, 72, 0.03)",
              }}
            >
              💡 found something not listed? pick the closest match — creativity counts!
            </p>
          </div>
        </FilterSection>

        {/* ---- slots: "tools you have" — below materials ---- */}
        {slots.length > 0 && (
          <FilterSection
            title="tools you have"
            subtitle="got scissors, glue, markers? we'll unlock more playdates."
            emoji="✂️"
            selectedCount={selectedSlots.size}
            defaultOpen={true}
          >
            <div
              className="grid grid-cols-2 sm:grid-cols-3 gap-3 mx-auto"
              style={{ maxWidth: 720 }}
            >
              {slots.map((slot, i) => (
                <EmojiTile
                  key={slot}
                  emoji={getEmoji(SLOT_EMOJI, slot, "🔧")}
                  label={slot}
                  selected={selectedSlots.has(slot)}
                  accentColor="var(--wv-sienna)"
                  onClick={() =>
                    toggleSet(selectedSlots, setSelectedSlots, slot)
                  }
                  size="lg"
                  fluid
                  index={i}
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
              <>what can these become? ✨</>
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
          backgroundColor: "rgba(255, 246, 232, 0.97)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "2px solid rgba(39, 50, 72, 0.1)",
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
              what can these become? ✨{" "}
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
        @media (prefers-reduced-motion: reduce) {
          @keyframes basketAppear { from, to { opacity: 1; transform: none; } }
        }
      `}</style>
    </div>
  );
}
