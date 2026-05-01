"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { DraggableKanban, type KanbanColumn } from "./draggable-kanban";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CalendarDays, DollarSign, Building2, FileText, AlertTriangle, Mail, Users, ListChecks, Radar } from "lucide-react";
import type { Deal, DealLostReason, RfpOpportunity } from "@/lib/notion/types";

const STAGE_COLUMNS: KanbanColumn[] = [
  { key: "identified", label: "identified", color: "bg-blue-500" },
  { key: "pitched", label: "pitched", color: "bg-yellow-500" },
  { key: "proposal", label: "proposal", color: "bg-orange-500" },
  { key: "won", label: "won", color: "bg-green-500" },
  { key: "lost", label: "lost", color: "bg-red-500" },
];

const LOST_REASONS: DealLostReason[] = [
  "budget",
  "timing",
  "no fit",
  "went with competitor",
  "no response",
  "other",
];

const STAGE_COLORS: Record<string, string> = {
  identified: "bg-blue-50 text-blue-700 border-blue-200",
  pitched: "bg-yellow-50 text-yellow-700 border-yellow-200",
  proposal: "bg-orange-50 text-orange-700 border-orange-200",
  won: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-red-50 text-red-700 border-red-200",
};

function formatCurrency(value: number | null): string {
  if (!value) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type DealKanbanItem = Deal & { kanbanStatus: string; isDuplicate?: boolean };

function notionUrl(id: string) {
  return `https://notion.so/${id.replace(/-/g, "")}`;
}

function DealCard({
  deal,
  orgNames,
  rfp,
}: {
  deal: DealKanbanItem;
  orgNames: Record<string, string>;
  rfp?: RfpOpportunity;
}) {
  const router = useRouter();
  const href = `/deals/${deal.id}`;
  const docUrls = deal.documents
    ? deal.documents.split("\n").map((u) => u.trim()).filter(Boolean)
    : [];

  const orgName = deal.organizationIds.length > 0
    ? (orgNames[deal.organizationIds[0]] || null)
    : null;

  return (
    <Card
      className={`hover:shadow-md transition-shadow cursor-pointer ${deal.isDuplicate ? "border-amber-400/60" : ""}`}
      onMouseEnter={() => router.prefetch(href)}
      onClick={() => router.push(href)}
    >
      <CardContent className="p-3 space-y-2">
        {/* Title row */}
        <div className="flex items-start gap-2">
          <p className="text-sm font-medium leading-tight flex-1">{deal.deal}</p>
        </div>

        {/* Duplicate warning */}
        {deal.isDuplicate && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            possible duplicate
          </div>
        )}

        {/* Stage + owner badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={`text-[10px] ${STAGE_COLORS[deal.stage] ?? ""}`}
          >
            {deal.stage}
          </Badge>
          {deal.owner && (
            <Badge variant="outline" className="text-[10px]">{deal.owner}</Badge>
          )}
        </div>

        {/* Value */}
        {deal.value != null && deal.value > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span>{formatCurrency(deal.value)}</span>
          </div>
        )}

        {/* Close date */}
        {deal.closeDate?.start && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            <span>{formatDate(deal.closeDate.start)}</span>
          </div>
        )}

        {/* Org name */}
        {orgName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{orgName}{deal.organizationIds.length > 1 ? ` +${deal.organizationIds.length - 1}` : ""}</span>
          </div>
        )}

        {/* Notes preview */}
        {deal.notes && (
          <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
            {deal.notes}
          </p>
        )}

        {/* Lost reason */}
        {deal.lostReason && (
          <p className="text-[10px] text-muted-foreground">lost: {deal.lostReason}</p>
        )}

        {/* Documents section — pull from linked RFP when available, fall back to deal-level docs */}
        {rfp ? (
          <div className="space-y-0.5 pt-0.5 border-t border-border/40">
            {/* RFP source badge */}
            <a
              href={rfp.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] text-blue-600 hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              <Radar className="h-3 w-3 shrink-0" />
              <span className="truncate">{rfp.opportunityName}</span>
            </a>

            {/* Proposal draft */}
            {rfp.proposalDraftUrl ? (
              <a
                href={rfp.proposalDraftUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-green-700 hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                <FileText className="h-3 w-3 shrink-0 text-green-600" />
                proposal draft →
              </a>
            ) : rfp.proposalStatus === "generating" ? (
              <span className="flex items-center gap-1.5 text-[10px] text-yellow-600">
                <FileText className="h-3 w-3 shrink-0 text-yellow-500" />
                generating draft…
              </span>
            ) : (
              <a
                href={notionUrl(deal.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-green-700 hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                <FileText className="h-3 w-3 shrink-0 text-green-600" />
                proposal draft →
              </a>
            )}

            {/* Cover letter */}
            {rfp.coverLetterUrl && (
              <a
                href={rfp.coverLetterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-indigo-700 hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail className="h-3 w-3 shrink-0 text-indigo-500" />
                cover letter →
              </a>
            )}

            {/* Team CVs */}
            {rfp.teamCvsUrl && (
              <a
                href={rfp.teamCvsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] text-teal-700 hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                <Users className="h-3 w-3 shrink-0 text-teal-500" />
                team cvs →
              </a>
            )}

            {/* Question bank */}
            {rfp.questionCount != null && rfp.questionCount > 0 && (
              rfp.questionBankUrl ? (
                <a
                  href={rfp.questionBankUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[10px] text-purple-700 hover:underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ListChecks className="h-3 w-3 shrink-0 text-purple-500" />
                  {rfp.questionCount} questions →
                </a>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] text-purple-600">
                  <ListChecks className="h-3 w-3 shrink-0 text-purple-500" />
                  {rfp.questionCount} questions parsed
                </span>
              )
            )}
          </div>
        ) : (
          <>
            {/* Fallback for deals without an RFP link */}
            <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/40">
              <FileText className="h-3 w-3 shrink-0 text-green-600" />
              <a
                href={notionUrl(deal.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-green-700 hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                proposal draft →
              </a>
            </div>

            {docUrls.length > 0 && (
              <div className="flex flex-col gap-1 pt-0.5 border-t border-border/40">
                {docUrls.slice(0, 3).map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{url.split("/").pop()?.slice(0, 40) ?? "document"}</span>
                  </a>
                ))}
                {docUrls.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{docUrls.length - 3} more</span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface DebriefData {
  whatWorked: string;
  whatFellFlat: string;
  whatWasMissing: string;
  clientFeedback: string;
}

interface WinLossDebriefModalProps {
  open: boolean;
  outcome: "won" | "lost";
  onConfirm: (debrief: DebriefData, lostReason?: DealLostReason) => void;
  onCancel: () => void;
}

function WinLossDebriefModal({ open, outcome, onConfirm, onCancel }: WinLossDebriefModalProps) {
  const [lostReason, setLostReason] = useState<DealLostReason>("other");
  const [whatWorked, setWhatWorked] = useState("");
  const [whatFellFlat, setWhatFellFlat] = useState("");
  const [whatWasMissing, setWhatWasMissing] = useState("");
  const [clientFeedback, setClientFeedback] = useState("");

  function reset() {
    setLostReason("other");
    setWhatWorked("");
    setWhatFellFlat("");
    setWhatWasMissing("");
    setClientFeedback("");
  }

  function handleConfirm() {
    const debrief: DebriefData = { whatWorked, whatFellFlat, whatWasMissing, clientFeedback };
    onConfirm(debrief, outcome === "lost" ? lostReason : undefined);
    reset();
  }

  function handleSkip() {
    const debrief: DebriefData = { whatWorked: "", whatFellFlat: "", whatWasMissing: "", clientFeedback: "" };
    onConfirm(debrief, outcome === "lost" ? "other" : undefined);
    reset();
  }

  function handleCancel() {
    reset();
    onCancel();
  }

  const title = outcome === "won" ? "what made us win?" : "why did we lose?";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Lost reason select — only for lost deals */}
          {outcome === "lost" && (
            <div className="space-y-1.5">
              <Label>reason</Label>
              <Select value={lostReason} onValueChange={(v) => setLostReason(v as DealLostReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOST_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{outcome === "won" ? "what worked?" : "what went well despite the loss?"} <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={whatWorked}
              onChange={(e) => setWhatWorked(e.target.value)}
              placeholder={outcome === "won" ? "what clicked for the client, what sealed it..." : "any bright spots worth noting..."}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{outcome === "won" ? "what did the client respond to most?" : "what fell flat?"} <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={whatFellFlat}
              onChange={(e) => setWhatFellFlat(e.target.value)}
              placeholder={outcome === "won" ? "which part of the pitch landed best..." : "what didn't resonate, what they pushed back on..."}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{outcome === "won" ? "what nearly cost us the deal?" : "what was missing from our offer?"} <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={whatWasMissing}
              onChange={(e) => setWhatWasMissing(e.target.value)}
              placeholder={outcome === "won" ? "friction points, concerns we had to overcome..." : "capability gaps, price issues, scope mismatch..."}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>client feedback <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={clientFeedback}
              onChange={(e) => setClientFeedback(e.target.value)}
              placeholder="anything the client said directly..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleCancel}>cancel</Button>
          <Button variant="outline" onClick={handleSkip}>skip</Button>
          <Button onClick={handleConfirm}>
            {outcome === "won" ? "save debrief & mark won" : "save debrief & mark lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DealKanbanProps {
  deals: Deal[];
  orgNames?: Record<string, string>;
  rfpMap?: Record<string, RfpOpportunity>;
}

export function DealKanban({ deals, orgNames = {}, rfpMap = {} }: DealKanbanProps) {
  const router = useRouter();
  const [pendingOutcome, setPendingOutcome] = useState<{ id: string; status: "won" | "lost" } | null>(null);

  // Detect duplicates: flag deals whose normalized title matches another deal
  const titleCounts = new Map<string, number>();
  for (const d of deals) {
    const key = d.deal.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }

  const items: DealKanbanItem[] = deals.map((d) => {
    const key = d.deal.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    return { ...d, kanbanStatus: d.stage, isDuplicate: (titleCounts.get(key) ?? 0) > 1 };
  });

  const handleStatusChange = useCallback(
    async (itemId: string, newStatus: string) => {
      if (newStatus === "won" || newStatus === "lost") {
        setPendingOutcome({ id: itemId, status: newStatus });
        return;
      }
      await fetch(`/api/deals/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStatus }),
      });
      router.refresh();
    },
    [router],
  );

  const handleOutcomeConfirm = useCallback(
    async (debrief: DebriefData, lostReason?: DealLostReason) => {
      if (!pendingOutcome) return;
      const body: Record<string, unknown> = { stage: pendingOutcome.status };
      if (lostReason) body.lostReason = lostReason;
      if (debrief.whatWorked) body.debriefWhatWorked = debrief.whatWorked;
      if (debrief.whatFellFlat) body.debriefWhatFellFlat = debrief.whatFellFlat;
      if (debrief.whatWasMissing) body.debriefWhatWasMissing = debrief.whatWasMissing;
      if (debrief.clientFeedback) body.debriefClientFeedback = debrief.clientFeedback;
      await fetch(`/api/deals/${pendingOutcome.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setPendingOutcome(null);
      router.refresh();
    },
    [pendingOutcome, router],
  );

  const renderCard = useCallback(
    (item: DealKanbanItem) => {
      const linkedRfp = item.rfpOpportunityIds.length > 0
        ? rfpMap[item.rfpOpportunityIds[0]]
        : undefined;
      return (
        <DealCard deal={item} orgNames={orgNames} rfp={linkedRfp} />
      );
    },
    [router, orgNames, rfpMap],
  );

  return (
    <>
      <DraggableKanban
        columns={STAGE_COLUMNS}
        items={items}
        renderCard={renderCard}
        onStatusChange={handleStatusChange}
      />
      <WinLossDebriefModal
        open={pendingOutcome !== null}
        outcome={pendingOutcome?.status ?? "lost"}
        onConfirm={handleOutcomeConfirm}
        onCancel={() => setPendingOutcome(null)}
      />
    </>
  );
}
