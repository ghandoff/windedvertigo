"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TimelineEngine } from "@/app/components/timeline/timeline-engine";
import type { TimelineBar, TimelineLane, Zoom } from "@/app/components/timeline/timeline-types";
import type { PamCommitment } from "@/lib/supabase/pam";
import { rescheduleCommitmentAction } from "../actions";
import { EditCommitmentDialog } from "./edit-commitment-dialog";

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
        router.refresh();
      } catch {
        setLocal(commitments); // revert
      } finally {
        setSaving(false);
      }
    },
    [router, commitments],
  );

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
      <TimelineEngine
        bars={bars}
        lanes={lanes}
        zoom={zoom}
        onZoomChange={setZoom}
        onReschedule={persist}
        onResize={persist}
        onBarClick={handleBarClick}
      />
      <EditCommitmentDialog commitment={editing} open={editOpen} onOpenChange={setEditOpen} />
      <p className="text-[11px] text-muted-foreground italic px-1">
        drag a bar to reschedule · drag an edge to resize · click to edit · diamonds are due-only commitments · colored by status
      </p>
    </>
  );
}
