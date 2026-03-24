"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard } from "./kanban-board";
import type { Organization, ConnectionStatus, OutreachStatus } from "@/lib/notion/types";

const CONNECTION_COLUMNS: { key: ConnectionStatus; label: string }[] = [
  { key: "unengaged", label: "Unengaged" },
  { key: "exploring", label: "Exploring" },
  { key: "in progress", label: "In Progress" },
  { key: "collaborating", label: "Collaborating" },
  { key: "champion", label: "Champion" },
  { key: "steward", label: "Steward" },
  { key: "past client", label: "Past Client" },
];

const OUTREACH_COLUMNS: { key: OutreachStatus; label: string }[] = [
  { key: "Not started", label: "Not Started" },
  { key: "Researching", label: "Researching" },
  { key: "Contacted", label: "Contacted" },
  { key: "In conversation", label: "In Conversation" },
  { key: "Proposal sent", label: "Proposal Sent" },
  { key: "Active client", label: "Active Client" },
];

interface PipelineBoardProps {
  organizations: Organization[];
}

export function PipelineBoard({ organizations }: PipelineBoardProps) {
  const [groupBy, setGroupBy] = useState<"connection" | "outreach">("connection");

  const columns =
    groupBy === "connection"
      ? CONNECTION_COLUMNS.map((col) => ({
          key: col.key,
          label: col.label,
          items: organizations.filter((o) => o.connection === col.key),
        }))
      : OUTREACH_COLUMNS.map((col) => ({
          key: col.key,
          label: col.label,
          items: organizations.filter((o) => o.outreachStatus === col.key),
        }));

  return (
    <div className="space-y-4">
      <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as "connection" | "outreach")}>
        <TabsList>
          <TabsTrigger value="connection">connection status</TabsTrigger>
          <TabsTrigger value="outreach">outreach status</TabsTrigger>
        </TabsList>
      </Tabs>
      <KanbanBoard columns={columns} />
    </div>
  );
}
