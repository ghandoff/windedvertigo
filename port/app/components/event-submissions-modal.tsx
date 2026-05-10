"use client";

/**
 * EventSubmissionsModal — Phase 6 of the conference intelligence pipeline.
 *
 * Opens when "pursue" is clicked on a campaigns tile. Shows existing
 * submissions for the conference at the top (compact list with status
 * transitions + delete) and an "+ add submission" form below for logging
 * new contributions (talks, panels, sponsorship, etc.).
 *
 * Phase 1 currently redirects pursue → /opportunities/new; the parent
 * agent swaps that redirect for this modal in a single consolidation pass.
 */

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  EventSubmission,
  SubmissionKind,
  SubmissionStatus,
} from "@/lib/supabase/event-submissions";

interface Props {
  eventId: string;
  eventName: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const KIND_OPTIONS: SubmissionKind[] = [
  "talk",
  "panel",
  "workshop",
  "sponsorship",
  "booth",
  "poster",
  "other",
];

const STATUS_OPTIONS: SubmissionStatus[] = [
  "drafting",
  "submitted",
  "accepted",
  "rejected",
  "withdrawn",
];

const STATUS_TRANSITIONS: SubmissionStatus[] = [
  "submitted",
  "accepted",
  "rejected",
  "withdrawn",
];

function statusVariant(
  status: SubmissionStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "accepted") return "default";
  if (status === "rejected" || status === "withdrawn") return "destructive";
  if (status === "submitted") return "secondary";
  return "outline";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function EventSubmissionsModal({
  eventId,
  eventName,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const [submissions, setSubmissions] = useState<EventSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // form state
  const [kind, setKind] = useState<SubmissionKind>("talk");
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [status, setStatus] = useState<SubmissionStatus>("drafting");
  const [notes, setNotes] = useState("");

  const resetForm = useCallback(() => {
    setKind("talk");
    setTitle("");
    setAbstract("");
    setStatus("drafting");
    setNotes("");
  }, []);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/event-submissions?eventId=${encodeURIComponent(eventId)}`,
      );
      if (!res.ok) throw new Error(`load failed (${res.status})`);
      const data = (await res.json()) as { submissions: EventSubmission[] };
      setSubmissions(data.submissions ?? []);
    } catch (err) {
      console.error("[event-submissions-modal] load failed:", err);
      setErrorMsg("could not load submissions");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (open) loadSubmissions();
  }, [open, loadSubmissions]);

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/event-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          kind,
          title: title.trim(),
          abstract: abstract.trim() || undefined,
          status,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `create failed (${res.status})`);
      }
      resetForm();
      await loadSubmissions();
      if (onOpenChange) setOpen(false);
    } catch (err) {
      console.error("[event-submissions-modal] create failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusTransition(
    submissionId: string,
    nextStatus: SubmissionStatus,
  ) {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/event-submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error(`update failed (${res.status})`);
      await loadSubmissions();
    } catch (err) {
      console.error("[event-submissions-modal] status update failed:", err);
      setErrorMsg("could not update status");
    }
  }

  async function handleDelete(submissionId: string, submissionTitle: string) {
    if (!confirm(`delete submission "${submissionTitle}"?`)) return;
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/event-submissions/${submissionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`delete failed (${res.status})`);
      await loadSubmissions();
    } catch (err) {
      console.error("[event-submissions-modal] delete failed:", err);
      setErrorMsg("could not delete submission");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={
            <Button size="sm" variant="default">
              pursue
            </Button>
          }
        />
      )}
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>submissions — {eventName}</DialogTitle>
          <DialogDescription>
            track every contribution to this conference: talks, panels,
            sponsorship, posters.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        {/* existing submissions */}
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            existing submissions
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">loading…</div>
          ) : submissions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              no submissions yet — add one below.
            </div>
          ) : (
            <ul className="space-y-2">
              {submissions.map((s) => (
                <li
                  key={s.id}
                  className="rounded-md border border-border bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {s.kind}
                        </Badge>
                        <Badge
                          variant={statusVariant(s.status)}
                          className="text-xs"
                        >
                          {s.status}
                        </Badge>
                        {s.decisionAt && (
                          <span className="text-xs text-muted-foreground">
                            decided {formatDate(s.decisionAt)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-sm font-medium">
                        {s.title}
                      </div>
                      {s.abstract && (
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {s.abstract}
                        </div>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(s.id, s.title)}
                      aria-label="delete submission"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {STATUS_TRANSITIONS.filter((t) => t !== s.status).map(
                      (t) => (
                        <Button
                          key={t}
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleStatusTransition(s.id, t)}
                        >
                          {t}
                        </Button>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* add new */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            + add submission
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">kind</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as SubmissionKind)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as SubmissionStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. participatory evaluation in ed-tech procurement"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">abstract</Label>
            <Textarea
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="short summary of the submission…"
              rows={3}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="internal notes, deadlines, contacts…"
              rows={2}
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={!title.trim() || saving}
            className="w-full"
          >
            {saving ? "saving…" : "save submission"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
