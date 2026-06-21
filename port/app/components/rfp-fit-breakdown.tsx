/**
 * RfpFitBreakdown — explainable fit-score card for the RFP detail page.
 *
 * Shows the wvFitScore badge plus a grid of signal chips (service match,
 * geography, budget, type) and the triage AI's decisionNotes as context.
 *
 * Renders null when wvFitScore is "TBD" AND decisionNotes is empty — there
 * is simply nothing explainable to show yet.
 */

import { Target, MapPin, Wrench, DollarSign, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RfpOpportunity, WvFitScore } from "@/lib/notion/types";

interface Props {
  rfp: Pick<
    RfpOpportunity,
    | "wvFitScore"
    | "decisionNotes"
    | "serviceMatch"
    | "geography"
    | "estimatedValue"
    | "opportunityType"
  >;
}

const FIT_BADGE: Record<WvFitScore, string> = {
  "high fit":   "bg-green-100 text-green-700 border-green-200",
  "medium fit": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "low fit":    "bg-red-100 text-red-700 border-red-200",
  "TBD":        "bg-gray-100 text-gray-500 border-gray-200",
};

/** Format estimatedValue as "$Xk" or "$Xm" (integers only). */
function formatBudget(value: number | null): string | null {
  if (!value || value <= 0) return null;
  if (value >= 1_000_000) return `$${Math.round(value / 1_000_000)}m`;
  if (value >= 1_000)     return `$${Math.round(value / 1_000)}k`;
  return `$${value}`;
}

export function RfpFitBreakdown({ rfp }: Props) {
  const { wvFitScore, decisionNotes, serviceMatch, geography, estimatedValue, opportunityType } = rfp;

  // Nothing explainable yet — skip the card entirely
  if (wvFitScore === "TBD" && !decisionNotes) return null;

  const budget = formatBudget(estimatedValue);

  // Build signal chips — only for non-empty values
  const signals: { icon: React.ReactNode; label: string; value: string }[] = [];

  if (serviceMatch.length > 0) {
    signals.push({
      icon: <Wrench className="h-3 w-3 shrink-0" />,
      label: "services",
      value: serviceMatch.join(", "),
    });
  }
  if (geography.length > 0) {
    signals.push({
      icon: <MapPin className="h-3 w-3 shrink-0" />,
      label: "geography",
      value: geography.join(", "),
    });
  }
  if (budget) {
    signals.push({
      icon: <DollarSign className="h-3 w-3 shrink-0" />,
      label: "budget",
      value: budget,
    });
  }
  if (opportunityType) {
    signals.push({
      icon: <Tag className="h-3 w-3 shrink-0" />,
      label: "type",
      value: opportunityType,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          fit breakdown
          <Badge
            variant="outline"
            className={`ml-auto text-xs font-medium ${FIT_BADGE[wvFitScore]}`}
          >
            {wvFitScore}
          </Badge>
        </CardTitle>
      </CardHeader>

      {(signals.length > 0 || decisionNotes) && (
        <CardContent className="space-y-3 pt-0">
          {signals.length > 0 && (
            <div className="grid grid-cols-1 gap-2">
              {signals.map((s) => (
                <div key={s.label} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground mt-0.5">{s.icon}</span>
                  <span className="text-muted-foreground text-xs w-16 shrink-0 pt-0.5">
                    {s.label}
                  </span>
                  <span className="text-xs leading-snug">{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {decisionNotes && (
            <p className="text-xs text-muted-foreground italic leading-relaxed border-t pt-3">
              {decisionNotes}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
