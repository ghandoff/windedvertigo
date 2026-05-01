"use client";

import { useState, useEffect, useMemo } from "react";
import { ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface MemberOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  project: string;
  status: string;
}

interface NewMeetingNoteDialogProps {
  /** Controlled open state */
  externalOpen?: boolean;
  /** Controlled open handler */
  onExternalOpenChange?: (open: boolean) => void;
}

function todayIso() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function humanDate(iso: string) {
  try {
    const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).toLowerCase();
  } catch {
    return iso;
  }
}

export function NewMeetingNoteDialog({
  externalOpen,
  onExternalOpenChange,
}: NewMeetingNoteDialogProps) {
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

  const [date, setDate] = useState(todayIso());
  const [title, setTitle] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState<{ url: string } | null>(null);

  const [members, setMembers] = useState<MemberOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);

  const placeholder = useMemo(
    () => `garrett × [name] — ${humanDate(date)}`,
    [date],
  );

  useEffect(() => {
    if (!open) return;
    if (members.length > 0 && projects.length > 0) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/members").then((r) => r.json()).catch(() => ({ data: [] })),
      fetch("/api/projects?pageSize=100").then((r) => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([m, p]) => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mRows: any[] = Array.isArray(m) ? m : m?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pRows: any[] = Array.isArray(p) ? p : p?.data ?? [];
        setMembers(
          mRows
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((x: any) => x && x.id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((x: any) => ({ id: x.id, name: x.name ?? "unnamed" })),
        );
        setProjects(
          pRows
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (x: any) =>
                x && x.status !== "complete" && x.status !== "cancelled",
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((x: any) => ({ id: x.id, project: x.project, status: x.status })),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, members.length, projects.length]);

  function reset() {
    setTitle("");
    setDate(todayIso());
    setAttendeeIds([]);
    setProjectId("");
    setErr("");
    setSuccess(null);
  }

  function toggleAttendee(id: string) {
    setAttendeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    const effectiveTitle = title.trim() || placeholder;
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/meeting-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: effectiveTitle,
          date: date || undefined,
          attendeeIds,
          projectId: projectId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "creation failed" }));
        setErr(data.error || `failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setSuccess({ url: data.pageUrl });
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
          <DialogTitle>new meeting note</DialogTitle>
          <DialogDescription className="sr-only">
            create a new meeting note in Notion
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle2 className="size-10 text-green-500" />
            <p className="text-sm font-medium">meeting note created</p>
            <a
              href={success.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              open in notion
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-xs">title</Label>
              <Input
                placeholder={placeholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">attendees</Label>
              {loading ? (
                <p className="text-xs text-muted-foreground">loading members…</p>
              ) : members.length === 0 ? (
                <p className="text-xs text-muted-foreground">no members found</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const selected = attendeeIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleAttendee(m.id)}
                        className={`rounded-md px-2 py-1 text-xs transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {m.name.toLowerCase()}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <Label className="mb-1.5 block text-xs">project</Label>
              <Select
                value={projectId || "__none__"}
                onValueChange={(v) =>
                  setProjectId(!v || v === "__none__" ? "" : v)
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "loading…" : "none"} />
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
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    creating…
                  </>
                ) : (
                  <>create note</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
