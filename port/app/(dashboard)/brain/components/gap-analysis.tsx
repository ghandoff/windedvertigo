"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getNodeColor, type GraphData, type Gap, type GapType } from "@/lib/knowledge/types";

const SEVERITY_STYLE: Record<Gap["severity"], { bg: string; text: string; label: string }> = {
  high:   { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", label: "high" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", label: "medium" },
  low:    { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", label: "low" },
};

const TYPE_LABELS: Record<GapType, string> = {
  isolated: "isolated node",
  "shallow-research": "shallow research",
  "ungrounded-product": "ungrounded product",
  "thin-bridge": "thin bridge",
  "no-methodology": "missing methodology",
  "capability-gap": "capability gap",
  "claimed-unevidenced": "claimed · unevidenced",
  "evidence-asymmetry": "evidence asymmetry",
  "framework-adoption": "framework adoption",
  "population-coverage": "population coverage",
  "service-coverage": "service coverage",
  "ungrounded-framework": "ungrounded framework",
};

const sig = (g: Gap) => `${g.type}|${g.nodeIds.join(",")}`;
const STAR_KEY = "brain.gaps.starred";
const DISMISS_KEY = "brain.gaps.dismissed";

function useLocalSet(key: string): [Set<string>, (id: string) => void] {
  const [set, setSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setSet(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, [key]);
  const toggle = (id: string) =>
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(key, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  return [set, toggle];
}

export function GapAnalysis({ data, gaps }: { data: GraphData; gaps: Gap[] }) {
  const [filterType, setFilterType] = useState<GapType | "all">("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [starred, toggleStar] = useLocalSet(STAR_KEY);
  const [dismissed, toggleDismiss] = useLocalSet(DISMISS_KEY);

  const nodeMap = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);

  const visible = useMemo(() => {
    let list = gaps.filter((g) => showDismissed || !dismissed.has(sig(g)));
    if (starredOnly) list = list.filter((g) => starred.has(sig(g)));
    if (filterType !== "all") list = list.filter((g) => g.type === filterType);
    // starred float to the top, otherwise keep the severity order from computeGaps
    return [...list].sort((a, b) => Number(starred.has(sig(b))) - Number(starred.has(sig(a))));
  }, [gaps, dismissed, starred, starredOnly, showDismissed, filterType]);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    gaps.forEach((g) => {
      if (!dismissed.has(sig(g))) m.set(g.type, (m.get(g.type) ?? 0) + 1);
    });
    return m;
  }, [gaps, dismissed]);

  const live = gaps.filter((g) => !dismissed.has(sig(g)));
  const dismissedCount = gaps.length - live.length;
  const curriculumGaps = live.filter((g) => g.curriculumSuggestion);
  const severityCounts = { high: 0, medium: 0, low: 0 };
  live.forEach((g) => severityCounts[g.severity]++);

  return (
    <div className="space-y-6">
      {/* summary strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">open gaps</p>
          <p className="text-xl font-semibold tabular-nums">{live.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1"><span className="text-red-500">●</span> high severity</p>
          <p className="text-xl font-semibold tabular-nums">{severityCounts.high}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1"><span className="text-amber-500">●</span> medium</p>
          <p className="text-xl font-semibold tabular-nums">{severityCounts.medium}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">★ starred</p>
          <p className="text-xl font-semibold tabular-nums">{starred.size}</p>
        </div>
      </div>

      {/* type + state filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType("all")}
          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
            filterType === "all" ? "border-foreground/30 bg-foreground/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          all ({live.length})
        </button>
        {(Object.keys(TYPE_LABELS) as GapType[]).map((type) => {
          const count = typeCounts.get(type) ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={type}
              onClick={() => setFilterType(type === filterType ? "all" : type)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                filterType === type ? "border-foreground/30 bg-foreground/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {TYPE_LABELS[type]} ({count})
            </button>
          );
        })}
        <button
          onClick={() => setStarredOnly((v) => !v)}
          className={`ml-auto rounded-full border px-2.5 py-1 text-xs transition-colors ${
            starredOnly ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          ★ starred only
        </button>
      </div>

      {/* gap cards */}
      <div className="space-y-3">
        {visible.map((gap) => {
          const sev = SEVERITY_STYLE[gap.severity];
          const s = sig(gap);
          const isStarred = starred.has(s);
          const isDismissed = dismissed.has(s);
          const focusId = gap.nodeIds[0];
          return (
            <div key={s} className={`rounded-lg border border-border bg-card p-4 space-y-2 ${isDismissed ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${sev.bg} ${sev.text}`}>{sev.label}</span>
                  <span className="text-[10px] text-muted-foreground">{TYPE_LABELS[gap.type]}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleStar(s)}
                    title={isStarred ? "unstar" : "prioritize"}
                    className={`rounded px-1 text-sm ${isStarred ? "text-amber-500" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {isStarred ? "★" : "☆"}
                  </button>
                  {focusId && (
                    <Link
                      href={`/brain?tab=graph&focus=${encodeURIComponent(focusId)}`}
                      title="view in graph"
                      className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                    >
                      ↳ graph
                    </Link>
                  )}
                  <button
                    onClick={() => toggleDismiss(s)}
                    title={isDismissed ? "restore" : "dismiss"}
                    className="rounded px-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {isDismissed ? "↺" : "✕"}
                  </button>
                </div>
              </div>
              <h4 className="text-sm font-medium">{gap.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{gap.description}</p>

              <div className="flex flex-wrap gap-1.5">
                {gap.nodeIds.map((id) => {
                  const node = nodeMap.get(id);
                  if (!node) return null;
                  return (
                    <Link
                      key={id}
                      href={`/brain?tab=graph&focus=${encodeURIComponent(id)}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] hover:bg-muted"
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getNodeColor(node) }} />
                      {node.label}
                    </Link>
                  );
                })}
              </div>

              {gap.curriculumSuggestion && (
                <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                  <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 mb-0.5">cARL curriculum suggestion</p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300/80">{gap.curriculumSuggestion}</p>
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">no gaps match the current filters</p>
        )}
      </div>

      {dismissedCount > 0 && (
        <button onClick={() => setShowDismissed((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground">
          {showDismissed ? "hide" : "show"} {dismissedCount} dismissed
        </button>
      )}

      {/* curriculum summary */}
      {curriculumGaps.length > 0 && filterType === "all" && !starredOnly && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">curriculum recommendations for cARL</h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-400/80">
            the knowledge graph reveals {curriculumGaps.length} gaps that cARL can address through targeted research.
          </p>
          <ol className="space-y-1.5 list-decimal list-inside">
            {curriculumGaps.map((g, i) => (
              <li key={i} className="text-xs text-emerald-800 dark:text-emerald-300/80">{g.curriculumSuggestion}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
