"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface PlanSummary {
  id?: string;
  title: string;
  subject: string;
  grade_level: string;
  objectives_count: number;
  created_at?: string;
  saved_at?: string;
}

export default function PlanHistoryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [plans, set_plans] = useState<PlanSummary[]>([]);
  const [source, set_source] = useState<"db" | "local" | null>(null);
  const [loading, set_loading] = useState(true);

  useEffect(() => {
    async function load() {
      if (session?.user?.id) {
        try {
          const res = await fetch("/harbour/depth-chart/api/plans");
          if (res.ok) {
            const data = await res.json();
            set_plans(data.plans.map((p: { id: string; title: string; subject: string; grade_level: string; objectives_count: string; created_at: string }) => ({
              id: p.id,
              title: p.title,
              subject: p.subject,
              grade_level: p.grade_level,
              objectives_count: parseInt(p.objectives_count as string, 10),
              created_at: p.created_at,
            })));
            set_source("db");
            set_loading(false);
            return;
          }
        } catch (e) {
          console.error("[history] db load failed:", e);
        }
      }

      if (status !== "loading") {
        const raw = localStorage.getItem("depth_chart_plan_history");
        if (raw) set_plans(JSON.parse(raw));
        set_source("local");
        set_loading(false);
      }
    }
    load();
  }, [session, status]);

  const load_plan = useCallback(
    (plan: PlanSummary, index: number) => {
      if (source === "db" && plan.id) {
        router.push(`/plan/${plan.id}`);
      } else {
        const raw = localStorage.getItem("depth_chart_plan_history");
        if (!raw) return;
        const history = JSON.parse(raw);
        const stored = history[index];
        if (!stored) return;
        localStorage.setItem("depth_chart_plan", JSON.stringify(stored));
        localStorage.removeItem("depth_chart_tasks");
        router.push("/plan/current");
      }
    },
    [source, router]
  );

  const delete_plan = useCallback(
    async (plan: PlanSummary, index: number) => {
      if (source === "db" && plan.id) {
        await fetch(`/harbour/depth-chart/api/plans/${plan.id}`, { method: "DELETE" });
        set_plans((prev) => prev.filter((_, i) => i !== index));
      } else {
        const raw = localStorage.getItem("depth_chart_plan_history");
        if (!raw) return;
        const history: PlanSummary[] = JSON.parse(raw);
        history.splice(index, 1);
        localStorage.setItem("depth_chart_plan_history", JSON.stringify(history));
        set_plans([...history]);
      }
    },
    [source]
  );

  return (
    <main id="main" className="min-h-screen px-6 pt-24 pb-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="space-y-2">
          <a
            href="/harbour/depth-chart"
            className="text-xs text-[var(--color-text-on-dark-muted)] hover:text-[var(--wv-champagne)] transition-colors"
          >
            ← home
          </a>
          <h1 className="text-2xl font-bold text-[var(--color-text-on-dark)]">
            plan history
          </h1>
          <p className="text-sm text-[var(--color-text-on-dark-muted)]">
            {source === "db"
              ? "your saved lesson plans."
              : "previously uploaded lesson plans stored in your browser."}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--color-text-on-dark-muted)] animate-pulse">loading...</p>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-[var(--color-text-on-dark-muted)]">no saved plans yet.</p>
            <a
              href="/harbour/depth-chart/upload"
              className="inline-block text-sm text-[var(--wv-champagne)] hover:opacity-80"
            >
              upload your first lesson plan →
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan, i) => (
              <div
                key={plan.id || `${plan.saved_at}-${i}`}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[var(--color-text-on-dark)] truncate">
                    {plan.title || "untitled"}
                  </h3>
                  <p className="text-xs text-[var(--color-text-on-dark-muted)] mt-0.5">
                    {plan.subject} · {plan.grade_level} · {plan.objectives_count} objectives
                  </p>
                  <p className="text-xs text-[var(--color-text-on-dark-muted)] opacity-60 mt-0.5">
                    {new Date(plan.created_at || plan.saved_at || "").toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => load_plan(plan, i)}
                    className="px-3 py-1.5 bg-[var(--wv-champagne)] text-[var(--wv-cadet)] text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                  >
                    load
                  </button>
                  <button
                    onClick={() => delete_plan(plan, i)}
                    className="px-3 py-1.5 bg-white/5 text-[var(--color-text-on-dark-muted)] text-xs rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  >
                    delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
