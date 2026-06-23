import { PageHeader } from "@/app/components/page-header";
import { AssignResearchTopic } from "@/app/components/assign-research-topic";
import { RunStudyButton } from "./components/run-study-button";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { AgentMemoryPanel } from "@/app/components/agent-memory-panel";
import { AgentLogTab } from "@/app/components/agent-log-tab";
import { AgentPageWithChat } from "@/app/components/agent-page-with-chat";
import { getCarlFindings, getCarlMemory, getCarlDecisions, getCarlDomains } from "@/lib/supabase/carl";
import { getCurriculum } from "@/lib/supabase/carl-curriculum";
import { getUsageSummary } from "@/lib/ai/usage-store";
import { FindingsLibrary } from "./components/findings-library";
import { AddFindingDialog } from "./components/add-finding-dialog";
import { ResearchLines } from "./components/research-lines";

export const dynamic = "force-dynamic";

const TABS: readonly TabDef[] = [
  { key: "research-lines", label: "research lines" },
  { key: "findings", label: "findings" },
  { key: "memory", label: "memory" },
  { key: "log", label: "log" },
];

export default async function CarlPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const activeTab = TABS.find((t) => t.key === tabParam)?.key ?? "research-lines";
  const viewMode = sp.view === "agent" ? "agent" : "domain";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const [findings, memory, decisions, curriculum, usage, domains] = await Promise.all([
    getCarlFindings({ limit: 200 }).catch(() => []),
    getCarlMemory().catch(() => []),
    getCarlDecisions({ days: 90 }).catch(() => []),
    getCurriculum().catch(() => []),
    getUsageSummary(monthStart, now.toISOString()).catch(() => null),
    getCarlDomains().catch(() => []),
  ]);

  // cARL's own token economics this month — transparent, and cheap
  const carlCost =
    (usage?.byFeature["carl-study"]?.costUsd ?? 0) +
    (usage?.byFeature["carl-research"]?.costUsd ?? 0);
  const carlRuns =
    (usage?.byFeature["carl-study"]?.requests ?? 0) +
    (usage?.byFeature["carl-research"]?.requests ?? 0);

  // intended research lines = curriculum domains ∪ the active-research-domains memory value
  const memoryDomains = (memory.find((m) => m.key === "active-research-domains")?.value ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  const intendedDomains = Array.from(
    new Set([...curriculum.map((c) => c.domain), ...memoryDomains]),
  );
  const coveredTopics = curriculum.filter((c) => c.status === "covered").length;

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-3">
        <PageHeader
          title="cARL"
          description="cyber agent of research + learning · the living library"
        />
        <div className="flex items-start gap-2">
          <RunStudyButton />
          <AssignResearchTopic />
        </div>
      </div>
      <AgentPageWithChat agentId="carl">
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">findings</p>
            <p className="text-xl font-semibold tabular-nums">{findings.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">research lines</p>
            <p className="text-xl font-semibold tabular-nums">{intendedDomains.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">curriculum covered</p>
            <p className="text-xl font-semibold tabular-nums">{coveredTopics}/{curriculum.length}</p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground -mt-2 px-1">
          cARL&apos;s learning this month: {carlRuns} study {carlRuns === 1 ? "run" : "runs"} · ${carlCost.toFixed(2)} in tokens ·{" "}
          <a href="/ai-hub" className="underline underline-offset-2 hover:text-foreground">full economics on the ai hub</a>
        </p>

        <UrlTabs tabs={TABS} activeTab={activeTab} />

        {activeTab === "research-lines" && (
          <ResearchLines findings={findings} curriculum={curriculum} intendedDomains={intendedDomains} domains={domains} defaultViewMode={viewMode} />
        )}
        {activeTab === "findings" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <AddFindingDialog />
            </div>
            <FindingsLibrary findings={findings} />
          </div>
        )}
        {activeTab === "memory" && <AgentMemoryPanel entries={memory} />}
        {activeTab === "log" && <AgentLogTab decisions={decisions} agentName="cARL" />}
      </div>
    </AgentPageWithChat>
    </>
  );
}
