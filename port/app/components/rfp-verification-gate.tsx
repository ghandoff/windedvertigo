"use client";

/**
 * RfpVerificationGate — the human-in-the-loop verification UI on the RFP
 * detail page.
 *
 * Two halves:
 *   1. TOR verification — confirm the auto-discovered/uploaded TOR is the
 *      correct document for this RFP.
 *   2. Requirements review — approve/edit/remove the AI-extracted
 *      requirement rows (deliverables, eligibility, evaluation criteria, etc.)
 *
 * Both must pass before the proposal-generation trigger is enabled.
 *
 * The gate fetches /api/rfp-radar/[id]/requirements on mount + after each
 * mutation, so the readiness banner is always live.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Trash2, FileCheck, AlertTriangle, ClipboardList } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Requirement {
  id: string;
  rfpId: string;
  kind: "deliverable" | "eligibility" | "evaluation_criterion" | "admin" | "submission";
  label: string;
  description: string | null;
  pageLimit: number | null;
  wordLimit: number | null;
  format: "pdf" | "docx" | "either" | null;
  requiredSections: string[];
  weightPct: number | null;
  required: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  extractedBy: string | null;
  extractionConfidence: number | null;
  sourceQuote: string | null;
}

interface Readiness {
  ready: boolean;
  reason: string | null;
  unapprovedCount: number;
}

interface RfpVerificationGateProps {
  rfpId: string;
  /** Set when the TOR has already been verified — disables the verify-now button. */
  initialTorVerifiedBy: string | null;
  initialTorVerifiedAt: string | null;
}

const KIND_LABEL: Record<Requirement["kind"], string> = {
  deliverable: "deliverables",
  eligibility: "eligibility",
  evaluation_criterion: "evaluation criteria",
  admin: "admin",
  submission: "submission",
};

const KIND_COLOR: Record<Requirement["kind"], string> = {
  deliverable: "bg-emerald-100 text-emerald-800 border-emerald-300",
  eligibility: "bg-blue-100 text-blue-800 border-blue-300",
  evaluation_criterion: "bg-amber-100 text-amber-800 border-amber-300",
  admin: "bg-slate-100 text-slate-800 border-slate-300",
  submission: "bg-purple-100 text-purple-800 border-purple-300",
};

export function RfpVerificationGate({
  rfpId,
  initialTorVerifiedBy,
  initialTorVerifiedAt,
}: RfpVerificationGateProps) {
  const router = useRouter();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [readiness, setReadiness] = useState<Readiness>({ ready: false, reason: null, unapprovedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [torVerifiedBy, setTorVerifiedBy] = useState<string | null>(initialTorVerifiedBy);
  const [torVerifiedAt, setTorVerifiedAt] = useState<string | null>(initialTorVerifiedAt);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/requirements`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { requirements: Requirement[]; readiness: Readiness };
      setRequirements(data.requirements);
      setReadiness(data.readiness);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "failed to load requirements");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfpId]);

  // ── TOR verify / clear ─────────────────────────────────────────────────────
  async function handleVerifyTor() {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/verify-tor`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTorVerifiedBy(data.verifiedBy);
      setTorVerifiedAt(data.verifiedAt);
      startTransition(() => {
        refresh();
        router.refresh();
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "TOR verification failed");
    }
  }

  async function handleClearTor() {
    setErrorMsg(null);
    if (!confirm("Clear TOR verification? You'll need to re-verify before generation.")) return;
    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/verify-tor`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTorVerifiedBy(null);
      setTorVerifiedAt(null);
      startTransition(() => {
        refresh();
        router.refresh();
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "TOR clear failed");
    }
  }

  // ── Requirement mutations ──────────────────────────────────────────────────
  async function handleApprove(reqId: string) {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/requirements/${reqId}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "approve failed");
    }
  }

  async function handleDelete(reqId: string) {
    setErrorMsg(null);
    if (!confirm("Remove this requirement row? (You can re-extract by re-uploading the TOR.)")) return;
    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/requirements/${reqId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "delete failed");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const grouped: Record<string, Requirement[]> = {};
  for (const r of requirements) {
    if (!grouped[r.kind]) grouped[r.kind] = [];
    grouped[r.kind].push(r);
  }
  const kindOrder: Requirement["kind"][] = [
    "deliverable", "evaluation_criterion", "eligibility", "submission", "admin",
  ];
  const totalApproved = requirements.filter((r) => r.approvedAt).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          requirements review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* TOR verification ─────────────────────────────────── */}
        <div className="rounded-md border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileCheck className={`h-4 w-4 ${torVerifiedAt ? "text-emerald-600" : "text-muted-foreground"}`} />
              <span className="text-sm font-medium">TOR document</span>
            </div>
            {torVerifiedAt ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                verified
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                unverified
              </Badge>
            )}
          </div>
          {torVerifiedAt ? (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>verified by {torVerifiedBy} · {new Date(torVerifiedAt).toLocaleString()}</span>
              <button
                onClick={handleClearTor}
                className="underline hover:text-foreground"
                disabled={isPending}
              >
                replace TOR
              </button>
            </div>
          ) : (
            <Button onClick={handleVerifyTor} size="sm" disabled={isPending}>
              ✓ This is the correct TOR
            </Button>
          )}
        </div>

        {/* Requirements ─────────────────────────────────────── */}
        {loading ? (
          <p className="text-xs text-muted-foreground">loading requirements…</p>
        ) : requirements.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            no requirements extracted yet. upload a TOR to trigger extraction.
          </p>
        ) : (
          <div className="space-y-3">
            {kindOrder.map((kind) => {
              const rows = grouped[kind];
              if (!rows || rows.length === 0) return null;
              return (
                <div key={kind} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {KIND_LABEL[kind]} ({rows.length})
                  </p>
                  {rows.map((r) => (
                    <RequirementRow
                      key={r.id}
                      requirement={r}
                      onApprove={handleApprove}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Readiness summary ────────────────────────────────── */}
        {!loading && requirements.length > 0 && (
          <div
            className={`rounded-md border p-3 text-xs ${
              readiness.ready
                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                : "bg-amber-50 border-amber-300 text-amber-800"
            }`}
          >
            {readiness.ready ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span><strong>ready for generation</strong> — {totalApproved}/{requirements.length} requirements approved</span>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>not ready:</strong> {readiness.reason}.{" "}
                  approve all required deliverables before triggering generation.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error toast ──────────────────────────────────────── */}
        {errorMsg && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
            ⚠ {errorMsg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RequirementRow({
  requirement,
  onApprove,
  onDelete,
}: {
  requirement: Requirement;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const r = requirement;
  const approved = !!r.approvedAt;
  const specBits: string[] = [];
  if (r.pageLimit) specBits.push(`≤${r.pageLimit}p`);
  if (r.wordLimit) specBits.push(`≤${r.wordLimit}w`);
  if (r.format && r.format !== "either") specBits.push(r.format);
  if (r.weightPct != null) specBits.push(`${r.weightPct}%`);

  return (
    <div
      className={`group rounded-md border p-2.5 text-xs space-y-1 transition-colors ${
        approved ? "bg-emerald-50/50 border-emerald-200" : "bg-card border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {approved ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <Circle className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium break-words">{r.label}</span>
              {specBits.length > 0 && (
                <Badge variant="outline" className={`text-[10px] ${KIND_COLOR[r.kind]}`}>
                  {specBits.join(" · ")}
                </Badge>
              )}
            </div>
            {r.description && (
              <p className="text-muted-foreground mt-0.5 break-words">{r.description}</p>
            )}
            {r.requiredSections.length > 0 && (
              <p className="text-muted-foreground mt-0.5">
                <span className="font-medium">sections:</span> {r.requiredSections.join(" · ")}
              </p>
            )}
            {r.sourceQuote && (
              <details className="mt-1">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground select-none">
                  source quote ↓
                </summary>
                <blockquote className="mt-1 pl-2 border-l-2 border-muted text-muted-foreground italic">
                  &ldquo;{r.sourceQuote}&rdquo;
                </blockquote>
              </details>
            )}
            {approved && (
              <p className="text-[10px] text-emerald-700 mt-0.5">
                approved by {r.approvedBy} · {new Date(r.approvedAt!).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!approved && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onApprove(r.id)}
              className="h-7 px-2 text-[11px]"
            >
              approve
            </Button>
          )}
          <button
            onClick={() => onDelete(r.id)}
            className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
            title="remove this requirement"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
