"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import type { PamCommitment } from "@/lib/supabase/pam";
import { updateCommitmentAction, deleteCommitmentAction, searchWorkItemsAction } from "../actions";

const STATUSES = ["not-started", "in-progress", "blocked", "done", "parked"];
const PEOPLE = ["garrett", "maria", "payton", "jamie", "lamis"];

const notionUrl = (id: string) => `https://www.notion.so/${id.replace(/-/g, "")}`;

export function EditCommitmentDialog({
  commitment,
  open,
  onOpenChange,
  programmes = [],
}: {
  commitment: PamCommitment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programmes?: string[];
}) {
  const router = useRouter();
  const [who, setWho] = useState("garrett");
  const [what, setWhat] = useState("");
  const [status, setStatus] = useState("not-started");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [programme, setProgramme] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  // work_item link
  const [workItemId, setWorkItemId] = useState<string | null>(null);
  const [linkedTask, setLinkedTask] = useState<string | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; task: string }>>([]);

  useEffect(() => {
    if (commitment) {
      setWho(commitment.who);
      setWhat(commitment.what);
      setStatus(commitment.status);
      setStartDate(commitment.start_date ?? "");
      setDueDate(commitment.due_date ?? "");
      setProgramme(commitment.programme ?? "");
      setWorkItemId(commitment.work_item_id ?? null);
      setLinkedTask(null);
      setLinkQuery("");
      setResults([]);
      setError(null);
      setConfirmDelete(false);
    }
  }, [commitment]);

  // debounced work-item title search
  useEffect(() => {
    if (linkQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setResults(await searchWorkItemsAction(linkQuery));
    }, 300);
    return () => clearTimeout(t);
  }, [linkQuery]);

  function submit() {
    if (!commitment) return;
    setError(null);
    if (!what.trim()) return setError("what is required");
    startTransition(async () => {
      const res = await updateCommitmentAction(commitment.id, {
        who,
        what: what.trim(),
        status,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
        work_item_id: workItemId,
        programme: programme.trim() || null,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>edit commitment{commitment ? ` · ${commitment.who}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-who">who</Label>
            <Select value={who} onValueChange={(v) => setWho(v ?? "garrett")}>
              <SelectTrigger id="edit-who">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PEOPLE.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-what">what</Label>
            <Input id="edit-what" value={what} onChange={(e) => setWhat(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-status">status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "not-started")}>
              <SelectTrigger id="edit-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">start date</Label>
              <Input id="edit-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-due">due date</Label>
              <Input id="edit-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-programme">programme <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="edit-programme"
              list="pam-programmes-edit"
              value={programme}
              onChange={(e) => setProgramme(e.target.value)}
              placeholder="e.g. amna at 10"
            />
            <datalist id="pam-programmes-edit">
              {programmes.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>link a project task <span className="text-muted-foreground font-normal">(optional)</span></Label>
            {workItemId ? (
              <div className="flex items-center gap-2 text-xs">
                <a
                  href={notionUrl(workItemId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {linkedTask ?? "linked task"}
                </a>
                <button
                  type="button"
                  onClick={() => { setWorkItemId(null); setLinkedTask(null); }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  unlink
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={linkQuery}
                  onChange={(e) => setLinkQuery(e.target.value)}
                  placeholder="search project tasks by title…"
                />
                {results.length > 0 && (
                  <div className="border border-border rounded-md max-h-40 overflow-y-auto">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => { setWorkItemId(r.id); setLinkedTask(r.task); setLinkQuery(""); setResults([]); }}
                        className="block w-full text-left text-xs px-2 py-1.5 hover:bg-muted/50"
                      >
                        {r.task}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <p className="text-[10px] text-muted-foreground">
              projects = what we&apos;re building · pam = what i&apos;m doing this week
            </p>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              if (!commitment) return;
              startTransition(async () => {
                const res = await deleteCommitmentAction(commitment.id);
                if (res.error) { setError(res.error); setConfirmDelete(false); return; }
                onOpenChange(false);
                router.refresh();
              });
            }}
          >
            {confirmDelete ? "confirm delete" : "delete"}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { onOpenChange(false); setConfirmDelete(false); }} disabled={pending}>
              cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "saving…" : "save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
