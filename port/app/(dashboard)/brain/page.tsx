import { PageHeader } from "@/app/components/page-header";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { GRAPH_DATA } from "@/lib/knowledge/graph-data";
import { fetchGraphData } from "@/lib/knowledge/supabase";
import { fetchAttributionData } from "@/lib/knowledge/attribution";
import { computeGaps } from "@/lib/knowledge/gaps";
import type { GraphData, GraphNode } from "@/lib/knowledge/types";
import { KnowledgeGraph } from "./components/knowledge-graph";
import { GapAnalysis } from "./components/gap-analysis";
import { AttributionPanel } from "./components/attribution-panel";

export const dynamic = "force-dynamic";

const TABS: readonly TabDef[] = [
  { key: "graph", label: "knowledge graph" },
  { key: "gaps", label: "gap analysis" },
  { key: "attribution", label: "attribution" },
];

// ── helpers ──────────────────────────────────────────────────

function countCategories(nodes: GraphNode[]) {
  return new Set(nodes.map((n) => n.category)).size;
}

function countKind(nodes: GraphNode[], kind: string) {
  return nodes.filter((n) => (n.kind ?? "agent") === kind).length;
}

// ── attribution tab (lazy — only fetches when the tab is active) ─────────

async function AttributionTabContent() {
  try {
    const { records, cvEntryOptions } = await fetchAttributionData();
    return <AttributionPanel records={records} cvEntryOptions={cvEntryOptions} />;
  } catch (err) {
    console.error("[brain/attribution] fetchAttributionData failed:", err);
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
        could not load attribution data — check the server logs
      </div>
    );
  }
}

// ── page ─────────────────────────────────────────────────────

export default async function BrainPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const activeTab = TABS.find((t) => t.key === tabParam)?.key ?? "graph";
  const focus = typeof sp.focus === "string" ? sp.focus : null;

  // live from Supabase, falling back to the committed const snapshot
  const live = await fetchGraphData();
  const data: GraphData = live ?? GRAPH_DATA;
  const isLive = live !== null;

  const gaps = computeGaps(data);
  const highSeverity = gaps.filter((g) => g.severity === "high").length;
  const curriculumItems = gaps.filter((g) => g.curriculumSuggestion).length;

  // nodes the gap engine flags as stale / under-evidenced → dashed-ring badge
  const staleNodeIds = new Set(
    gaps
      .filter((g) => g.type === "claimed-unevidenced" || g.type === "service-coverage")
      .flatMap((g) => g.nodeIds),
  );

  const humans = countKind(data.nodes, "human");
  const sharedNodes = countKind(data.nodes, "shared");
  const bridges = data.edges.filter((e) => e.relationship === "same-as").length;

  return (
    <>
      <PageHeader title="brain" description="collective knowledge graph — humans + agents, how everything connects" />

      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">nodes</p>
            <p className="text-xl font-semibold tabular-nums">{data.nodes.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">connections</p>
            <p className="text-xl font-semibold tabular-nums">{data.edges.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">merge bridges</p>
            <p className="text-xl font-semibold tabular-nums">{bridges}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">gaps found</p>
            <p className="text-xl font-semibold tabular-nums">
              {gaps.length}
              {highSeverity > 0 && (
                <span className="ml-1.5 text-xs font-normal text-red-500">({highSeverity} high)</span>
              )}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground -mt-2 px-1">
          {humans} human · {sharedNodes} shared · {countCategories(data.nodes)} node categories ·{" "}
          {curriculumItems} curriculum suggestions for cARL
          {!isLive && <span className="ml-1 text-amber-500">· snapshot (db unreachable)</span>}
        </p>

        <UrlTabs tabs={TABS} activeTab={activeTab} />

        {activeTab === "graph" && <KnowledgeGraph data={data} staleNodeIds={staleNodeIds} initialFocus={focus} />}
        {activeTab === "gaps" && <GapAnalysis data={data} gaps={gaps} />}
        {activeTab === "attribution" && <AttributionTabContent />}
      </div>
    </>
  );
}
