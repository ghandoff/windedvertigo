"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2, FileText, Mail, Users, ListChecks, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { id: "fetching_rfp",       label: "reading RFP & validating",                        weight: 5  },
  { id: "gathering_context",  label: "gathering context",   sub: "org, BD assets, bibliography, rate refs", weight: 20 },
  { id: "reading_document",   label: "reading TOR document",                             weight: 10 },
  { id: "matching_citations", label: "matching citations",                               weight: 10 },
  { id: "writing_draft",      label: "writing proposal draft", sub: "2–4 minutes — the long one", weight: 30 },
  { id: "building_documents", label: "building sections",   sub: "exec summary, approach, team, budget, risk", weight: 15 },
  { id: "cover_letter",       label: "writing cover letter",                             weight: 5  },
  { id: "team_cvs",           label: "compiling team CVs",                               weight: 5  },
] as const;

const TOTAL_WEIGHT = STEPS.reduce((s, step) => s + step.weight, 0);

type StepId = (typeof STEPS)[number]["id"];

interface ProgressData {
  status: string | null;
  step: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

function calcProgress(step: string | null): number {
  if (!step) return 3;
  const idx = STEPS.findIndex((s) => s.id === step);
  if (idx === -1) return 3;
  const completedWeight = STEPS.slice(0, idx).reduce((acc, s) => acc + s.weight, 0);
  // Return completed weight as % — shows progress up to the start of this step
  return Math.round((completedWeight / TOTAL_WEIGHT) * 100);
}

function stepStatus(stepId: StepId, currentStep: string | null): "done" | "active" | "pending" {
  if (!currentStep) return "pending";
  const currentIdx = STEPS.findIndex((s) => s.id === currentStep);
  const thisIdx = STEPS.findIndex((s) => s.id === stepId);
  if (thisIdx < currentIdx) return "done";
  if (thisIdx === currentIdx) return "active";
  return "pending";
}

// ── Document state inference from step ──────────────────────────────────────

type DocStatus = "pending" | "building" | "done" | "skipped";

function inferDocStatus(
  docKey: "proposal" | "cover_letter" | "team_cvs",
  step: string | null,
  proposalStatus: string | null,
): DocStatus {
  const complete = proposalStatus === "ready-for-review" || proposalStatus === "complete";
  if (complete) return "done";

  const stepOrder: Record<string, number> = {
    fetching_rfp: 0, gathering_context: 1, reading_document: 2,
    matching_citations: 3, writing_draft: 4, building_documents: 5,
    cover_letter: 6, team_cvs: 7,
  };
  const cur = step ? (stepOrder[step] ?? -1) : -1;

  if (docKey === "proposal") {
    if (cur >= 5) return "building"; // building_documents or later
    return "pending";
  }
  if (docKey === "cover_letter") {
    if (cur >= 6) return "building";
    if (cur >= 5) return "pending";
    return "pending";
  }
  if (docKey === "team_cvs") {
    if (cur >= 7) return "building";
    return "pending";
  }
  return "pending";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function useElapsed(startedAt: string | null): string {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!startedAt) { setElapsed(""); return; }
    const tick = () => {
      const ms = Date.now() - new Date(startedAt).getTime();
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      setElapsed(m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  rfpId: string;
  /** proposalStatus read from Notion by the Server Component. */
  initialStatus: string | null;
  /** questionBankUrl from Notion — pre-built before main generation. */
  questionBankUrl: string | null | undefined;
  questionCount: number | null | undefined;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProposalProgressTracker({
  rfpId,
  initialStatus,
  questionBankUrl,
  questionCount,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [progress, setProgress] = useState<ProgressData>({
    status: initialStatus,
    step: null,
    startedAt: null,
    completedAt: null,
  });
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const prevStatusRef = useRef(initialStatus);

  const isActive = progress.status === "generating" || progress.status === "queued";
  const pct = isActive ? calcProgress(progress.step) : (progress.status === "ready-for-review" || progress.status === "complete" ? 100 : 0);
  const elapsed = useElapsed(progress.startedAt);

  // Poll every 4s while generating
  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/rfp-radar/${rfpId}/proposal-status`);
        if (!res.ok || cancelled) return;
        const data: ProgressData = await res.json();
        if (cancelled) return;

        setProgress(data);

        // When generation transitions to a terminal state, refresh the Server
        // Component so Notion doc links (proposalDraftUrl etc.) appear.
        const wasActive = prevStatusRef.current === "generating" || prevStatusRef.current === "queued";
        const nowTerminal = data.status !== "generating" && data.status !== "queued";
        if (wasActive && nowTerminal) {
          startTransition(() => router.refresh());
        }
        prevStatusRef.current = data.status;
      } catch { /* network blip — next poll will retry */ }
    };

    poll(); // immediate first fetch
    const id = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isActive, rfpId, router]);

  // If this renders with a terminal status from the start (Server Component
  // already had the final state), don't show the tracker at all — the parent
  // will show the completed doc links instead.
  if (!isActive && progress.status !== "generating" && progress.status !== "queued") {
    return null;
  }

  const proposalDocStatus = inferDocStatus("proposal", progress.step, progress.status);
  const coverLetterDocStatus = inferDocStatus("cover_letter", progress.step, progress.status);
  const teamCvsDocStatus = inferDocStatus("team_cvs", progress.step, progress.status);

  async function handleReset() {
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/reset-proposal-status`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setResetError(body.error ?? "reset failed");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header + progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-600" />
            <span className="text-xs font-medium text-foreground">generating proposal</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{pct}%</span>
            {elapsed && <><span className="text-muted-foreground/40">·</span><span>{elapsed}</span></>}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-yellow-400 transition-all duration-700 ease-out"
            style={{ width: `${Math.max(pct, 3)}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-1.5">
        {STEPS.map((s) => {
          const state = stepStatus(s.id as StepId, progress.step);
          return (
            <div key={s.id} className="flex items-start gap-2">
              {state === "done" ? (
                <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-500" />
              ) : state === "active" ? (
                <Loader2 className="h-3.5 w-3.5 mt-0.5 shrink-0 animate-spin text-yellow-600" />
              ) : (
                <Circle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/30" />
              )}
              <div className="min-w-0">
                <span className={`text-xs leading-none ${state === "pending" ? "text-muted-foreground/50" : state === "active" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
                {"sub" in s && s.sub && state === "active" && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{s.sub}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Document checklist */}
      <div className="pt-1 border-t border-border/50 space-y-1.5">
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium">documents</p>

        <DocRow
          icon={<FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
          label="proposal body"
          sub="exec summary · approach · experience · budget · risk"
          docStatus={proposalDocStatus}
        />
        <DocRow
          icon={<Mail className="h-3.5 w-3.5 shrink-0 text-indigo-400" />}
          label="cover letter"
          sub="if required by TOR"
          docStatus={coverLetterDocStatus}
          conditional
        />
        <DocRow
          icon={<Users className="h-3.5 w-3.5 shrink-0 text-teal-500" />}
          label="team CVs"
          sub="if required by TOR"
          docStatus={teamCvsDocStatus}
          conditional
        />
        {questionBankUrl && questionCount != null && questionCount > 0 && (
          <div className="flex items-start gap-2">
            <ListChecks className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-500" />
            <div className="min-w-0">
              <span className="text-xs text-muted-foreground">{questionCount} questions pre-parsed</span>
              <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 h-3.5 bg-green-50 text-green-700 border-green-200">ready</Badge>
            </div>
          </div>
        )}
      </div>

      {/* Reset escape hatch */}
      <div className="pt-0.5">
        {resetError && (
          <p className="text-xs text-destructive flex items-center gap-1 mb-1">
            <AlertCircle className="h-3 w-3" />{resetError}
          </p>
        )}
        <button
          onClick={handleReset}
          disabled={resetting}
          className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-2 transition-colors disabled:opacity-40"
        >
          {resetting ? "resetting…" : "stuck? reset"}
        </button>
      </div>
    </div>
  );
}

// ── DocRow helper ─────────────────────────────────────────────────────────────

function DocRow({
  icon,
  label,
  sub,
  docStatus,
  conditional,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  docStatus: DocStatus;
  conditional?: boolean;
}) {
  const isPending = docStatus === "pending";
  return (
    <div className="flex items-start gap-2">
      <span className={isPending ? "opacity-30" : ""}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs ${isPending ? "text-muted-foreground/40" : docStatus === "building" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            {label}
          </span>
          {docStatus === "building" && (
            <span className="text-[10px] text-yellow-600 flex items-center gap-0.5">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />building
            </span>
          )}
          {docStatus === "done" && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-green-50 text-green-700 border-green-200">done</Badge>
          )}
          {isPending && conditional && (
            <span className="text-[10px] text-muted-foreground/40">if required by TOR</span>
          )}
        </div>
        {sub && docStatus === "building" && (
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}
