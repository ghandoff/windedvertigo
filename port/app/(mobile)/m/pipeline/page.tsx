import { Suspense } from "react";
import { queryDeals } from "@/lib/notion/deals";
import { queryRfpOpportunities } from "@/lib/notion/rfp-radar";
import { Badge } from "@/components/ui/badge";
import { Handshake, Radar, DollarSign } from "lucide-react";
import type { Deal, RfpOpportunity } from "@/lib/notion/types";

export const revalidate = 120;

const DEAL_STATUS_COLORS: Record<string, string> = {
  identified: "bg-blue-100 text-blue-700",
  pitched: "bg-yellow-100 text-yellow-700",
  proposal: "bg-orange-100 text-orange-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

function formatCurrency(value: number | null): string {
  if (!value) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function DealRow({ deal }: { deal: Deal }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <Handshake className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{deal.deal}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className={`text-[10px] ${DEAL_STATUS_COLORS[deal.stage] ?? ""}`}>
            {deal.stage}
          </Badge>
          {deal.value != null && deal.value > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <DollarSign className="h-2.5 w-2.5" />
              {formatCurrency(deal.value)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function RfpRow({ rfp }: { rfp: RfpOpportunity }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <Radar className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{rfp.opportunityName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-[10px]">{rfp.status}</Badge>
          {rfp.estimatedValue != null && rfp.estimatedValue > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <DollarSign className="h-2.5 w-2.5" />
              {formatCurrency(rfp.estimatedValue)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const ACTIVE_DEAL_STAGES = ["identified", "pitched", "proposal"];
const ACTIVE_RFP_STATUSES = ["radar", "reviewing", "pursuing", "interviewing", "submitted"];

async function PipelineFeed() {
  const [{ data: deals }, { data: rfps }] = await Promise.all([
    queryDeals(undefined, { pageSize: 20 }),
    queryRfpOpportunities(undefined, { pageSize: 20 }),
  ]);

  const activeDeals = deals.filter((d) => ACTIVE_DEAL_STAGES.includes(d.stage));
  const activeRfps = rfps.filter((r) => ACTIVE_RFP_STATUSES.includes(r.status));

  const totalPipelineValue =
    activeDeals.reduce((sum, d) => sum + (d.value ?? 0), 0) +
    activeRfps.reduce((sum, r) => sum + (r.estimatedValue ?? 0), 0);

  return (
    <>
      {/* Summary */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span>{activeDeals.length} deals</span>
        <span>{activeRfps.length} RFPs</span>
        {totalPipelineValue > 0 && (
          <span className="font-medium text-foreground">{formatCurrency(totalPipelineValue)} pipeline</span>
        )}
      </div>

      {activeDeals.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">deals</h2>
          {activeDeals.map((deal) => <DealRow key={deal.id} deal={deal} />)}
        </div>
      )}

      {activeRfps.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">RFP lighthouse</h2>
          {activeRfps.map((rfp) => <RfpRow key={rfp.id} rfp={rfp} />)}
        </div>
      )}

      {activeDeals.length === 0 && activeRfps.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">pipeline is empty</p>
        </div>
      )}
    </>
  );
}

export default function MobilePipelinePage() {
  return (
    <>
      <h1 className="text-lg font-semibold mb-4">pipeline</h1>
      <Suspense fallback={<div className="text-center py-8 text-muted-foreground text-sm">loading...</div>}>
        <PipelineFeed />
      </Suspense>
    </>
  );
}
