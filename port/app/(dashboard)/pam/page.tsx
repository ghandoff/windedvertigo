import { PageHeader } from "@/app/components/page-header";
import { AssignResearchTopic } from "@/app/components/assign-research-topic";
import { CarlInsightsPanel, splitCarlInsights } from "@/app/components/carl-insights-panel";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { AgentPageWithChat } from "@/app/components/agent-page-with-chat";
import { getPamCommitments, getPamMemory, getPamDecisions, getWhirlpoolCommitments } from "@/lib/supabase/pam";
import { listPendingTriageActions } from "@/lib/supabase/meeting-action-items";
import { getCollectivePulse } from "@/lib/pam/pulse";
import { getProjectTimeline } from "@/lib/pam/project-timeline";
import { CommitmentsBoard } from "./components/commitments-board";
import { ProjectTimeline } from "./components/project-timeline";
import { AddCommitmentDialog } from "./components/add-commitment-dialog";
import { WhirlpoolBoard } from "./components/whirlpool-board";
import { MeetingActionsInbox, type InboxItem } from "./components/meeting-actions-inbox";
import { CollectivePulse } from "./components/collective-pulse";
import { BrainTab } from "./components/brain-tab";

export const dynamic = "force-dynamic";

const TABS: readonly TabDef[] = [
  { key: "whirlpool", label: "whirlpool" },
  { key: "commitments", label: "commitments" },
  { key: "inbox", label: "inbox" },
  { key: "pulse", label: "pulse" },
  { key: "timeline", label: "timeline" },
  { key: "brain", label: "brain" },
];

export default async function PamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const activeTab = TABS.find((t) => t.key === tabParam)?.key ?? "whirlpool";

  // current whirlpool cycle = ISO Monday of this week
  const todayUTC = new Date();
  const dayOfWeek = todayUTC.getUTCDay(); // 0=Sun … 6=Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(todayUTC);
  monday.setUTCDate(todayUTC.getUTCDate() + mondayOffset);
  const currentCycle = monday.toISOString().slice(0, 10);

  const [commitments, memory, decisions, whirlpoolCommitments, pendingActions, pulse, projectTimeline] = await Promise.all([
    getPamCommitments({ limit: 300 }).catch(() => []),
    getPamMemory().catch(() => []),
    getPamDecisions({ days: 90 }).catch(() => []),
    getWhirlpoolCommitments(currentCycle).catch(() => []),
    listPendingTriageActions().catch(() => []),
    // Only hit the cross-system reads when the pulse tab is actually open.
    activeTab === "pulse" ? getCollectivePulse(currentCycle).catch(() => null) : Promise.resolve(null),
    activeTab === "timeline" ? getProjectTimeline().catch(() => []) : Promise.resolve([]),
  ]);

  // Lookup so the inbox can render a merge target's "who · what" from its id.
  const commitmentLookup: Record<string, string> = Object.fromEntries(
    commitments.map((c) => [c.id, `${c.who} · ${c.what}`]),
  );
  const inboxItems: InboxItem[] = pendingActions.map((a) => ({
    id: a.id,
    title: a.title,
    ownerName: a.ownerName,
    ownerEmail: a.ownerEmail,
    meetingId: a.meetingId,
    deadline: a.deadline,
    context: a.context,
    suggestion: a.triageSuggestion,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const active = commitments.filter((c) => !["done", "parked"].includes(c.status));
  const overdue = active.filter((c) => c.due_date && c.due_date < today);
  const blocked = active.filter((c) => c.status === "blocked");

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-3">
        <PageHeader
          title="PaM"
          description="project + momentum manager · what i'm doing this week (projects = what we're building)"
        />
        <AssignResearchTopic assignedBy="PaM" label="brief cARL" />
      </div>
      <AgentPageWithChat agentId="pam">
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-3">
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
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">this week</p>
            <p className="text-xl font-semibold tabular-nums">
              {whirlpoolCommitments.filter((c) => c.status === "done").length}/{whirlpoolCommitments.length}
            </p>
          </div>
        </div>

        <CarlInsightsPanel entries={memory} />

        <UrlTabs
          tabs={TABS.map((t) =>
            t.key === "inbox" && inboxItems.length > 0
              ? { ...t, label: `inbox (${inboxItems.length})` }
              : t,
          )}
          activeTab={activeTab}
        />

        {activeTab === "whirlpool" && (
          <WhirlpoolBoard commitments={whirlpoolCommitments} cycle={currentCycle} />
        )}
        {activeTab === "commitments" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <AddCommitmentDialog />
            </div>
            <CommitmentsBoard commitments={commitments} />
          </div>
        )}
        {activeTab === "inbox" && (
          <MeetingActionsInbox items={inboxItems} commitmentLookup={commitmentLookup} />
        )}
        {activeTab === "pulse" && pulse && <CollectivePulse pulse={pulse} />}
        {activeTab === "timeline" && <ProjectTimeline projects={projectTimeline} />}
        {activeTab === "brain" && (
          <BrainTab memory={splitCarlInsights(memory).working} decisions={decisions} />
        )}
      </div>
    </AgentPageWithChat>
    </>
  );
}
