"use client";

import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AudienceFilter } from "@/lib/notion/types";

interface CheckItem {
  label: string;
  passed: boolean;
  warning?: string;
  detail?: string;
}

interface LaunchChecklistProps {
  name: string;
  campaignType: string;
  selectedChannels: string[];
  blueprintName?: string;
  audienceFilters: AudienceFilter;
  audienceCount: number;
  addedCount: number;
  removedCount: number;
  stepCount: number;
  steps: { channel: string; subject: string; body: string }[];
  owner: string;
  startDate: string;
}

export function LaunchChecklist(props: LaunchChecklistProps) {
  const checks: CheckItem[] = [
    {
      label: "campaign name",
      passed: props.name.trim().length > 0,
      warning: !props.name.trim() ? "required — give your campaign a name" : undefined,
      detail: props.name || "not set",
    },
    {
      label: "campaign type",
      passed: true,
      detail: props.campaignType,
    },
    {
      label: "channels",
      passed: props.selectedChannels.length > 0,
      warning: props.selectedChannels.length === 0 ? "select at least one channel" : undefined,
      detail: props.selectedChannels.join(", "),
    },
    {
      label: "blueprint",
      passed: true,
      detail: props.blueprintName ?? "custom (from scratch)",
    },
    {
      label: "audience",
      passed: props.audienceCount > 0 || props.addedCount > 0,
      warning: props.audienceCount === 0 && props.addedCount === 0
        ? "no organizations in audience — add filters or manually add orgs"
        : undefined,
      detail: `${props.audienceCount + props.addedCount} organizations${props.removedCount > 0 ? ` (${props.removedCount} excluded)` : ""}`,
    },
    {
      label: "campaign steps",
      passed: props.stepCount > 0,
      warning: props.stepCount === 0 ? "add at least one step" : undefined,
      detail: `${props.stepCount} step${props.stepCount !== 1 ? "s" : ""}`,
    },
    {
      label: "step content",
      passed: props.steps.every((s) => s.body.trim().length > 0),
      warning: props.steps.some((s) => !s.body.trim())
        ? `${props.steps.filter((s) => !s.body.trim()).length} step(s) have empty body content`
        : undefined,
      detail: props.steps.map((s) =>
        `${s.channel}: ${s.subject || "(no subject)"} — ${s.body.trim() ? `${s.body.trim().length} chars` : "empty"}`
      ).join("\n"),
    },
    {
      label: "owner",
      passed: props.owner.length > 0,
      warning: !props.owner ? "recommended — assign an owner" : undefined,
      detail: props.owner || "not assigned",
    },
    {
      label: "start date",
      passed: true,
      detail: props.startDate
        ? new Date(props.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "not set (will start immediately when activated)",
    },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const warningCount = checks.filter((c) => c.warning).length;
  const allPassed = passedCount === checks.length;
  const hasBlockers = checks.some((c) => !c.passed && c.label === "campaign name" || !c.passed && c.label === "campaign steps");

  return (
    <Card className={warningCount > 0 ? "border-yellow-300" : allPassed ? "border-green-300" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">launch checklist</CardTitle>
          <Badge
            variant={allPassed ? "secondary" : "outline"}
            className={`text-xs ${allPassed ? "bg-green-100 text-green-700" : warningCount > 0 ? "bg-yellow-100 text-yellow-700" : ""}`}
          >
            {passedCount}/{checks.length} ready
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-start gap-2.5 py-1">
            {check.passed ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            ) : check.warning ? (
              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{check.label}</span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {check.detail?.split("\n")[0]}
                </span>
              </div>
              {check.warning && (
                <p className="text-[10px] text-yellow-600 mt-0.5">{check.warning}</p>
              )}
            </div>
          </div>
        ))}

        {hasBlockers && (
          <p className="text-xs text-destructive mt-3 pt-3 border-t">
            fix the items above before creating this campaign.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
