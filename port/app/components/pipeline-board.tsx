"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DraggableKanban, type KanbanColumn } from "./draggable-kanban";
import { OrgCard } from "./org-card";
import { AiPipelineNudges } from "./ai-pipeline-nudges";
import type { Organization } from "@/lib/notion/types";

/**
 * Unified relationship columns — replaces the old dual CONNECTION_COLUMNS
 * and OUTREACH_COLUMNS with a single 7-stage lifecycle.
 */
const RELATIONSHIP_COLUMNS: KanbanColumn[] = [
  { key: "stranger", label: "stranger", color: "bg-gray-400" },
  { key: "aware", label: "aware", color: "bg-blue-400" },
  { key: "contacted", label: "contacted", color: "bg-yellow-400" },
  { key: "in conversation", label: "in conversation", color: "bg-orange-400" },
  { key: "collaborating", label: "collaborating", color: "bg-green-500" },
  { key: "active partner", label: "active partner", color: "bg-emerald-500" },
  { key: "champion", label: "champion", color: "bg-pink-500" },
];

interface PipelineBoardProps {
  organizations: Organization[];
}

type OrgKanbanItem = Organization & { kanbanStatus: string };

export function PipelineBoard({ organizations }: PipelineBoardProps) {
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
    kanbanStatus: org.relationship,
  }));

  const handleStatusChange = useCallback(
    async (itemId: string, newStatus: string) => {
      // The Kanban drag updates the unified relationship column.
      // Under the hood we still write to the "connection" status property
      // until the Notion schema is migrated.
      const CONNECTION_MAP: Record<string, string> = {
        stranger: "unengaged",
        aware: "exploring",
        contacted: "in progress",
        "in conversation": "collaborating",
        collaborating: "champion",
        "active partner": "steward",
        champion: "steward", // closest available connection status
      };
      const connectionValue = CONNECTION_MAP[newStatus] ?? newStatus;
      await fetch(`/api/organizations/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection: connectionValue }),
      });
      router.refresh();
    },
    [router],
  );

  const renderCard = useCallback(
    (item: OrgKanbanItem) => <OrgCard org={item as Organization} />,
    [],
  );

  return (
    <div className="space-y-4">
      <AiPipelineNudges />
      <div className="flex flex-wrap items-center gap-3">
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
            {filtered.length} of {organizations.length} organisations
          </span>
        )}
      </div>
      <DraggableKanban
        columns={RELATIONSHIP_COLUMNS}
        items={items}
        renderCard={renderCard}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
