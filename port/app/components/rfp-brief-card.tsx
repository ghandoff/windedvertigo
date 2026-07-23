import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ListChecks, CheckCircle2 } from "lucide-react";
import type { OnePager } from "@/lib/notion/types";

const ELIGIBILITY_STYLE: Record<OnePager["eligibility"]["verdict"], string> = {
  "likely-eligible": "bg-green-50 text-green-700 border-green-200",
  "likely-ineligible": "bg-red-50 text-red-700 border-red-200",
  uncertain: "bg-slate-100 text-slate-600 border-slate-200",
};

// Provenance drives how much to trust the brief. Set explicitly at generation,
// never guessed. The colour makes "no real TOR yet" impossible to miss.
const PROVENANCE: Record<OnePager["sourceBasis"], { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  "verified-tor": {
    label: "from verified TOR",
    cls: "bg-green-50 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
  "unverified-tor-doc": {
    label: "from unverified TOR — confirm",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: AlertTriangle,
  },
  "description-only": {
    label: "from listing only — no TOR yet",
    cls: "bg-red-50 text-red-700 border-red-200",
    icon: AlertTriangle,
  },
};

function BulletList({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium mb-1">{label}</p>
      <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The one-pager "brief" — the cheap review artifact generated at intake (R1) and
 * surfaced as the "glance" on pursuing (R2). Read-only presentational card.
 */
export function RfpBriefCard({ onePager }: { onePager: OnePager }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">brief</CardTitle>
          {(() => {
            const p = PROVENANCE[onePager.sourceBasis ?? "description-only"];
            const Icon = p.icon;
            return (
              <Badge variant="outline" className={`text-[10px] gap-1 ${p.cls}`}>
                <Icon className="h-3 w-3" /> {p.label}
              </Badge>
            );
          })()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {onePager.summary && (
          <p className="text-muted-foreground leading-relaxed">{onePager.summary}</p>
        )}

        {onePager.whyApply && (
          <div>
            <p className="text-xs font-medium mb-1">why apply</p>
            <p className="text-muted-foreground">{onePager.whyApply}</p>
          </div>
        )}

        <div className="flex items-start gap-2">
          <span className="text-xs w-20 shrink-0 text-muted-foreground pt-0.5">eligibility</span>
          <div className="space-y-1">
            <Badge
              variant="outline"
              className={`text-[10px] ${ELIGIBILITY_STYLE[onePager.eligibility.verdict]}`}
            >
              {onePager.eligibility.verdict.replace(/-/g, " ")}
            </Badge>
            {onePager.eligibility.note && (
              <p className="text-muted-foreground text-xs">{onePager.eligibility.note}</p>
            )}
          </div>
        </div>

        <BulletList label="main deliverables" items={onePager.deliverables} />

        {onePager.capabilitiesRequested && (
          <div>
            <p className="text-xs font-medium mb-1">capabilities requested</p>
            <p className="text-muted-foreground">{onePager.capabilitiesRequested}</p>
          </div>
        )}

        {onePager.suggestedApproach && (
          <div>
            <p className="text-xs font-medium mb-1">suggested approach</p>
            <p className="text-muted-foreground">{onePager.suggestedApproach}</p>
          </div>
        )}

        <BulletList label="required conditions" items={onePager.requiredConditions} />
        <BulletList label="required materials" items={onePager.requiredMaterials} />

        {onePager.itemsToVerify.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1 flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5" /> verify before applying
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              {onePager.itemsToVerify.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </div>
        )}

        {!onePager.torIsReal && onePager.torConcern && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            {onePager.torConcern}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
