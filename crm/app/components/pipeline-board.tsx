"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DraggableKanban, type KanbanColumn } from "./draggable-kanban";
import { OrgCard } from "./org-card";
import { AiPipelineNudges } from "./ai-pipeline-nudges";
import type { Organization, ConnectionStatus, OutreachStatus } from "@/lib/notion/types";

const CONNECTION_COLUMNS: KanbanColumn[] = [
  { key: "unengaged", label: "unengaged", color: "bg-blue-400" },
  { key: "exploring", label: "exploring", color: "bg-yellow-400" },
  { key: "in progress", label: "in progress", color: "bg-orange-400" },
  { key: "collaborating", label: "collaborating", color: "bg-green-500" },
  { key: "champion", label: "champion", color: "bg-emerald-500" },
  { key: "steward", label: "steward", color: "bg-pink-500" },
  { key: "past client", label: "past client", color: "bg-gray-400" },
];

const OUTREACH_COLUMNS: KanbanColumn[] = [
  { key: "Not started", label: "not started", color: "bg-gray-400" },
  { key: "Researching", label: "researching", color: "bg-blue-400" },
  { key: "Contacted", label: "contacted", color: "bg-yellow-400" },
  { key: "In conversation", label: "in conversation", color: "bg-orange-400" },
  { key: "Proposal sent", label: "proposal sent", color: "bg-pink-500" },
  { key: "Active client", label: "active client", color: "bg-green-500" },
];

interface PipelineBoardProps {
  organizations: Organization[];
}

type OrgKanbanItem = Organization & { kanbanStatus: string };

export function PipelineBoard({ organizations }: PipelineBoardProps) {
  const [groupBy, setGroupBy] = useState<"connection" | "outreach">("connection");
  const router = useRouter();

  // Map organizations to kanban items with the correct "status" field
  const items: OrgKanbanItem[] = organizations.map((org) => ({
    ...org,
    kanbanStatus: groupBy === "connection" ? org.connection : org.outreachStatus,
  }));

  const columns = groupBy === "connection" ? CONNECTION_COLUMNS : OUTREACH_COLUMNS;

  const handleStatusChange = useCallback(
    async (itemId: string, newStatus: string) => {
      const field = groupBy === "connection" ? "connection" : "outreachStatus";
      await fetch(`/crm/api/organizations/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newStatus }),
      });
      router.refresh();
    },
    [groupBy, router],
  );

  const renderCard = useCallback(
    (item: OrgKanbanItem) => <OrgCard org={item as Organization} />,
    [],
  );

  return (
    <div className="space-y-4">
      <AiPipelineNudges />
      <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as "connection" | "outreach")}>
        <TabsList>
          <TabsTrigger value="connection">connection status</TabsTrigger>
          <TabsTrigger value="outreach">outreach status</TabsTrigger>
        </TabsList>
      </Tabs>
      <DraggableKanban
        columns={columns}
        items={items}
        renderCard={renderCard}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
