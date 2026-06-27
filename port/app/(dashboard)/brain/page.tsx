import { PageHeader } from "@/app/components/page-header";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { GRAPH_DATA, computeGaps } from "@/lib/knowledge/graph-data";
import { KnowledgeGraph } from "./components/knowledge-graph";
import { GapAnalysis } from "./components/gap-analysis";

export const dynamic = "force-dynamic";

const TABS: readonly TabDef[] = [
  { key: "graph", label: "knowledge graph" },
  { key: "gaps", label: "gap analysis" },
];

// ── helpers ──────────────────────────────────────────────────

function countCategories(nodes: typeof GRAPH_DATA.nodes) {
  const cats = new Set(nodes.map((n) => n.category));
  return cats.size;
}

function countAgents(nodes: typeof GRAPH_DATA.nodes) {
  const agents = new Set(nodes.filter((n) => n.category === "agent").map((n) => n.id));
  return agents.size;
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

  const gaps = computeGaps(GRAPH_DATA);
  const highSeverity = gaps.filter((g) => g.severity === "high").length;
  const curriculumItems = gaps.filter((g) => g.curriculumSuggestion).length;

  return (
    <>
      <PageHeader
        title="brain"
        description="collective knowledge graph — how everything connects"
      />

      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">nodes</p>
            <p className="text-xl font-semibold tabular-nums">{GRAPH_DATA.nodes.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">connections</p>
            <p className="text-xl font-semibold tabular-nums">{GRAPH_DATA.edges.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">categories</p>
            <p className="text-xl font-semibold tabular-nums">
              {countCategories(GRAPH_DATA.nodes)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">gaps found</p>
            <p className="text-xl font-semibold tabular-nums">
              {gaps.length}
              {highSeverity > 0 && (
                <span className="ml-1.5 text-xs font-normal text-red-500">
                  ({highSeverity} high)
                </span>
              )}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground -mt-2 px-1">
          {countAgents(GRAPH_DATA.nodes)} agents · {countCategories(GRAPH_DATA.nodes)} node
          categories · {curriculumItems} curriculum suggestions for cARL
        </p>

        <UrlTabs tabs={TABS} activeTab={activeTab} />

        {activeTab === "graph" && <KnowledgeGraph />}
        {activeTab === "gaps" && <GapAnalysis />}
      </div>
    </>
  );
}
