"use client";

/**
 * Run creation form — client component.
 *
 * Lightweight UX per DESIGN.md: required fields are minimal (title,
 * type, date). Everything else is optional and collapsible.
 *
 * MVP 5 — runs and evidence.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Pattern {
  id: string;
  title: string;
  slug: string;
}

interface Material {
  id: string;
  title: string;
  form_primary: string | null;
}

const RUN_TYPES = [
  "internal practice",
  "webinar",
  "delivery",
  "BD/prospect",
  "R&D",
];

const TRACE_EVIDENCE_OPTIONS = [
  "photo",
  "video",
  "quote",
  "artifact",
  "notes",
];

const CONTEXT_TAGS = [
  "classroom",
  "home",
  "remote",
  "low-resource",
  "travel-kit",
  "mess-sensitive",
];

export default function RunForm({
  patterns,
  materials,
}: {
  patterns: Pattern[];
  materials: Material[];
}) {
  const router = useRouter();

  // Required fields
  const [title, setTitle] = useState("");
  const [runType, setRunType] = useState("");
  const [runDate, setRunDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Optional fields
  const [patternId, setPatternId] = useState("");
  const [contextTags, setContextTags] = useState<string[]>([]);
  const [traceEvidence, setTraceEvidence] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [whatChanged, setWhatChanged] = useState("");
  const [nextIteration, setNextIteration] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(tag: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !runType || !runDate) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          patternId: patternId || null,
          runType,
          runDate,
          contextTags,
          traceEvidence,
          materialIds: selectedMaterials,
          whatChanged: whatChanged.trim() || null,
          nextIteration: nextIteration.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed to create run");

      router.push("/runs");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filter materials by search
  const filteredMaterials = materials.filter(
    (m: Material) =>
      !materialSearch ||
      m.title.toLowerCase().includes(materialSearch.toLowerCase()),
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* required section */}
      <div className="rounded-xl border border-cadet/10 bg-champagne/30 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-cadet/80">essentials</h2>

        {/* title */}
        <div>
          <label className="block text-xs text-cadet/60 mb-1">
            title <span className="text-redwood">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. year 4 paper folding session"
            className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2"
            required
          />
        </div>

        {/* run type */}
        <div>
          <label className="block text-xs text-cadet/60 mb-1">
            run type <span className="text-redwood">*</span>
          </label>
          <select
            value={runType}
            onChange={(e) => setRunType(e.target.value)}
            className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2 bg-white"
            required
          >
            <option value="">select type…</option>
            {RUN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* date */}
        <div>
          <label className="block text-xs text-cadet/60 mb-1">
            date <span className="text-redwood">*</span>
          </label>
          <input
            type="date"
            value={runDate}
            onChange={(e) => setRunDate(e.target.value)}
            className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2"
            required
          />
        </div>

        {/* pattern link */}
        <div>
          <label className="block text-xs text-cadet/60 mb-1">
            linked pattern
          </label>
          <select
            value={patternId}
            onChange={(e) => setPatternId(e.target.value)}
            className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2 bg-white"
          >
            <option value="">none</option>
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* optional section — collapsible */}
      <div className="rounded-xl border border-cadet/10 bg-champagne/30 p-5">
        <button
          type="button"
          onClick={() => setShowOptional(!showOptional)}
          className="flex items-center gap-2 text-sm font-semibold text-cadet/80 w-full"
        >
          <span
            className="text-xs transition-transform"
            style={{ transform: showOptional ? "rotate(90deg)" : "rotate(0)" }}
          >
            ▶
          </span>
          more details (optional)
        </button>

        {showOptional && (
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
                    onClick={() => toggleTag(tag, contextTags, setContextTags)}
                    className="text-xs px-3 py-1.5 rounded-full transition-all border"
                    style={{
                      backgroundColor: contextTags.includes(tag)
                        ? "rgba(39, 50, 72, 0.1)"
                        : "transparent",
                      borderColor: contextTags.includes(tag)
                        ? "#273248"
                        : "rgba(39, 50, 72, 0.15)",
                      color: "#273248",
                      fontWeight: contextTags.includes(tag) ? 600 : 400,
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
                      toggleTag(ev, traceEvidence, setTraceEvidence)
                    }
                    className="text-xs px-3 py-1.5 rounded-full transition-all border"
                    style={{
                      backgroundColor: traceEvidence.includes(ev)
                        ? "rgba(177, 80, 67, 0.1)"
                        : "transparent",
                      borderColor: traceEvidence.includes(ev)
                        ? "#b15043"
                        : "rgba(39, 50, 72, 0.15)",
                      color: traceEvidence.includes(ev) ? "#b15043" : "#273248",
                      fontWeight: traceEvidence.includes(ev) ? 600 : 400,
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
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
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
                            checked={selectedMaterials.includes(m.id)}
                            onChange={() =>
                              toggleTag(
                                m.id,
                                selectedMaterials,
                                setSelectedMaterials,
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
              {selectedMaterials.length > 0 && (
                <p className="text-xs text-cadet/50 mt-1">
                  {selectedMaterials.length} material
                  {selectedMaterials.length === 1 ? "" : "s"} selected
                </p>
              )}
            </div>

            {/* what changed */}
            <div>
              <label className="block text-xs text-cadet/60 mb-1">
                what changed
              </label>
              <textarea
                value={whatChanged}
                onChange={(e) => setWhatChanged(e.target.value)}
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
                value={nextIteration}
                onChange={(e) => setNextIteration(e.target.value)}
                placeholder="what would you do differently next time?"
                rows={3}
                className="w-full rounded-lg border border-cadet/15 px-3 py-2 text-sm outline-none focus:ring-2 resize-y"
              />
            </div>
          </div>
        )}
      </div>

      {/* error */}
      {error && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{
            backgroundColor: "rgba(177, 80, 67, 0.08)",
            color: "#b15043",
          }}
        >
          {error}
        </div>
      )}

      {/* submit */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading || !title.trim() || !runType || !runDate}
          className="rounded-lg px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40 transition-all"
          style={{ backgroundColor: "#b15043" }}
        >
          {loading ? "saving…" : "save run"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/runs")}
          className="rounded-lg px-6 py-2.5 text-sm font-medium transition-all hover:opacity-70"
          style={{ color: "#273248" }}
        >
          cancel
        </button>
      </div>
    </form>
  );
}
