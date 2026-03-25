"use client";

import { useEffect, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Blueprint, StepChannel } from "@/lib/notion/types";

const CATEGORY_COLORS: Record<string, string> = {
  "event-based": "bg-purple-100 text-purple-700 border-purple-200",
  outreach: "bg-blue-100 text-blue-700 border-blue-200",
  nurture: "bg-green-100 text-green-700 border-green-200",
  social: "bg-orange-100 text-orange-700 border-orange-200",
  "follow-up": "bg-yellow-100 text-yellow-700 border-yellow-200",
};

interface BlueprintPickerProps {
  selectedChannels: StepChannel[];
  onSelect: (blueprint: Blueprint) => void;
  onCustom: () => void;
}

export function BlueprintPicker({ selectedChannels, onSelect, onCustom }: BlueprintPickerProps) {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/crm/api/blueprints?pageSize=20")
      .then((r) => r.json())
      .then((d) => {
        let items = d.data ?? [];
        // Filter to blueprints that match at least one selected channel
        if (selectedChannels.length > 0) {
          items = items.filter((bp: Blueprint) =>
            bp.channels.some((c) => selectedChannels.includes(c)),
          );
        }
        setBlueprints(items);
      })
      .catch(() => setBlueprints([]))
      .finally(() => setLoading(false));
  }, [selectedChannels]);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground text-sm">loading blueprints...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {blueprints.length > 0
          ? "choose a pre-built sequence or start from scratch"
          : "no blueprints match your channel selection — start from scratch"}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {blueprints.map((bp) => (
          <Card
            key={bp.id}
            className="cursor-pointer hover:shadow-md hover:border-accent/50 transition-all"
            onClick={() => onSelect(bp)}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <h3 className="font-medium text-sm">{bp.name}</h3>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{bp.description}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[bp.category] ?? ""}`}>
                  {bp.category}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {bp.stepCount} steps
                </Badge>
                {bp.totalDays > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {bp.totalDays} days
                  </Badge>
                )}
              </div>
              <div className="flex gap-1">
                {bp.channels.map((c) => (
                  <span key={c} className="text-[10px] text-muted-foreground">{c}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Start from scratch */}
        <Card
          className="cursor-pointer hover:shadow-md hover:border-accent/50 transition-all border-dashed"
          onClick={onCustom}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium text-sm">start from scratch</h3>
              <p className="text-xs text-muted-foreground">build your own step-by-step</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
