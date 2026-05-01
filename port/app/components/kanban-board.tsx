"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OrgCard } from "./org-card";
import type { Organization } from "@/lib/notion/types";

interface KanbanColumn {
  key: string;
  label: string;
  items: Organization[];
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
}

export function KanbanBoard({ columns }: KanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
      {columns.map((col) => (
        <div
          key={col.key}
          className="flex-shrink-0 w-72 bg-muted/50 rounded-lg"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b">
            <h3 className="text-sm font-medium text-foreground">{col.label}</h3>
            <Badge variant="secondary" className="text-xs">
              {col.items.length}
            </Badge>
          </div>
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="p-2 space-y-2">
              {col.items.map((org) => (
                <OrgCard key={org.id} org={org} />
              ))}
              {col.items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No organizations
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
