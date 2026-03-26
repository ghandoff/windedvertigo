"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DraggableKanban, type KanbanColumn } from "./draggable-kanban";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Users } from "lucide-react";
import { DeleteCampaignButton } from "./delete-campaign-button";
import type { Campaign } from "@/lib/notion/types";

const STATUS_COLUMNS: KanbanColumn[] = [
  { key: "draft", label: "draft", color: "bg-gray-400" },
  { key: "active", label: "active", color: "bg-green-500" },
  { key: "paused", label: "paused", color: "bg-yellow-500" },
  { key: "complete", label: "complete", color: "bg-blue-500" },
];

const TYPE_COLORS: Record<string, string> = {
  "event-based": "bg-blue-100 text-blue-700 border-blue-200",
  "recurring cadence": "bg-purple-100 text-purple-700 border-purple-200",
  "one-off blast": "bg-orange-100 text-orange-700 border-orange-200",
};

type CampaignKanbanItem = Campaign & { kanbanStatus: string };

function CampaignCard({ campaign }: { campaign: CampaignKanbanItem }) {
  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm font-medium leading-tight">{campaign.name}</p>
            <DeleteCampaignButton campaignId={campaign.id} campaignName={campaign.name} variant="compact" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {campaign.type && (
              <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[campaign.type] ?? ""}`}>
                {campaign.type}
              </Badge>
            )}
          </div>
          {campaign.owner && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{campaign.owner}</span>
            </div>
          )}
          {campaign.startDate?.start && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              <span>
                {new Date(campaign.startDate.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {campaign.endDate?.start && ` – ${new Date(campaign.endDate.start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

interface CampaignKanbanProps {
  campaigns: Campaign[];
}

export function CampaignKanban({ campaigns }: CampaignKanbanProps) {
  const router = useRouter();

  const items: CampaignKanbanItem[] = campaigns.map((c) => ({
    ...c,
    kanbanStatus: c.status,
  }));

  const handleStatusChange = useCallback(
    async (itemId: string, newStatus: string) => {
      await fetch(`/api/campaigns/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    },
    [router],
  );

  const renderCard = useCallback(
    (item: CampaignKanbanItem) => <CampaignCard campaign={item} />,
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
