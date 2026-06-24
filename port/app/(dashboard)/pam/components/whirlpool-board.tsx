"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, Circle, AlertCircle, CircleDot, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PamCommitment } from "@/lib/supabase/pam";

type ViewMode = "owner" | "status";

const STATUS_ORDER = ["not-started", "in-progress", "blocked", "done", "parked"] as const;
const STATUS_LABELS: Record<string, string> = {
  "not-started": "not started",
  "in-progress": "in progress",
  blocked: "blocked",
  done: "done",
  parked: "parked",
};
const TYPE_COLOUR: Record<string, string> = {
  action: "bg-blue-500/10 text-blue-600 border-blue-400/30",
  learning: "bg-violet-500/10 text-violet-600 border-violet-400/30",
  connection: "bg-emerald-500/10 text-emerald-600 border-emerald-400/30",
  ritual: "bg-amber-500/10 text-amber-600 border-amber-400/30",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "blocked") return <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />;
  if (status === "in-progress") return <CircleDot className="h-3.5 w-3.5 text-primary/70" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />;
}

function CommitmentCard({ c }: { c: PamCommitment }) {
  const typeClass = c.commitment_type ? TYPE_COLOUR[c.commitment_type] : null;
  return (
    <div
      className={cn(
        "rounded-md border bg-card p-2.5 space-y-1.5 text-left",
        c.status === "done" ? "opacity-60" : "",
        c.status === "blocked" ? "border-yellow-400/40" : "border-border",
      )}
    >
      <div className="flex items-start gap-1.5">
        <StatusIcon status={c.status} />
        <p className="text-xs font-medium leading-snug flex-1">{c.what}</p>
      </div>
      {c.if_then_plan && (
        <p className="text-[11px] text-muted-foreground italic leading-snug pl-5">
          {c.if_then_plan}
        </p>
      )}
      {c.blocker && (
        <p className="text-[11px] text-yellow-600 pl-5">blocked: {c.blocker}</p>
      )}
      <div className="flex items-center gap-1.5 pl-5 flex-wrap">
        {c.commitment_type && (
          <span className={cn("text-[10px] px-1.5 py-0 rounded border", typeClass)}>
            {c.commitment_type}
          </span>
        )}
        {c.due_date && (
          <span className="text-[10px] text-muted-foreground">{c.due_date}</span>
        )}
      </div>
    </div>
  );
}

function Lane({ title, commitments, subtitle }: { title: string; commitments: PamCommitment[]; subtitle?: string }) {
  if (commitments.length === 0) return null;
  const done = commitments.filter((c) => c.status === "done").length;
  return (
    <div className="min-w-[180px] flex-1 space-y-2">
      <div>
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium capitalize">{title}</h4>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {done}/{commitments.length}
          </span>
        </div>
        {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500/70 transition-all"
            style={{ width: commitments.length ? `${(done / commitments.length) * 100}%` : "0%" }}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        {commitments.map((c) => (
          <CommitmentCard key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}

interface WhirlpoolBoardProps {
  commitments: PamCommitment[];
  cycle: string;
}

export function WhirlpoolBoard({ commitments, cycle }: WhirlpoolBoardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("owner");

  const active = useMemo(
    () => commitments.filter((c) => c.status !== "parked"),
    [commitments],
  );
  const completed = useMemo(
    () => commitments.filter((c) => c.status === "done"),
    [commitments],
  );

  // by-owner groups
  const ownerGroups = useMemo(() => {
    const map = new Map<string, PamCommitment[]>();
    for (const c of active) {
      if (!map.has(c.who)) map.set(c.who, []);
      map.get(c.who)!.push(c);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [active]);

  // by-status groups
  const statusGroups = useMemo(() => {
    return STATUS_ORDER.map((s) => ({
      status: s,
      label: STATUS_LABELS[s],
      items: active.filter((c) => c.status === s),
    })).filter((g) => g.items.length > 0);
  }, [active]);

  const [cycleMonth, cycleDay] = cycle.split("-").slice(1);
  const cycleLabel = `week of ${cycleMonth}/${cycleDay}`;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{cycleLabel} · {commitments.length} public commitment{commitments.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="inline-flex items-center rounded-md border border-border bg-muted/50 p-0.5">
          <button
            onClick={() => setViewMode("owner")}
            className={cn(
              "px-2.5 py-1 text-xs rounded-sm transition-colors whitespace-nowrap",
              viewMode === "owner"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            by person
          </button>
          <button
            onClick={() => setViewMode("status")}
            className={cn(
              "px-2.5 py-1 text-xs rounded-sm transition-colors whitespace-nowrap",
              viewMode === "status"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            by status
          </button>
        </div>
      </div>

      {/* board */}
      {commitments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">no public commitments this cycle</p>
          <p className="text-xs text-muted-foreground mt-1">ask PaM to capture commitments from the whirlpool, or add one manually</p>
        </div>
      ) : viewMode === "owner" ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {ownerGroups.map(([owner, items]) => (
            <Lane key={owner} title={owner} commitments={items} />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {statusGroups.map((g) => (
            <Lane key={g.status} title={g.label} commitments={g.items} />
          ))}
        </div>
      )}

      {/* recognition strip */}
      {completed.length > 0 && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700">
              {completed.length} commitment{completed.length !== 1 ? "s" : ""} completed this cycle
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {completed.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-700"
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                {c.who}: {c.what.length > 40 ? `${c.what.slice(0, 40)}…` : c.what}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
