import { PageHeader } from "@/app/components/page-header";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { AgentMemoryPanel } from "@/app/components/agent-memory-panel";
import { AgentLogTab } from "@/app/components/agent-log-tab";
import { getPamCommitments, getPamMemory, getPamDecisions } from "@/lib/supabase/pam";
import { CommitmentsBoard } from "./components/commitments-board";
import { AddCommitmentDialog } from "./components/add-commitment-dialog";

export const dynamic = "force-dynamic";

const TABS: readonly TabDef[] = [
  { key: "commitments", label: "commitments" },
  { key: "memory", label: "memory" },
  { key: "log", label: "log" },
];

export default async function PamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const activeTab = TABS.find((t) => t.key === tabParam)?.key ?? "commitments";

  const [commitments, memory, decisions] = await Promise.all([
    getPamCommitments({ limit: 300 }).catch(() => []),
    getPamMemory().catch(() => []),
    getPamDecisions({ days: 90 }).catch(() => []),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const active = commitments.filter((c) => !["done", "parked"].includes(c.status));
  const overdue = active.filter((c) => c.due_date && c.due_date < today);
  const blocked = active.filter((c) => c.status === "blocked");

  return (
    <div className="space-y-6">
      <PageHeader
        title="PaM"
        description="project + momentum manager · commitments, dependencies, follow-ups"
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">active</p>
          <p className="text-xl font-semibold tabular-nums">{active.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">overdue</p>
          <p className={`text-xl font-semibold tabular-nums ${overdue.length > 0 ? "text-destructive" : ""}`}>
            {overdue.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">blocked</p>
          <p className={`text-xl font-semibold tabular-nums ${blocked.length > 0 ? "text-yellow-600" : ""}`}>
            {blocked.length}
          </p>
        </div>
      </div>

      <UrlTabs tabs={TABS} activeTab={activeTab} />

      {activeTab === "commitments" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <AddCommitmentDialog />
          </div>
          <CommitmentsBoard commitments={commitments} />
        </div>
      )}
      {activeTab === "memory" && <AgentMemoryPanel entries={memory} />}
      {activeTab === "log" && <AgentLogTab decisions={decisions} agentName="PaM" />}
    </div>
  );
}
