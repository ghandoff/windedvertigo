"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import type { RfpMilestone, MilestoneStatus } from "@/lib/supabase/rfp-milestones";

// ── type options ──────────────────────────────────────────────────────────────
// These map to common deadline labels. The user can also type a custom label.
const LABEL_OPTIONS = [
  "EOI submission",
  "Full proposal",
  "Clarification response",
  "Report",
  "Internal review complete",
  "Garrett final pass",
  "Initial draft generated",
  "SME draft contributions due",
];

// ── helpers ───────────────────────────────────────────────────────────────────

function isOverdue(m: RfpMilestone): boolean {
  return m.status !== "done" && m.status !== "cancelled" && new Date(m.dueAt) < new Date();
}

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Convert a local date-input value (YYYY-MM-DD) to an ISO timestamp at noon UTC */
function dateInputToIso(val: string): string {
  return `${val}T12:00:00Z`;
}

/** Convert an ISO timestamp to the YYYY-MM-DD string for <input type="date"> */
function isoToDateInput(isoStr: string): string {
  return isoStr.slice(0, 10);
}

// ── status badge ──────────────────────────────────────────────────────────────
const STATUS_CFG: Record<MilestoneStatus, { label: string; cls: string }> = {
  pending:      { label: "pending",      cls: "text-muted-foreground" },
  "in-progress":{ label: "in progress",  cls: "text-yellow-600" },
  done:         { label: "done",         cls: "text-green-600" },
  slipped:      { label: "slipped",      cls: "text-orange-500" },
  cancelled:    { label: "cancelled",    cls: "text-muted-foreground line-through" },
};

// ── props ─────────────────────────────────────────────────────────────────────

interface Props {
  rfpId: string;
  milestones: RfpMilestone[];
}

// ── component ─────────────────────────────────────────────────────────────────

export function RfpMilestoneTracker({ rfpId, milestones: initial }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [milestones, setMilestones] = useState<RfpMilestone[]>(initial);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // id of row being mutated

  const hasOverdue = milestones.some(isOverdue);

  // ── add ──────────────────────────────────────────────────────────────────────
  async function addMilestone() {
    const trimmed = label.trim();
    if (!trimmed) { setErr("label is required"); return; }
    if (!dueDate) { setErr("due date is required"); return; }
    setErr(null);

    const res = await fetch(`/api/rfp-radar/${rfpId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: trimmed,
        dueAt: dateInputToIso(dueDate),
        ownerEmail: ownerEmail.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error ?? "save failed"); return; }

    setMilestones((prev) =>
      [...prev, data as RfpMilestone].sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
      ),
    );
    setLabel(""); setDueDate(""); setOwnerEmail(""); setAdding(false);
    startTransition(() => router.refresh());
  }

  // ── toggle done ───────────────────────────────────────────────────────────────
  async function toggleDone(m: RfpMilestone) {
    const nextStatus: MilestoneStatus = m.status === "done" ? "pending" : "done";
    setBusy(m.id);

    // Optimistic update
    setMilestones((prev) =>
      prev.map((r) => r.id === m.id ? { ...r, status: nextStatus } : r),
    );

    await fetch(`/api/rfp-radar/${rfpId}/milestones`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneId: m.id, status: nextStatus }),
    });
    setBusy(null);
    startTransition(() => router.refresh());
  }

  // ── delete ────────────────────────────────────────────────────────────────────
  async function removeMilestone(id: string) {
    setBusy(id);
    setMilestones((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/rfp-radar/${rfpId}/milestones`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneId: id }),
    });
    setBusy(null);
    startTransition(() => router.refresh());
  }

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          deadlines &amp; milestones
          {hasOverdue && <AlertTriangle className="h-4 w-4 text-red-500 ml-auto" />}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* overdue banner */}
        {hasOverdue && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>one or more deadlines are overdue — update status or remove if cancelled.</span>
          </div>
        )}

        {/* empty state */}
        {milestones.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            no deadlines tracked yet. add key dates to avoid missing submission windows.
          </p>
        )}

        {/* milestone rows */}
        <div className="space-y-2">
          {milestones.map((m) => {
            const overdue = isOverdue(m);
            const done = m.status === "done";
            const cfg = STATUS_CFG[m.status];
            return (
              <div
                key={m.id}
                className={`flex items-start gap-2 ${busy === m.id ? "opacity-50" : ""}`}
              >
                {/* done toggle */}
                <button
                  onClick={() => toggleDone(m)}
                  disabled={busy === m.id}
                  title={done ? "mark pending" : "mark done"}
                  className={`shrink-0 mt-0.5 transition-colors ${done ? "text-green-600 hover:text-muted-foreground" : "text-muted-foreground hover:text-green-600"}`}
                >
                  {done
                    ? <CheckCircle2 className="h-4 w-4" />
                    : <Clock className={`h-4 w-4 ${overdue ? "text-red-500" : ""}`} />
                  }
                </button>

                {/* label + date */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-snug ${done ? "line-through text-muted-foreground" : ""} ${overdue ? "text-red-700" : ""}`}>
                    {m.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                    {overdue ? "overdue · " : ""}{formatDate(m.dueAt)}
                    {m.ownerEmail && (
                      <span className="ml-1.5 text-muted-foreground">· {m.ownerEmail}</span>
                    )}
                  </p>
                  {m.status !== "pending" && m.status !== "done" && (
                    <p className={`text-[10px] mt-0.5 ${cfg.cls}`}>{cfg.label}</p>
                  )}
                </div>

                {/* delete */}
                <button
                  onClick={() => removeMilestone(m.id)}
                  disabled={busy === m.id}
                  title="remove"
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* add form */}
        {adding ? (
          <div className="space-y-2 pt-1 border-t border-border/40">
            <div>
              <label className="text-xs text-muted-foreground">label</label>
              <input
                list="milestone-labels"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. EOI submission, full proposal…"
                className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <datalist id="milestone-labels">
                {LABEL_OPTIONS.map((o) => <option key={o} value={o} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">owner email (optional)</label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="e.g. garrett@windedvertigo.com"
                className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <div className="flex gap-2">
              <button
                onClick={addMilestone}
                className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
              >
                save
              </button>
              <button
                onClick={() => { setAdding(false); setErr(null); setLabel(""); setDueDate(""); setOwnerEmail(""); }}
                className="rounded px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            add deadline
          </button>
        )}
      </CardContent>
    </Card>
  );
}
