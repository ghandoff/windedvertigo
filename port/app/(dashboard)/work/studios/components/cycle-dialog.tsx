"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Cycle, Project } from "@/lib/notion/types";

const STATUSES = ["planned", "active", "complete"] as const;

interface CycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle?: Cycle | null;
  projects: Project[];
}

function twoWeeksFromNow(start: string): string {
  const d = new Date(start);
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CycleDialog({ open, onOpenChange, cycle, projects }: CycleDialogProps) {
  const router = useRouter();
  const isEdit = !!cycle;

  const [name, setName] = useState(cycle?.cycle ?? "");
  const [status, setStatus] = useState<string>(cycle?.status ?? "planned");
  const [startDate, setStartDate] = useState(cycle?.startDate?.start?.slice(0, 10) ?? today());
  const [endDate, setEndDate] = useState(cycle?.endDate?.start?.slice(0, 10) ?? twoWeeksFromNow(today()));
  const [goal, setGoal] = useState(cycle?.goal ?? "");
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(
    new Set(cycle?.projectIds ?? []),
  );
  const [saving, setSaving] = useState(false);

  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const body = {
      cycle: name.trim(),
      status,
      startDate: { start: startDate, end: null },
      endDate: { start: endDate, end: null },
      goal: goal.trim(),
      projectIds: [...selectedProjectIds],
    };

    try {
      if (isEdit) {
        await fetch(`/api/cycles/${cycle.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/cycles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      router.refresh();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!cycle) return;
    setSaving(true);
    try {
      await fetch(`/api/cycles/${cycle.id}`, { method: "DELETE" });
      router.refresh();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "edit cycle" : "new cycle"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cycle-name">name</Label>
            <Input
              id="cycle-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. sprint 3 — eddyy mvp"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cycle-start">start</Label>
              <Input
                id="cycle-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || e.target.value > endDate) {
                    setEndDate(twoWeeksFromNow(e.target.value));
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cycle-end">end</Label>
              <Input
                id="cycle-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cycle-status">status</Label>
            <select
              id="cycle-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-sm border rounded-md px-3 py-2 bg-background"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cycle-goal">goal</Label>
            <Textarea
              id="cycle-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="what should be true at the end of this cycle?"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>linked projects</Label>
            <div className="flex flex-wrap gap-1.5">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProject(p.id)}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    selectedProjectIds.has(p.id)
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                  }`}
                >
                  {p.project}
                </button>
              ))}
              {projects.length === 0 && (
                <p className="text-xs text-muted-foreground">no studio projects found</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div>
            {isEdit && (
              <Button variant="ghost" size="sm" onClick={handleArchive} disabled={saving} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                archive
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "saving..." : isEdit ? "save" : "create cycle"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
