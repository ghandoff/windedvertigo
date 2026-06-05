"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { updateCommitmentAction } from "../actions";

const STATUSES = ["not-started", "in-progress", "blocked", "done", "parked"];
const PEOPLE = ["garrett", "maria", "payton", "jamie", "lamis"];

export function EditCommitmentDialog({
  commitment,
  open,
  onOpenChange,
}: {
  commitment: PamCommitment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [who, setWho] = useState("garrett");
  const [what, setWhat] = useState("");
  const [status, setStatus] = useState("not-started");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (commitment) {
      setWho(commitment.who);
      setWhat(commitment.what);
      setStatus(commitment.status);
      setStartDate(commitment.start_date ?? "");
      setDueDate(commitment.due_date ?? "");
      setError(null);
    }
  }, [commitment]);

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
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "saving…" : "save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
