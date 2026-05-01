"use client";

/**
 * paper.trail — gallery page
 *
 * Browse captures saved in localStorage. Delete or review
 * past captures. Reflection prompt after browsing.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { loadCaptures, deleteCapture } from "@/lib/storage";
import { ReflectionPrompt } from "@windedvertigo/mirror-log";
import type { Capture } from "@/lib/types";

const FALLBACK_SKILLS = ["observation", "documentation", "reflection"];

function deriveSkills(captures: Capture[]): string[] {
  const seen = new Set<string>();
  for (const c of captures) {
    for (const s of c.activitySkills ?? []) seen.add(s);
  }
  return seen.size > 0 ? [...seen] : FALLBACK_SKILLS;
}

function summarise(captures: Capture[]): string {
  const titles = [
    ...new Set(
      captures
        .map((c) => c.activityTitle ?? c.activitySlug)
        .filter(Boolean),
    ),
  ];
  const list = titles.slice(0, 3).join(", ");
  const extra = titles.length > 3 ? ` +${titles.length - 3} more` : "";
  return `${captures.length} captures across ${titles.length} ${
    titles.length === 1 ? "activity" : "activities"
  }: ${list}${extra}`;
}

export default function GalleryPage() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showReflection, setShowReflection] = useState(false);

  useEffect(() => {
    setCaptures(loadCaptures());
  }, []);

  const selected = captures.find((c) => c.id === selectedId) ?? null;

  const handleDelete = useCallback(
    (id: string) => {
      deleteCapture(id);
      setCaptures((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <main id="main" className="flex-1 px-4 py-8 sm:py-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-baseline justify-between gap-4 mb-6">
            <h1 className="text-2xl font-bold">your gallery</h1>
            <Link
              href="/capture"
              className="text-sm font-semibold text-[var(--color-accent-on-dark)] hover:text-[var(--wv-champagne)] no-underline transition-colors"
            >
              open camera →
            </Link>
          </div>

          {captures.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[var(--color-text-on-dark-muted)] mb-6">
                no captures yet. complete an activity and capture your work.
              </p>
              <Link
                href="/capture"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--wv-redwood)] text-[var(--color-text-on-dark)] font-semibold hover:brightness-110 transition-all no-underline"
              >
                open camera →
              </Link>
            </div>
          ) : (
            <>
              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
                {captures.map((c) => (
                  <button
                    key={c.id}
                    onClick={() =>
                      setSelectedId(selectedId === c.id ? null : c.id)
                    }
                    className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${
                      selectedId === c.id
                        ? "border-[var(--wv-redwood)]"
                        : "border-transparent hover:border-white/20"
                    }`}
                  >
                    <img
                      src={c.imageDataUrl}
                      alt={`capture from ${c.activitySlug}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 px-2 py-1">
                      <p className="text-[10px] text-white/80 truncate">
                        {c.activitySlug} ·{" "}
                        {new Date(c.timestamp).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    {c.annotations.length > 0 && (
                      <span className="absolute top-1 right-1 bg-[var(--wv-sienna)] text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold">
                        {c.annotations.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Selected capture detail */}
              {selected && (
                <div className="p-4 rounded-xl border border-white/10 bg-white/5 mb-6">
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden mb-4">
                    <img
                      src={selected.imageDataUrl}
                      alt="selected capture"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-[var(--color-text-on-dark-muted)]">
                        {selected.activitySlug} ·{" "}
                        {new Date(selected.timestamp).toLocaleDateString(
                          "en-GB",
                        )}
                      </p>
                      {selected.notes && (
                        <p className="text-sm mt-2">{selected.notes}</p>
                      )}
                      {selected.promptUsed && (
                        <p className="text-xs text-[var(--wv-sienna)] mt-1">
                          prompt: {selected.promptUsed}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(selected.id)}
                      className="text-xs text-red-400 hover:text-red-300 shrink-0"
                    >
                      delete
                    </button>
                  </div>
                </div>
              )}

              {/* Reflection prompt */}
              {captures.length >= 3 && !showReflection && (
                <button
                  onClick={() => setShowReflection(true)}
                  className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)] hover:bg-white/10 transition-all"
                >
                  reflect on your gallery — what patterns do you see?
                </button>
              )}
              {showReflection && (
                <div className="mt-4">
                  <ReflectionPrompt
                    sourceApp="paper-trail"
                    skillsExercised={deriveSkills(captures)}
                    sessionSummary={summarise(captures)}
                    onComplete={() => setShowReflection(false)}
                    onSkip={() => setShowReflection(false)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="wv-footer">
        <div className="wv-footer-inner">
          <p className="wv-footer-copyright">
            © {new Date().getFullYear()} winded.vertigo llc
          </p>
        </div>
      </footer>
    </div>
  );
}
