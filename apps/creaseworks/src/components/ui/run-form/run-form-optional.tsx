"use client";

import { CONTEXT_TAGS, TRACE_EVIDENCE_OPTIONS } from "@/lib/constants/enums";
import type { Material } from "./types";
import type { RunFormState } from "./use-run-form-state";

interface RunFormOptionalProps {
  state: RunFormState;
  materials: Material[];
}

export function RunFormOptional({ state, materials }: RunFormOptionalProps) {
  // Filter materials by search
  const filteredMaterials = materials.filter(
    (m: Material) =>
      !state.materialSearch ||
      m.title.toLowerCase().includes(state.materialSearch.toLowerCase()),
  );

  // Group filtered materials by form
  const groupedMaterials = filteredMaterials.reduce(
    (acc: Record<string, Material[]>, m: Material) => {
      const form = m.form_primary || "other";
      if (!acc[form]) acc[form] = [];
      acc[form].push(m);
      return acc;
    },
    {} as Record<string, Material[]>,
  );

  return (
    <div className="rounded-xl border border-cadet/10 bg-champagne/30 p-5">
      <button
        type="button"
        onClick={() => state.setShowOptional(!state.showOptional)}
        className="flex items-center gap-2 text-sm font-semibold text-cadet/80 w-full"
      >
        <span
          className="text-xs transition-transform"
          style={{ transform: state.showOptional ? "rotate(90deg)" : "rotate(0)" }}
        >
          ▶
        </span>
        more details (optional)
      </button>

      {state.showOptional && (
        <div className="mt-4 space-y-5">
          {/* context tags */}
          <div>
            <label className="block text-xs text-cadet/60 mb-2">
              context tags
            </label>
            <div className="flex flex-wrap gap-2">
              {CONTEXT_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    state.toggleTag(tag, state.contextTags, state.setContextTags)
                  }
                  className="text-xs px-3 py-1.5 rounded-full transition-all border"
                  style={{
                    backgroundColor: state.contextTags.includes(tag)
                      ? "rgba(39, 50, 72, 0.1)"
                      : "transparent",
                    borderColor: state.contextTags.includes(tag)
                      ? "var(--wv-cadet)"
                      : "rgba(39, 50, 72, 0.15)",
                    color: "var(--wv-cadet)",
                    fontWeight: state.contextTags.includes(tag) ? 600 : 400,
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* trace evidence */}
          <div>
            <label className="block text-xs text-cadet/60 mb-2">
              trace evidence captured
            </label>
            <div className="flex flex-wrap gap-2">
              {TRACE_EVIDENCE_OPTIONS.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() =>
                    state.toggleTag(ev, state.traceEvidence, state.setTraceEvidence)
                  }
                  className="text-xs px-3 py-1.5 rounded-full transition-all border"
                  style={{
                    backgroundColor: state.traceEvidence.includes(ev)
                      ? "rgba(177, 80, 67, 0.1)"
                      : "transparent",
                    borderColor: state.traceEvidence.includes(ev)
                      ? "var(--wv-redwood)"
                      : "rgba(39, 50, 72, 0.15)",
                    color: state.traceEvidence.includes(ev)
                      ? "var(--wv-redwood)"
                      : "var(--wv-cadet)",
                    fontWeight: state.traceEvidence.includes(ev) ? 600 : 400,
                  }}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>

          {/* materials used */}
          <div>
            <label className="block text-xs text-cadet/60 mb-2">
              materials used
            </label>
            <input
              type="text"
              placeholder="search materials…"
              value={state.materialSearch}
              onChange={(e) => state.setMaterialSearch(e.target.value)}
              className="w-full rounded-lg border border-cadet/15 px-3 py-1.5 text-xs mb-2 outline-none focus:ring-2"
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-cadet/10 bg-white p-2 space-y-2">
              {Object.keys(groupedMaterials)
                .sort()
                .map((form) => (
                  <div key={form}>
                    <p className="text-xs font-semibold text-cadet/50 mb-1 sticky top-0 bg-white">
                      {form}
                    </p>
                    {groupedMaterials[form].map((m: Material) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 py-0.5 cursor-pointer text-xs hover:bg-champagne/40 rounded px-1"
                      >
                        <input
                          type="checkbox"
                          checked={state.selectedMaterials.includes(m.id)}
                          onChange={() =>
                            state.toggleTag(
                              m.id,
                              state.selectedMaterials,
                              state.setSelectedMaterials,
                            )
                          }
                          className="rounded"
                        />
                        {m.title}
                      </label>
                    ))}
                  </div>
                ))}
              {filteredMaterials.length === 0 && (
                <p className="text-xs text-cadet/40 py-2">
                  no materials found.
                </p>
              )}
            </div>
            {state.selectedMaterials.length > 0 && (
              <p className="text-xs text-cadet/50 mt-1">
                {state.selectedMaterials.length} material
                {state.selectedMaterials.length === 1 ? "" : "s"} selected
              </p>
            )}
          </div>

          {/* what changed */}
          <div>
            <label className="block text-xs text-cadet/60 mb-1">
              what changed
            </label>
            <textarea
              value={state.whatChanged}
              onChange={(e) => state.setWhatChanged(e.target.value)}
              placeholder="what surprised you? what worked differently than expected?"
              rows={3}
              className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2 resize-y"
            />
          </div>

          {/* next iteration */}
          <div>
            <label className="block text-xs text-cadet/60 mb-1">
              next iteration
            </label>
            <textarea
              value={state.nextIteration}
              onChange={(e) => state.setNextIteration(e.target.value)}
              placeholder="what would you do differently next time?"
              rows={3}
              className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2 resize-y"
            />
          </div>
        </div>
      )}
    </div>
  );
}
