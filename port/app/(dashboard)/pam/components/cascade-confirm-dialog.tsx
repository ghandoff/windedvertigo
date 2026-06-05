"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";

export interface CascadePreviewRow {
  id: string;
  label: string;
  who: string;
  oldStart: string | null;
  oldEnd: string | null;
  newStart: string;
  newEnd: string;
}

// Confirm dialog for the opt-in critical-path auto-shift. Lists every dependent
// commitment that would move and its old → new dates. Nothing shifts until the
// user confirms here.
export function CascadeConfirmDialog({
  rows,
  open,
  pending,
  onConfirm,
  onCancel,
}: {
  rows: CascadePreviewRow[];
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>shift {rows.length} dependent {rows.length === 1 ? "commitment" : "commitments"}?</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            moving this commitment pushes its dependents so each still starts after the thing it waits on. durations are kept.
          </p>
          {rows.map((r) => (
            <div key={r.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.who}</span>
                <span className="truncate">{r.label}</span>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
                {formatDate(r.oldStart)} → {formatDate(r.oldEnd)}
                <span className="mx-1.5 text-foreground">⇒</span>
                <span className="text-foreground">{formatDate(r.newStart)} → {formatDate(r.newEnd)}</span>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "shifting…" : "shift them"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
