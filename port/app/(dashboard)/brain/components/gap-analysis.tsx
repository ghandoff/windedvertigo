"use client";

import { useMemo, useState } from "react";
import { GRAPH_DATA, AGENT_META, computeGaps, type Gap } from "@/lib/knowledge/graph-data";

const SEVERITY_STYLE: Record<Gap["severity"], { bg: string; text: string; label: string }> = {
  high:   { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", label: "high" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", label: "medium" },
  low:    { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", label: "low" },
};

const TYPE_LABELS: Record<Gap["type"], string> = {
  isolated: "isolated node",
  "shallow-research": "shallow research",
  "ungrounded-product": "ungrounded product",
  "thin-bridge": "thin bridge",
  "no-methodology": "missing methodology",
};

export function GapAnalysis() {
  const gaps = useMemo(() => computeGaps(GRAPH_DATA), []);
  const [filterType, setFilterType] = useState<Gap["type"] | "all">("all");

  const filtered = filterType === "all" ? gaps : gaps.filter((g) => g.type === filterType);
  const curriculumGaps = gaps.filter((g) => g.curriculumSuggestion);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    gaps.forEach((g) => m.set(g.type, (m.get(g.type) ?? 0) + 1));
    return m;
  }, [gaps]);

  const severityCounts = useMemo(() => {
    const m = { high: 0, medium: 0, low: 0 };
    gaps.forEach((g) => m[g.severity]++);
    return m;
  }, [gaps]);

  const nodeMap = useMemo(
    () => new Map(GRAPH_DATA.nodes.map((n) => [n.id, n])),
    [],
  );

  return (
    <div className="space-y-6">
      {/* summary strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">total gaps</p>
          <p className="text-xl font-semibold tabular-nums">{gaps.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">
            <span className="text-red-500">●</span> high severity
          </p>
          <p className="text-xl font-semibold tabular-nums">{severityCounts.high}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">
            <span className="text-amber-500">●</span> medium
          </p>
          <p className="text-xl font-semibold tabular-nums">{severityCounts.medium}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">curriculum items</p>
          <p className="text-xl font-semibold tabular-nums">{curriculumGaps.length}</p>
        </div>
      </div>

      {/* type filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType("all")}
          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
            filterType === "all"
              ? "border-foreground/30 bg-foreground/5 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          all ({gaps.length})
        </button>
        {(Object.keys(TYPE_LABELS) as Gap["type"][]).map((type) => {
          const count = typeCounts.get(type) ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={type}
              onClick={() => setFilterType(type === filterType ? "all" : type)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                filterType === type
                  ? "border-foreground/30 bg-foreground/5 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {TYPE_LABELS[type]} ({count})
            </button>
          );
        })}
      </div>

      {/* gap cards */}
      <div className="space-y-3">
        {filtered.map((gap, i) => {
          const sev = SEVERITY_STYLE[gap.severity];
          return (
            <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${sev.bg} ${sev.text}`}
                  >
                    {sev.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {TYPE_LABELS[gap.type]}
                  </span>
                </div>
              </div>
              <h4 className="text-sm font-medium">{gap.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {gap.description}
              </p>

              {/* related nodes */}
              <div className="flex flex-wrap gap-1.5">
                {gap.nodeIds.map((id) => {
                  const node = nodeMap.get(id);
                  if (!node) return null;
                  const color = AGENT_META[node.agent]?.color ?? "#6b7280";
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px]"
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {node.label}
                    </span>
                  );
                })}
              </div>

              {/* curriculum suggestion for cARL */}
              {gap.curriculumSuggestion && (
                <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                  <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 mb-0.5">
                    cARL curriculum suggestion
                  </p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300/80">
                    {gap.curriculumSuggestion}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* curriculum summary */}
      {curriculumGaps.length > 0 && filterType === "all" && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            curriculum recommendations for cARL
          </h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-400/80">
            the knowledge graph reveals {curriculumGaps.length} gaps that cARL can address
            through targeted research. these become curriculum topics — each one strengthens
            a specific part of the collective&apos;s knowledge infrastructure.
          </p>
          <ol className="space-y-1.5 list-decimal list-inside">
            {curriculumGaps.map((g, i) => (
              <li key={i} className="text-xs text-emerald-800 dark:text-emerald-300/80">
                {g.curriculumSuggestion}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
