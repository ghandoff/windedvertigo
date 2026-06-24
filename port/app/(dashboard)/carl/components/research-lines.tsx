"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, ChevronLeft, Circle, CircleDot, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { CarlFinding, CarlDomain } from "@/lib/supabase/carl";
import type { CarlCurriculumTopic } from "@/lib/supabase/carl-curriculum";
import { SearchFacets } from "./search-facets";
import { ThinSpotWorklist } from "./thin-spot-worklist";

const SECTION_ORDER = ["learning & pedagogy", "marketing & growth", "delivery & ops", "mission research"] as const;

const AGENT_LABELS: Record<string, string> = {
  carl: "cARL — collective research",
  mo: "Mo — CMO / strategy",
  pam: "PaM — project management",
  biz: "Biz — business development",
  garrett: "Garrett",
  jamie: "Jamie",
  payton: "Payton",
  lamis: "Lamis",
};

function agentLabel(a: string) {
  return AGENT_LABELS[a] ?? a;
}

// deterministic soft colour per domain (fallback when no domain meta)
function domainHue(d: string): number {
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) % 360;
  return h;
}

interface Line {
  domain: string;
  findings: CarlFinding[];
  topics: CarlCurriculumTopic[];
  meta: CarlDomain | null;
}

// ── domain tile ───────────────────────────────────────────────────────────────

function DomainTile({ line, onSelect }: { line: Line; onSelect: () => void }) {
  const depthTarget = line.meta?.depth_target ?? 12;
  const count = line.findings.length;
  const pct = Math.min((count / depthTarget) * 100, 100);
  const needsDepth = count < 10;
  const latest = line.findings[0];
  const daysSince = latest?.created_at
    ? Math.floor((Date.now() - new Date(latest.created_at).getTime()) / 86400000)
    : null;
  const hue = line.meta ? null : domainHue(line.domain);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "text-left rounded-lg border bg-card p-3 space-y-2 hover:shadow-md transition-shadow",
        needsDepth ? "border-amber-500/30" : "border-border",
      )}
      style={hue !== null ? { borderLeftWidth: 3, borderLeftColor: `hsl(${hue} 55% 60%)` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight">{line.domain}</span>
        {needsDepth && count === 0 && (
          <span className="shrink-0 text-[9px] uppercase tracking-wider text-amber-600/80 font-medium mt-0.5">empty</span>
        )}
      </div>

      {/* depth bar */}
      <div className="space-y-0.5">
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct >= 100 ? "bg-emerald-500" : needsDepth ? "bg-amber-400" : "bg-primary/60",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className={cn("tabular-nums", needsDepth && count > 0 ? "text-amber-600/80" : "")}>
            {count} / {depthTarget}
          </span>
          {daysSince !== null && (
            <span className={cn(daysSince > 30 ? "text-amber-500/70" : "")}>
              {daysSince === 0 ? "today" : daysSince === 1 ? "yesterday" : `${daysSince}d ago`}
            </span>
          )}
        </div>
      </div>

      {latest ? (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{latest.title}</p>
      ) : (
        <p className="text-xs text-amber-600/70 italic">no findings yet</p>
      )}

      {line.topics.length > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Circle className="h-2.5 w-2.5" />
          <span>
            {line.topics.filter((t) => t.status === "covered").length}/{line.topics.length} topics
          </span>
        </div>
      )}
    </button>
  );
}

// ── section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap">
        {title}
      </h3>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function ResearchLines({
  findings,
  curriculum,
  intendedDomains,
  domains = [],
  defaultViewMode = "domain",
}: {
  findings: CarlFinding[];
  curriculum: CarlCurriculumTopic[];
  intendedDomains: string[];
  domains?: CarlDomain[];
  defaultViewMode?: "domain" | "agent";
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"domain" | "agent">(defaultViewMode);
  const [search, setSearch] = useState("");
  const [filterNeedsDepth, setFilterNeedsDepth] = useState(false);
  const [filterAgent, setFilterAgent] = useState<string | null>(null);

  const hasMeta = domains.length > 0;

  const lines: Line[] = useMemo(() => {
    const map = new Map<string, Line>();
    const ensure = (d: string) => {
      if (!map.has(d)) {
        const meta = hasMeta
          ? (domains.find((dm) => dm.label.toLowerCase() === d.toLowerCase()) ?? null)
          : null;
        map.set(d, { domain: d, findings: [], topics: [], meta });
      }
      return map.get(d)!;
    };
    for (const c of curriculum) ensure(c.domain).topics.push(c);
    for (const f of findings) ensure(f.domain).findings.push(f);
    for (const d of intendedDomains) ensure(d);
    // ensure every canonical domain appears even if nothing filed yet
    for (const dm of domains) {
      const entry = ensure(dm.label);
      if (!entry.meta) entry.meta = dm;
    }
    return [...map.values()].sort((a, b) => {
      const ao = a.meta?.sort_order ?? 999;
      const bo = b.meta?.sort_order ?? 999;
      if (ao !== bo) return ao - bo;
      return a.domain.localeCompare(b.domain);
    });
  }, [findings, curriculum, intendedDomains, domains, hasMeta]);

  const filteredLines = useMemo(() => {
    let result = lines;
    if (filterNeedsDepth) result = result.filter((l) => l.findings.length < 10);
    if (filterAgent) result = result.filter((l) => l.meta?.agent_owner === filterAgent);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.domain.toLowerCase().includes(q) ||
          l.findings.some(
            (f) => f.title.toLowerCase().includes(q) || f.summary.toLowerCase().includes(q),
          ),
      );
    }
    return result;
  }, [lines, filterNeedsDepth, filterAgent, search]);

  const availableAgents = useMemo(() => {
    const agents = new Set(lines.map((l) => l.meta?.agent_owner).filter(Boolean) as string[]);
    return [...agents].sort();
  }, [lines]);

  const thinSpots = useMemo(
    () => filteredLines.filter((l) => l.findings.length < 10),
    [filteredLines],
  );

  // grouped by section (by-domain) or by agent_owner (by-agent)
  const groups: { title: string; lines: Line[] }[] = useMemo(() => {
    if (!hasMeta) return [{ title: "", lines: filteredLines }];
    if (viewMode === "agent") {
      const byAgent = new Map<string, Line[]>();
      for (const l of filteredLines) {
        const a = l.meta?.agent_owner ?? "unassigned";
        if (!byAgent.has(a)) byAgent.set(a, []);
        byAgent.get(a)!.push(l);
      }
      return [...byAgent.entries()].map(([a, ls]) => ({ title: agentLabel(a), lines: ls }));
    }
    // by-domain: group by section
    const sectioned: { title: string; lines: Line[] }[] = SECTION_ORDER.map((s) => ({
      title: s,
      lines: filteredLines.filter((l) => (l.meta?.section ?? "").toLowerCase() === s),
    }));
    const uncategorised = filteredLines.filter(
      (l) => !SECTION_ORDER.includes(l.meta?.section as (typeof SECTION_ORDER)[number]),
    );
    if (uncategorised.length > 0) sectioned.push({ title: "other", lines: uncategorised });
    return sectioned.filter((g) => g.lines.length > 0);
  }, [hasMeta, viewMode, filteredLines]);

  // drill-down view (after all hooks)
  if (selected) {
    const line = lines.find((l) => l.domain === selected);
    if (line) return <DomainDetail line={line} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <SearchFacets
        search={search}
        onSearchChange={setSearch}
        filterNeedsDepth={filterNeedsDepth}
        onFilterNeedsDepthChange={setFilterNeedsDepth}
        filterAgent={filterAgent}
        onFilterAgentChange={setFilterAgent}
        availableAgents={availableAgents}
        agentLabel={agentLabel}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={hasMeta}
      />

      {!filterNeedsDepth && thinSpots.length > 0 && (
        <ThinSpotWorklist
          lines={thinSpots.map((l) => ({ domain: l.domain, count: l.findings.length }))}
          onSelect={setSelected}
        />
      )}

      {groups.map((group) => (
        <div key={group.title || "all"} className="space-y-2.5">
          {group.title && <SectionHeader title={group.title} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.lines.map((l) => (
              <DomainTile key={l.domain} line={l} onSelect={() => setSelected(l.domain)} />
            ))}
          </div>
        </div>
      ))}

      {filteredLines.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">no domains match the current filters</p>
      )}
    </div>
  );
}

// ── domain detail ─────────────────────────────────────────────────────────────

const STATUS_ICON = {
  covered: <CheckCircle2 className="h-3 w-3 text-green-600" />,
  "in-progress": <CircleDot className="h-3 w-3 text-yellow-600" />,
  planned: <Circle className="h-3 w-3 text-muted-foreground/50" />,
} as const;

function DomainDetail({ line, onBack }: { line: Line; onBack: () => void }) {
  const hue = line.meta ? null : domainHue(line.domain);
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> all research lines
      </button>

      <div className="flex items-center gap-2">
        <BookOpen
          className="h-5 w-5"
          style={hue !== null ? { color: `hsl(${hue} 50% 50%)` } : undefined}
        />
        <h3 className="text-lg font-semibold">{line.domain}</h3>
        {line.meta?.agent_owner && (
          <span className="text-xs text-muted-foreground">· {agentLabel(line.meta.agent_owner)}</span>
        )}
      </div>

      {line.meta && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{line.findings.length} / {line.meta.depth_target} findings</span>
          <span>·</span>
          <span>{line.meta.section}</span>
        </div>
      )}

      {line.topics.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">curriculum</p>
          {line.topics.map((t) => (
            <div key={t.id} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0">{STATUS_ICON[t.status]}</span>
              <div>
                <span className={t.status === "covered" ? "text-muted-foreground" : "text-foreground"}>
                  {t.topic}
                </span>
                {t.requested_by && (
                  <span className="text-[11px] text-primary/70 ml-1.5">· requested by {t.requested_by}</span>
                )}
                {t.key_works?.length > 0 && (
                  <span className="text-[11px] text-muted-foreground italic">
                    {" "}— {t.key_works.join("; ")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          findings ({line.findings.length})
        </p>
        {line.findings.length === 0 ? (
          <p className="text-sm text-amber-600/80 italic">
            nothing logged here yet — ask cARL to research this line, or let scheduled study cover it.
          </p>
        ) : (
          line.findings.map((f) => (
            <Card key={f.id} className="border-l-2 border-l-primary/30">
              <CardContent className="pt-3 space-y-1.5">
                <p className="text-sm font-medium leading-tight">{f.title}</p>
                {f.subtopic && (
                  <p className="text-[11px] text-primary/70">{f.subtopic}</p>
                )}
                <p className="text-sm text-muted-foreground leading-relaxed">{f.summary}</p>
                {f.relevance && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">for our work: </span>
                    {f.relevance}
                  </p>
                )}
                {(f.citation || f.source) && (
                  <p className="text-[11px] text-muted-foreground italic">{f.citation || f.source}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  logged {formatDate(f.created_at.slice(0, 10))}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
