"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DraggableKanban, type KanbanColumn } from "./draggable-kanban";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertCircle, CalendarDays, DollarSign, ExternalLink, ChevronDown, FileText, Loader2, Upload, CheckCircle2, ListChecks, Mail, Users } from "lucide-react";
import { computeWinProbability, WinProbabilityBadge } from "./ai-win-probability";
import { GoNoGoModal } from "./go-no-go-modal";
import type { RfpOpportunity, RfpStatus, WvFitScore } from "@/lib/notion/types";

// Active pipeline columns — shown as draggable board lanes
const STATUS_COLUMNS: KanbanColumn[] = [
  { key: "radar", label: "radar", color: "bg-blue-500" },
  { key: "reviewing", label: "reviewing", color: "bg-yellow-500" },
  { key: "pursuing", label: "pursuing", color: "bg-orange-500" },
  { key: "interviewing", label: "interviewing", color: "bg-cyan-500" },
  { key: "submitted", label: "submitted", color: "bg-purple-500" },
];

// Outcome statuses available via the card dropdown (not shown as board columns)
const ACTIVE_STATUSES: RfpStatus[] = ["radar", "reviewing", "pursuing", "interviewing", "submitted"];
const OUTCOME_STATUSES: { value: RfpStatus; label: string }[] = [
  { value: "won", label: "won" },
  { value: "lost", label: "lost" },
  { value: "no-go", label: "no-go" },
  { value: "missed deadline", label: "missed deadline" },
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

function RfpCard({
  rfp,
  onOutcome,
  onDocumentUploaded,
}: {
  rfp: RfpKanbanItem;
  onOutcome: (id: string, status: RfpStatus) => void;
  onDocumentUploaded: () => void;
}) {
  const router = useRouter();
  const href = `/rfp-radar/${rfp.id}`;
  const deadlineDays = daysUntil(rfp.dueDate?.start);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Core submit — shared between click-to-pick and drag-drop paths so both
  // hit the same endpoint with identical validation/error handling.
  const handleFileSubmit = useCallback(
    async (file: File) => {
      setUploadState("uploading");
      setUploadError(null);
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch(`/api/rfp-radar/${rfp.id}/document`, {
          method: "POST",
          body: form,
        });
        // Parse response whether 2xx or not — errors come back as JSON too.
        const data: { error?: string; ok?: boolean } = await res
          .json()
          .catch(() => ({ error: "server returned invalid response" }));
        if (res.ok) {
          setUploadState("done");
          setTimeout(() => {
            setUploadState("idle");
            onDocumentUploaded();
          }, 1500);
        } else {
          setUploadState("idle");
          setUploadError(data.error ?? `upload failed (${res.status})`);
        }
      } catch (err) {
        setUploadState("idle");
        setUploadError(err instanceof Error ? err.message : "upload failed — network error");
      }
    },
    [rfp.id, onDocumentUploaded],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await handleFileSubmit(file);
      // Reset input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleFileSubmit],
  );
  const deadlineUrgent = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 7;
  const overdue = deadlineDays !== null && deadlineDays < 0;

  return (
    <Card
      className={`hover:shadow-md transition-shadow cursor-pointer ${deadlineUrgent ? "border-destructive/50" : ""}`}
      onMouseEnter={() => router.prefetch(href)}
      onClick={() => router.push(href)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{rfp.opportunityName}</p>
          <div className="flex items-center gap-1 shrink-0">
            {rfp.url && (
              <a href={rfp.url} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </a>
            )}
            {/* Outcome selector — close this card without needing to drag to a hidden column */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded hover:bg-muted"
                title="set outcome"
                onClick={(e) => e.stopPropagation()}
              >
                close <ChevronDown className="h-2.5 w-2.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36" onClick={(e) => e.stopPropagation()}>
                <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  move to active
                </div>
                {ACTIVE_STATUSES.filter((s) => s !== rfp.status).map((s) => (
                  <DropdownMenuItem
                    key={s}
                    className="text-xs"
                    onClick={() => onOutcome(rfp.id, s)}
                  >
                    {s}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  close as
                </div>
                {OUTCOME_STATUSES.map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    className="text-xs"
                    onClick={() => onOutcome(rfp.id, value)}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
        {rfp.requirementsSnapshot && (
          // Two-line preview of the TOR/triage-extracted summary so the card
          // carries enough context to triage without opening the detail page.
          // line-clamp-2 handles any snapshot length; italic + muted keeps it
          // visually subordinate to the name/badges above.
          <p className="text-[10px] italic text-muted-foreground/80 leading-snug line-clamp-2">
            {rfp.requirementsSnapshot}
          </p>
        )}
        {rfp.proposalStatus && (
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/40">
            {rfp.proposalStatus === "generating" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
                <span className="text-[10px] text-yellow-600">generating draft…</span>
              </>
            ) : rfp.proposalStatus === "ready-for-review" && rfp.proposalDraftUrl ? (
              <>
                <FileText className="h-3 w-3 text-purple-600" />
                <a
                  href={rfp.proposalDraftUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-purple-700 hover:underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  review draft →
                </a>
              </>
            ) : rfp.proposalStatus === "complete" && rfp.proposalDraftUrl ? (
              <>
                <FileText className="h-3 w-3 text-green-600" />
                <a
                  href={rfp.proposalDraftUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-green-700 hover:underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  proposal draft →
                </a>
              </>
            ) : rfp.proposalStatus === "failed" ? (
              <>
                <span className="text-[10px] text-destructive">draft failed — retry?</span>
              </>
            ) : null}
          </div>
        )}

        {/* RFP document upload — drag-drop target.
            stopPropagation on outer handlers so drop-zone events never reach
            the Card's onClick (which navigates to the detail page). */}
        <div
          className={`relative flex items-center gap-1.5 pt-0.5 border-t border-border/40 rounded-sm transition-colors ${
            isDragging ? "bg-accent/10 ring-2 ring-accent ring-offset-1" : ""
          }`}
          onClick={(e) => e.stopPropagation()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDragging) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFileSubmit(file);
          }}
        >
          {rfp.rfpDocumentUrl ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-blue-500 shrink-0" />
              <span className="text-[10px] text-blue-600 flex-1">
                {isDragging ? "drop to replace" : "rfp doc attached"}
              </span>
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground"
                title="replace document"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                replace
              </button>
            </>
          ) : (
            <button
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              disabled={uploadState === "uploading"}
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              {uploadState === "uploading" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : uploadState === "done" ? (
                <CheckCircle2 className="h-3 w-3 text-green-600" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              {isDragging
                ? "drop to attach"
                : uploadState === "uploading"
                ? "uploading…"
                : uploadState === "done"
                ? "uploaded"
                : "attach rfp doc (or drag)"}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {uploadError && (
          <div className="flex items-start gap-1.5 text-[10px] text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Cover letter */}
        {rfp.coverLetterUrl && (
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/40">
            <Mail className="h-3 w-3 text-indigo-500 shrink-0" />
            <a
              href={rfp.coverLetterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-indigo-700 hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              cover letter →
            </a>
          </div>
        )}

        {/* Team CVs */}
        {rfp.teamCvsUrl && (
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/40">
            <Users className="h-3 w-3 text-teal-500 shrink-0" />
            <a
              href={rfp.teamCvsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-teal-700 hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              team cvs →
            </a>
          </div>
        )}

        {/* Question bank status */}
        {rfp.questionCount != null && rfp.questionCount > 0 && (
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/40">
            <ListChecks className="h-3 w-3 text-purple-500 shrink-0" />
            {rfp.questionBankUrl ? (
              <a
                href={rfp.questionBankUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-purple-700 hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                {rfp.questionCount} questions parsed →
              </a>
            ) : (
              <span className="text-[10px] text-purple-600">{rfp.questionCount} questions parsed</span>
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
  const [pendingGoNoGo, setPendingGoNoGo] = useState<{ id: string; rfpName: string; targetStatus: RfpStatus } | null>(null);

  // Poll every 10s while any card is generating so links appear without a manual refresh
  const hasGenerating = opportunities.some((r) => r.proposalStatus === "generating");
  useEffect(() => {
    if (!hasGenerating) return;
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [hasGenerating, router]);

  // Only active-pipeline items appear on the board; outcomes go to the completed table
  const items: RfpKanbanItem[] = opportunities
    .filter((r) => ACTIVE_STATUSES.includes(r.status as RfpStatus))
    .map((r) => ({ ...r, kanbanStatus: r.status }));

  const handleStatusChange = useCallback(
    async (itemId: string, newStatus: string) => {
      const rfpStatus = newStatus as RfpStatus;

      // Intercept moves to "reviewing", or moves to "pursuing" when fit score is still TBD
      if (rfpStatus === "reviewing") {
        const rfp = opportunities.find((r) => r.id === itemId);
        setPendingGoNoGo({
          id: itemId,
          rfpName: rfp?.opportunityName ?? itemId,
          targetStatus: rfpStatus,
        });
        return;
      }

      if (rfpStatus === "pursuing") {
        const rfp = opportunities.find((r) => r.id === itemId);
        if (rfp && rfp.wvFitScore === "TBD") {
          setPendingGoNoGo({
            id: itemId,
            rfpName: rfp.opportunityName,
            targetStatus: rfpStatus,
          });
          return;
        }
      }

      await fetch(`/api/rfp-radar/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    },
    [router, opportunities],
  );

  const handleGoNoGoConfirm = useCallback(
    async (fitScore: WvFitScore) => {
      if (!pendingGoNoGo) return;
      await fetch(`/api/rfp-radar/${pendingGoNoGo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: pendingGoNoGo.targetStatus, wvFitScore: fitScore }),
      });
      setPendingGoNoGo(null);
      router.refresh();
    },
    [pendingGoNoGo, router],
  );

  const handleDocumentUploaded = useCallback(() => {
    router.refresh();
  }, [router]);

  const renderCard = useCallback(
    (item: RfpKanbanItem) => (
      <RfpCard
        rfp={item}
        onOutcome={(id, status) => handleStatusChange(id, status)}
        onDocumentUploaded={handleDocumentUploaded}
      />
    ),
    [handleStatusChange, handleDocumentUploaded],
  );

  return (
    <>
      <DraggableKanban
        columns={STATUS_COLUMNS}
        items={items}
        renderCard={renderCard}
        onStatusChange={handleStatusChange}
      />
      <GoNoGoModal
        open={pendingGoNoGo !== null}
        rfpName={pendingGoNoGo?.rfpName ?? ""}
        onConfirm={handleGoNoGoConfirm}
        onCancel={() => setPendingGoNoGo(null)}
      />
    </>
  );
}
