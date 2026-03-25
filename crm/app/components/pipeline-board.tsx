"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const [search, setSearch] = useState("");
  const router = useRouter();

  // Filter by search, then map to kanban items
  const filtered = useMemo(() => {
    if (!search.trim()) return organizations;
    const q = search.toLowerCase();
    return organizations.filter((org) =>
      org.organization.toLowerCase().includes(q) ||
      (org.marketSegment ?? "").toLowerCase().includes(q) ||
      (org.type ?? "").toLowerCase().includes(q)
    );
  }, [organizations, search]);

  const items: OrgKanbanItem[] = filtered.map((org) => ({
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
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as "connection" | "outreach")}>
          <TabsList>
            <TabsTrigger value="connection">connection status</TabsTrigger>
            <TabsTrigger value="outreach">outreach status</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="search pipeline..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-56 h-9"
          />
        </div>
        {search && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {organizations.length} organizations
          </span>
        )}
      </div>
      <DraggableKanban
        columns={columns}
        items={items}
        renderCard={renderCard}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
