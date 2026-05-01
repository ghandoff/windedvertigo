"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkItemPriority } from "@/lib/notion/types";

const PRIORITY_OPTIONS: WorkItemPriority[] = ["low", "medium", "high", "urgent"];

interface ProjectOption {
  id: string;
  project: string;
  status: string;
}

interface NewTaskDialogProps {
  /** Controlled open state */
  externalOpen?: boolean;
  /** Controlled open handler */
  onExternalOpenChange?: (open: boolean) => void;
}

export function NewTaskDialog({
  externalOpen,
  onExternalOpenChange,
}: NewTaskDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const controlled = externalOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? externalOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlled) {
      onExternalOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
  };

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [priority, setPriority] = useState<WorkItemPriority | "">("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  // Projects for picker — fetch lazily when dialog opens
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  useEffect(() => {
    if (!open || projects.length > 0 || projectsLoading) return;
    let cancelled = false;
    setProjectsLoading(true);
    fetch("/api/projects?pageSize=100")
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = Array.isArray(payload) ? payload : payload?.data ?? [];
        const active = rows
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((p: any) => p && p.status !== "complete" && p.status !== "cancelled")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((p: any) => ({ id: p.id, project: p.project, status: p.status }));
        setProjects(active);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projects.length, projectsLoading]);

  function reset() {
    setTitle("");
    setProjectId("");
    setPriority("");
    setDueDate("");
    setDescription("");
    setErr("");
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setErr("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = {
        task: title.trim(),
        status: "in queue",
      };
      if (projectId) payload.projectIds = [projectId];
      if (priority) payload.priority = priority;
      if (dueDate) payload.dueDate = { start: dueDate };
      if (description.trim()) payload.description = description.trim();

      const res = await fetch("/api/work-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "creation failed" }));
        setErr(data.error || `failed (${res.status})`);
        return;
      }
      reset();
      setOpen(false);
      startTransition(() => router.refresh());
    } catch {
      setErr("network error — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>new task</DialogTitle>
          <DialogDescription className="sr-only">
            add a new task to your work items
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-xs">title *</Label>
            <Input
              placeholder="e.g., draft brief for creaseworks onboarding"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">project</Label>
            <Select
              value={projectId || "__none__"}
              onValueChange={(v) => setProjectId(!v || v === "__none__" ? "" : v)}
              disabled={projectsLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={projectsLoading ? "loading…" : "none"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">none</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">priority</Label>
              <Select
                value={priority || "__none__"}
                onValueChange={(v) =>
                  setPriority(!v || v === "__none__" ? "" : (v as WorkItemPriority))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="none" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">none</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">description</Label>
            <Textarea
              placeholder="brief context, if helpful"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {err && <p className="text-xs text-destructive">{err}</p>}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              cancel
            </Button>
            <Button
              className="flex-1 gap-1.5"
              onClick={handleSave}
              disabled={!title.trim() || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  saving…
                </>
              ) : (
                <>create task</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
