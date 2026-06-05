import { PageHeader } from "@/app/components/page-header";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { AgentMemoryPanel } from "@/app/components/agent-memory-panel";
import { AgentLogTab } from "@/app/components/agent-log-tab";
import { getCarlFindings, getCarlMemory, getCarlDecisions } from "@/lib/supabase/carl";
import { FindingsLibrary } from "./components/findings-library";
import { AddFindingDialog } from "./components/add-finding-dialog";

export const dynamic = "force-dynamic";

const TABS: readonly TabDef[] = [
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
  const activeTab = TABS.find((t) => t.key === tabParam)?.key ?? "findings";

  const [findings, memory, decisions] = await Promise.all([
    getCarlFindings({ limit: 200 }).catch(() => []),
    getCarlMemory().catch(() => []),
    getCarlDecisions({ days: 90 }).catch(() => []),
  ]);

  const domains = new Set(findings.map((f) => f.domain));

  return (
    <div className="space-y-6">
      <PageHeader
        title="cARL"
        description="cyber agent of research + learning · the living library"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">findings</p>
          <p className="text-xl font-semibold tabular-nums">{findings.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">domains</p>
          <p className="text-xl font-semibold tabular-nums">{domains.size}</p>
        </div>
      </div>

      <UrlTabs tabs={TABS} activeTab={activeTab} />

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
  );
}
