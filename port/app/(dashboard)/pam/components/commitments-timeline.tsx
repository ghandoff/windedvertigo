"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TimelineEngine } from "@/app/components/timeline/timeline-engine";
import type { TimelineBar, TimelineLane, Zoom } from "@/app/components/timeline/timeline-types";
import { cascadeShifts, type CascadeUpdate } from "@/app/components/timeline/graph";
import type { PamCommitment } from "@/lib/supabase/pam";
import {
  rescheduleCommitmentAction,
  addDependencyAction,
  removeDependencyAction,
  cascadeRescheduleAction,
} from "../actions";
import { EditCommitmentDialog } from "./edit-commitment-dialog";
import { CascadeConfirmDialog, type CascadePreviewRow } from "./cascade-confirm-dialog";

// status → bar color (hex mirrors the kanban board's tailwind columns)
const STATUS_COLOR: Record<string, string> = {
  "not-started": "#94a3b8",
  "in-progress": "#eab308",
  blocked: "#ef4444",
  done: "#22c55e",
  parked: "#cbd5e1",
};

// preferred lane order; anyone else falls in afterwards alphabetically
const PEOPLE_ORDER = ["garrett", "maria", "payton", "jamie", "lamis"];

export function CommitmentsTimeline({ commitments }: { commitments: PamCommitment[] }) {
  const router = useRouter();
  const [zoom, setZoom] = useState<Zoom>("week");
  const [local, setLocal] = useState(commitments);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PamCommitment | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSchedule, setAutoSchedule] = useState(false);
  const [pendingShifts, setPendingShifts] = useState<CascadeUpdate[]>([]);
  const [cascadeRows, setCascadeRows] = useState<CascadePreviewRow[]>([]);
  const [cascadeOpen, setCascadeOpen] = useState(false);
  const [cascadePending, setCascadePending] = useState(false);

  // re-sync with server data after a refresh, unless mid-save
  useEffect(() => {
    if (!saving) setLocal(commitments);
  }, [commitments, saving]);

  const lanes: TimelineLane[] = useMemo(() => {
    const whos = Array.from(new Set(local.map((c) => c.who)));
    whos.sort((a, b) => {
      const ia = PEOPLE_ORDER.indexOf(a);
      const ib = PEOPLE_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return whos.map((w) => ({ key: w, label: w }));
  }, [local]);

  const bars: TimelineBar[] = useMemo(
    () =>
      local.map((c) => ({
        id: c.id,
        laneKey: c.who,
        label: c.what,
        start: c.start_date,
        end: c.due_date,
        color: STATUS_COLOR[c.status] ?? "#94a3b8",
        status: c.status,
        dependsOn: c.depends_on ?? undefined,
        interactive: true,
      })),
    [local],
  );

  const persist = useCallback(
    async (id: string, start: string, end: string) => {
      // optimistic local update so the bar stays put while the action runs
      setSaving(true);
      setLocal((prev) =>
        prev.map((c) => (c.id === id ? { ...c, start_date: start, due_date: end } : c)),
      );
      try {
        const res = await rescheduleCommitmentAction(id, start, end);
        if (res.error) throw new Error(res.error);

        // opt-in critical-path cascade: preview dependents that would need to move
        if (autoSchedule) {
          const nodes = commitments.map((c) => ({
            id: c.id,
            dependsOn: c.depends_on ?? [],
            start: c.start_date,
            end: c.due_date,
          }));
          const shifts = cascadeShifts(nodes, id, start, end);
          if (shifts.length > 0) {
            const rows: CascadePreviewRow[] = shifts.map((s) => {
              const c = commitments.find((x) => x.id === s.id);
              return {
                id: s.id,
                label: c?.what ?? "",
                who: c?.who ?? "",
                oldStart: c?.start_date ?? null,
                oldEnd: c?.due_date ?? null,
                newStart: s.start,
                newEnd: s.end,
              };
            });
            setPendingShifts(shifts);
            setCascadeRows(rows);
            setCascadeOpen(true);
            setSaving(false);
            return; // dialog resolves the refresh
          }
        }
        router.refresh();
      } catch {
        setLocal(commitments); // revert
      } finally {
        setSaving(false);
      }
    },
    [router, commitments, autoSchedule],
  );

  const applyCascade = useCallback(async () => {
    setCascadePending(true);
    setLocal((prev) =>
      prev.map((c) => {
        const s = pendingShifts.find((x) => x.id === c.id);
        return s ? { ...c, start_date: s.start, due_date: s.end } : c;
      }),
    );
    try {
      const res = await cascadeRescheduleAction(pendingShifts);
      if (res.error) throw new Error(res.error);
      router.refresh();
    } catch {
      setLocal(commitments);
    } finally {
      setCascadePending(false);
      setCascadeOpen(false);
      setPendingShifts([]);
    }
  }, [pendingShifts, router, commitments]);

  const cancelCascade = useCallback(() => {
    setCascadeOpen(false);
    setPendingShifts([]);
    router.refresh(); // the single move already persisted; sync dependents back
  }, [router]);

  const handleBarClick = useCallback(
    (id: string) => {
      const c = local.find((x) => x.id === id);
      if (c) {
        setEditing(c);
        setEditOpen(true);
      }
    },
    [local],
  );

  // create a dependency: engine passes (predecessorId, successorId)
  const handleLinkCreate = useCallback(
    async (predId: string, succId: string) => {
      setError(null);
      setSaving(true);
      setLocal((prev) =>
        prev.map((c) =>
          c.id === succId ? { ...c, depends_on: [...(c.depends_on ?? []), predId] } : c,
        ),
      );
      try {
        const res = await addDependencyAction(succId, predId);
        if (res.error) throw new Error(res.error);
        router.refresh();
      } catch (e) {
        setLocal(commitments);
        setError(e instanceof Error ? e.message : "couldn't link those");
      } finally {
        setSaving(false);
      }
    },
    [router, commitments],
  );

  const handleLinkDelete = useCallback(
    async (predId: string, succId: string) => {
      setError(null);
      setSaving(true);
      setLocal((prev) =>
        prev.map((c) =>
          c.id === succId
            ? { ...c, depends_on: (c.depends_on ?? []).filter((d) => d !== predId) }
            : c,
        ),
      );
      try {
        const res = await removeDependencyAction(succId, predId);
        if (res.error) throw new Error(res.error);
        router.refresh();
      } catch {
        setLocal(commitments);
      } finally {
        setSaving(false);
      }
    },
    [router, commitments],
  );

  if (commitments.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">no commitments to plot yet</p>
        <p className="text-xs mt-1">
          add commitments with start and due dates — or set them here by dragging — and they appear on the timeline
        </p>
      </div>
    );
  }

  return (
    <>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={autoSchedule}
          onChange={(e) => setAutoSchedule(e.target.checked)}
        />
        auto-schedule dependents (preview before applying)
      </label>
      <TimelineEngine
        bars={bars}
        lanes={lanes}
        zoom={zoom}
        onZoomChange={setZoom}
        onReschedule={persist}
        onResize={persist}
        onBarClick={handleBarClick}
        onLinkCreate={handleLinkCreate}
        onLinkDelete={handleLinkDelete}
      />
      {error && <p className="text-xs text-destructive px-1">{error}</p>}
      <EditCommitmentDialog commitment={editing} open={editOpen} onOpenChange={setEditOpen} />
      <CascadeConfirmDialog
        rows={cascadeRows}
        open={cascadeOpen}
        pending={cascadePending}
        onConfirm={applyCascade}
        onCancel={cancelCascade}
      />
      <p className="text-[11px] text-muted-foreground italic px-1">
        drag a bar to reschedule · drag an edge to resize · the blue nub links a dependency · click an arrow to remove it · click a bar to edit
      </p>
    </>
  );
}
