"use client";

/**
 * mirror.log — reflection history dashboard
 *
 * Reads reflections from localStorage (shared across harbour
 * apps on the same origin). Shows history, patterns, and streak.
 */

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  loadReflections,
  getReflectionStreak,
  ReflectionPrompt,
} from "@windedvertigo/mirror-log";
import type { Reflection, MoodType } from "@windedvertigo/mirror-log";

const MOOD_EMOJI: Record<MoodType, string> = {
  energized: "⚡",
  curious: "🔍",
  frustrated: "😤",
  calm: "😌",
  uncertain: "🤔",
};

const APP_LABELS: Record<string, string> = {
  "tidal-pool": "tidal.pool",
  "paper-trail": "paper.trail",
  creaseworks: "creaseworks",
  "raft-house": "raft.house",
  "depth-chart": "depth.chart",
  "deep-deck": "deep.deck",
};

export default function MirrorLogHome() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [streak, setStreak] = useState(0);
  const [filterApp, setFilterApp] = useState<string | null>(null);
  const [showNewReflection, setShowNewReflection] = useState(false);

  useEffect(() => {
    setReflections(loadReflections().reverse()); // newest first
    setStreak(getReflectionStreak());
  }, []);

  const apps = useMemo(
    () => [...new Set(reflections.map((r) => r.sourceApp))],
    [reflections],
  );

  const skills = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of reflections) {
      for (const s of r.skillSlugs) {
        counts[s] = (counts[s] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [reflections]);

  const moods = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of reflections) {
      if (r.mood) counts[r.mood] = (counts[r.mood] ?? 0) + 1;
    }
    return counts;
  }, [reflections]);

  const filtered = filterApp
    ? reflections.filter((r) => r.sourceApp === filterApp)
    : reflections;

  return (
    <main id="main" className="min-h-screen flex flex-col">
      <div className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">
        {/* Hero */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-4">
            the harbour / mirror.log
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
            mirror.log
          </h1>
          <p className="text-[var(--color-text-on-dark-muted)] max-w-md mx-auto">
            your reflections across the harbour. notice how you think, what
            surprises you, and how you grow.
          </p>
        </div>

        {reflections.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16">
            <p className="text-[var(--color-text-on-dark-muted)] mb-6">
              no reflections yet. complete an activity in any harbour app
              and take a moment to reflect.
            </p>
            <button
              onClick={() => setShowNewReflection(true)}
              className="px-6 py-3 rounded-full bg-[var(--wv-redwood)] text-[var(--color-text-on-dark)] font-semibold hover:brightness-110 transition-all"
            >
              write your first reflection
            </button>
            {showNewReflection && (
              <div className="mt-8 text-left">
                <ReflectionPrompt
                  sourceApp="mirror-log"
                  skillsExercised={[]}
                  sessionSummary="first reflection in mirror.log"
                  onComplete={() => {
                    setShowNewReflection(false);
                    setReflections(loadReflections().reverse());
                    setStreak(getReflectionStreak());
                  }}
                  onSkip={() => setShowNewReflection(false)}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-xl border border-white/10 bg-white/5 text-center">
                <p className="text-2xl font-bold">{reflections.length}</p>
                <p className="text-xs text-[var(--color-text-on-dark-muted)]">
                  reflections
                </p>
              </div>
              <div className="p-4 rounded-xl border border-white/10 bg-white/5 text-center">
                <p className="text-2xl font-bold">{streak}</p>
                <p className="text-xs text-[var(--color-text-on-dark-muted)]">
                  day streak
                </p>
              </div>
              <div className="p-4 rounded-xl border border-white/10 bg-white/5 text-center">
                <p className="text-2xl font-bold">{apps.length}</p>
                <p className="text-xs text-[var(--color-text-on-dark-muted)]">
                  apps explored
                </p>
              </div>
            </div>

            {/* Skill frequency */}
            {skills.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-3">
                  most practised skills
                </h2>
                <div className="flex flex-wrap gap-2">
                  {skills.map(([skill, count]) => (
                    <span
                      key={skill}
                      className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5"
                    >
                      {skill.replace(/-/g, " ")}{" "}
                      <span className="text-[var(--wv-sienna)] font-semibold">
                        ×{count}
                      </span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Mood summary */}
            {Object.keys(moods).length > 0 && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-3">
                  mood patterns
                </h2>
                <div className="flex gap-3">
                  {Object.entries(moods)
                    .sort((a, b) => b[1] - a[1])
                    .map(([mood, count]) => (
                      <div
                        key={mood}
                        className="flex items-center gap-1.5 text-sm"
                      >
                        <span>{MOOD_EMOJI[mood as MoodType]}</span>
                        <span className="text-[var(--color-text-on-dark-muted)]">
                          {mood}
                        </span>
                        <span className="text-xs text-[var(--wv-sienna)] font-semibold">
                          ×{count}
                        </span>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* App filter */}
            {apps.length > 1 && (
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setFilterApp(null)}
                  className={`text-xs px-3 py-1 rounded-full transition-all ${
                    !filterApp
                      ? "bg-[var(--wv-redwood)] text-white"
                      : "border border-white/10 text-[var(--color-text-on-dark-muted)] hover:text-white"
                  }`}
                >
                  all
                </button>
                {apps.map((app) => (
                  <button
                    key={app}
                    onClick={() => setFilterApp(filterApp === app ? null : app)}
                    className={`text-xs px-3 py-1 rounded-full transition-all ${
                      filterApp === app
                        ? "bg-[var(--wv-redwood)] text-white"
                        : "border border-white/10 text-[var(--color-text-on-dark-muted)] hover:text-white"
                    }`}
                  >
                    {APP_LABELS[app] ?? app}
                  </button>
                ))}
              </div>
            )}

            {/* Reflection history */}
            <section>
              <h2 className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-4">
                reflections
              </h2>
              <div className="space-y-3">
                {filtered.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl border border-white/10 bg-white/5"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-[var(--wv-sienna)]">
                        {APP_LABELS[r.sourceApp] ?? r.sourceApp}
                      </span>
                      <span className="text-xs text-[var(--color-text-on-dark-muted)]">
                        ·{" "}
                        {new Date(r.timestamp).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      {r.mood && (
                        <span title={r.mood}>
                          {MOOD_EMOJI[r.mood]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-on-dark-muted)] italic mb-1">
                      &ldquo;{r.prompt}&rdquo;
                    </p>
                    <p className="text-sm leading-relaxed">{r.response}</p>
                    {r.skillSlugs.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {r.skillSlugs.map((s) => (
                          <span
                            key={s}
                            className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-[var(--color-text-on-dark-muted)]"
                          >
                            {s.replace(/-/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* New reflection CTA */}
            <div className="mt-8">
              {!showNewReflection ? (
                <button
                  onClick={() => setShowNewReflection(true)}
                  className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-[var(--color-text-on-dark-muted)] hover:text-[var(--color-text-on-dark)] hover:bg-white/10 transition-all"
                >
                  write a new reflection
                </button>
              ) : (
                <ReflectionPrompt
                  sourceApp="mirror-log"
                  skillsExercised={[]}
                  sessionSummary="standalone reflection from mirror.log"
                  onComplete={() => {
                    setShowNewReflection(false);
                    setReflections(loadReflections().reverse());
                    setStreak(getReflectionStreak());
                  }}
                  onSkip={() => setShowNewReflection(false)}
                />
              )}
            </div>
          </>
        )}
      </div>

      <footer className="wv-footer">
        <div className="wv-footer-inner">
          <p className="wv-footer-copyright">
            © {new Date().getFullYear()} winded.vertigo llc
          </p>
        </div>
      </footer>
    </main>
  );
}
