"use client";

import { useState, useEffect, useMemo, useRef, useTransition } from "react";
import { CheckCircle2, Circle, AlertCircle, CircleDot, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PamCommitment } from "@/lib/supabase/pam";
import { memberStyle } from "@/lib/pam/members";
import { updateCommitmentStatusAction } from "../actions";

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

/** tap order — cycles a tile forward through the three working states. blocked
 *  and parked jump into the flow at in-progress. */
function nextStatus(s: string): string {
  if (s === "not-started") return "in-progress";
  if (s === "in-progress") return "done";
  if (s === "done") return "not-started";
  return "in-progress";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "blocked") return <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />;
  if (status === "in-progress") return <CircleDot className="h-3.5 w-3.5 text-primary/70" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />;
}

function Avatar({ who, size = 22 }: { who: string; size?: number }) {
  const m = memberStyle(who);
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-full font-medium shrink-0"
      style={{ width: size, height: size, background: m.bg, color: m.fg, fontSize: size * 0.42 }}
    >
      {m.initial}
    </span>
  );
}

function CommitmentCard({
  c,
  onTap,
}: {
  c: PamCommitment;
  onTap: (c: PamCommitment, el: HTMLElement) => void;
}) {
  const typeClass = c.commitment_type ? TYPE_COLOUR[c.commitment_type] : null;
  return (
    <button
      type="button"
      onClick={(e) => onTap(c, e.currentTarget)}
      title="tap to advance: not started → in progress → done"
      className={cn(
        "w-full rounded-md border bg-card p-2.5 space-y-1.5 text-left transition-colors cursor-pointer hover:border-border/80 hover:bg-muted/40",
        c.status === "done" ? "opacity-60" : "",
        c.status === "blocked" ? "border-yellow-400/40" : "border-border",
      )}
    >
      <div className="flex items-start gap-1.5">
        <StatusIcon status={c.status} />
        <p className={cn("text-xs font-medium leading-snug flex-1", c.status === "done" && "line-through")}>
          {c.what}
        </p>
      </div>
      {c.if_then_plan && (
        <p className="text-[11px] text-muted-foreground italic leading-snug pl-5">{c.if_then_plan}</p>
      )}
      {c.blocker && <p className="text-[11px] text-yellow-600 pl-5">blocked: {c.blocker}</p>}
      <div className="flex items-center gap-1.5 pl-5 flex-wrap">
        {c.commitment_type && (
          <span className={cn("text-[10px] px-1.5 py-0 rounded border", typeClass)}>{c.commitment_type}</span>
        )}
        {c.due_date && <span className="text-[10px] text-muted-foreground">{c.due_date}</span>}
      </div>
    </button>
  );
}

function Lane({
  title,
  commitments,
  avatarWho,
  onTap,
}: {
  title: string;
  commitments: PamCommitment[];
  avatarWho?: string;
  onTap: (c: PamCommitment, el: HTMLElement) => void;
}) {
  if (commitments.length === 0) return null;
  const done = commitments.filter((c) => c.status === "done").length;
  return (
    <div className="min-w-[200px] flex-1 space-y-2">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            {avatarWho && <Avatar who={avatarWho} size={20} />}
            <h4 className="text-xs font-medium capitalize truncate">{title}</h4>
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {done}/{commitments.length}
          </span>
        </div>
        <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500/70 transition-all"
            style={{ width: commitments.length ? `${(done / commitments.length) * 100}%` : "0%" }}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        {commitments.map((c) => (
          <CommitmentCard key={c.id} c={c} onTap={onTap} />
        ))}
      </div>
    </div>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const frac = total ? done / total : 0;
  return (
    <div className="flex items-center gap-2">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted" />
        <circle
          cx="17"
          cy="17"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          className="text-emerald-500 transition-all"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          transform="rotate(-90 17 17)"
        />
      </svg>
      <span className="text-xs text-muted-foreground tabular-nums">
        {done}/{total} done
      </span>
    </div>
  );
}

interface WhirlpoolBoardProps {
  commitments: PamCommitment[];
  cycle: string;
}

export function WhirlpoolBoard({ commitments, cycle }: WhirlpoolBoardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("owner");
  const [items, setItems] = useState<PamCommitment[]>(commitments);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Re-seed from server data whenever the page revalidates.
  useEffect(() => setItems(commitments), [commitments]);

  function celebrate(el: HTMLElement) {
    const wrap = wrapRef.current;
    if (!wrap || !el) return;
    const wr = wrap.getBoundingClientRect();
    const cr = el.getBoundingClientRect();
    const x = cr.left - wr.left + cr.width / 2;
    const y = cr.top - wr.top + 8;
    const cols = ["#1D9E75", "#378ADD", "#D4537E", "#EF9F27", "#7F77DD"];
    for (let i = 0; i < 14; i++) {
      const d = document.createElement("div");
      d.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:7px;height:7px;border-radius:2px;background:${cols[i % 5]};pointer-events:none;z-index:30`;
      wrap.appendChild(d);
      const dx = Math.random() * 120 - 60;
      const dy = 50 + Math.random() * 80;
      const anim = d.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 320}deg)`, opacity: 0 },
        ],
        { duration: 800 + Math.random() * 300, easing: "cubic-bezier(.2,.6,.3,1)" },
      );
      anim.onfinish = () => d.remove();
    }
  }

  function tap(c: PamCommitment, el: HTMLElement) {
    const ns = nextStatus(c.status);
    setError(null);
    setItems((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? { ...x, status: ns as PamCommitment["status"], completed_at: ns === "done" ? new Date().toISOString() : null }
          : x,
      ),
    );
    if (ns === "done") celebrate(el);
    startTransition(async () => {
      const res = await updateCommitmentStatusAction(c.id, ns);
      if (res?.error) {
        setItems(commitments); // revert to server truth
        setError(res.error);
      }
    });
  }

  const active = useMemo(() => items.filter((c) => c.status !== "parked"), [items]);
  const completed = useMemo(() => items.filter((c) => c.status === "done"), [items]);
  const doneCount = completed.length;

  const ownerGroups = useMemo(() => {
    const map = new Map<string, PamCommitment[]>();
    for (const c of active) {
      if (!map.has(c.who)) map.set(c.who, []);
      map.get(c.who)!.push(c);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [active]);

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
    <div ref={wrapRef} className="relative space-y-5">
      {/* header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <ProgressRing done={doneCount} total={items.length} />
          <p className="text-xs text-muted-foreground">{cycleLabel} · tap a tile to advance it</p>
        </div>
        <div className="inline-flex items-center rounded-md border border-border bg-muted/50 p-0.5">
          <button
            onClick={() => setViewMode("owner")}
            className={cn(
              "px-2.5 py-1 text-xs rounded-sm transition-colors whitespace-nowrap",
              viewMode === "owner" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            by person
          </button>
          <button
            onClick={() => setViewMode("status")}
            className={cn(
              "px-2.5 py-1 text-xs rounded-sm transition-colors whitespace-nowrap",
              viewMode === "status" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            by status
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-red-600 border border-red-400/30 bg-red-500/5 rounded px-2 py-1">
          couldn&apos;t save: {error}
        </p>
      )}

      {/* board */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">no public commitments this cycle</p>
          <p className="text-xs text-muted-foreground mt-1">ask PaM to capture commitments from the whirlpool, or add one manually</p>
        </div>
      ) : viewMode === "owner" ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {ownerGroups.map(([owner, group]) => (
            <Lane key={owner} title={owner} commitments={group} avatarWho={owner} onTap={tap} />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {statusGroups.map((g) => (
            <Lane key={g.status} title={g.label} commitments={g.items} onTap={tap} />
          ))}
        </div>
      )}

      {/* wins this week */}
      {completed.length > 0 && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700">
              wins this week · {completed.length} done
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {completed.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-700"
              >
                <Avatar who={c.who} size={14} />
                {c.what.length > 40 ? `${c.what.slice(0, 40)}…` : c.what}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
