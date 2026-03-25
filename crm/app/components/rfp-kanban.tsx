"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { DraggableKanban, type KanbanColumn } from "./draggable-kanban";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, DollarSign, ExternalLink } from "lucide-react";
import { computeWinProbability, WinProbabilityBadge } from "./ai-win-probability";
import type { RfpOpportunity } from "@/lib/notion/types";

const STATUS_COLUMNS: KanbanColumn[] = [
  { key: "radar", label: "radar", color: "bg-blue-500" },
  { key: "reviewing", label: "reviewing", color: "bg-yellow-500" },
  { key: "pursuing", label: "pursuing", color: "bg-orange-500" },
  { key: "interviewing", label: "interviewing", color: "bg-cyan-500" },
  { key: "submitted", label: "submitted", color: "bg-purple-500" },
];

const FIT_COLORS: Record<string, string> = {
  "high fit": "bg-green-100 text-green-700 border-green-200",
  "medium fit": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "low fit": "bg-gray-100 text-gray-600 border-gray-200",
  "TBD": "bg-blue-50 text-blue-600 border-blue-200",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(value: number | null): string {
  if (!value) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

type RfpKanbanItem = RfpOpportunity & { kanbanStatus: string };

function RfpCard({ rfp }: { rfp: RfpKanbanItem }) {
  const deadlineDays = daysUntil(rfp.dueDate?.start);
  const deadlineUrgent = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 7;
  const overdue = deadlineDays !== null && deadlineDays < 0;

  return (
    <Card className={`hover:shadow-md transition-shadow ${deadlineUrgent ? "border-destructive/50" : ""}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{rfp.opportunityName}</p>
          {rfp.url && (
            <a href={rfp.url} target="_blank" rel="noopener noreferrer" className="shrink-0"
              onClick={(e) => e.stopPropagation()}>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {rfp.opportunityType && (
            <Badge variant="outline" className="text-[10px]">{rfp.opportunityType}</Badge>
          )}
          {rfp.wvFitScore && (
            <Badge variant="outline" className={`text-[10px] ${FIT_COLORS[rfp.wvFitScore] ?? ""}`}>
              {rfp.wvFitScore}
            </Badge>
          )}
          <WinProbabilityBadge probability={computeWinProbability(rfp)} />
        </div>
        {rfp.dueDate?.start && (
          <div className={`flex items-center gap-1.5 text-xs ${overdue ? "text-destructive" : deadlineUrgent ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            <CalendarDays className="h-3 w-3" />
            <span>
              {overdue ? "overdue" : formatDate(rfp.dueDate.start)}
              {deadlineDays !== null && deadlineDays >= 0 && ` (${deadlineDays}d)`}
            </span>
          </div>
        )}
        {(rfp.estimatedValue ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span>{formatCurrency(rfp.estimatedValue)}</span>
          </div>
        )}
        {rfp.serviceMatch.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {rfp.serviceMatch.slice(0, 3).map((s) => (
              <span key={s} className="text-[9px] text-muted-foreground bg-muted px-1 rounded">{s}</span>
            ))}
            {rfp.serviceMatch.length > 3 && (
              <span className="text-[9px] text-muted-foreground">+{rfp.serviceMatch.length - 3}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RfpKanbanProps {
  opportunities: RfpOpportunity[];
}

export function RfpKanban({ opportunities }: RfpKanbanProps) {
  const router = useRouter();

  const items: RfpKanbanItem[] = opportunities
    .filter((r) => ["radar", "reviewing", "pursuing", "interviewing", "submitted"].includes(r.status))
    .map((r) => ({ ...r, kanbanStatus: r.status }));

  const handleStatusChange = useCallback(
    async (itemId: string, newStatus: string) => {
      await fetch(`/crm/api/rfp-radar/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    },
    [router],
  );

  const renderCard = useCallback(
    (item: RfpKanbanItem) => <RfpCard rfp={item} />,
    [],
  );

  return (
    <DraggableKanban
      columns={STATUS_COLUMNS}
      items={items}
      renderCard={renderCard}
      onStatusChange={handleStatusChange}
    />
  );
}
