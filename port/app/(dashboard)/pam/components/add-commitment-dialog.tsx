"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addCommitmentAction } from "../actions";

const PEOPLE = ["garrett", "maria", "payton", "jamie", "lamis"];

export function AddCommitmentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("garrett");
  const [what, setWhat] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!what.trim()) {
      setError("what is required");
      return;
    }
    startTransition(async () => {
      const res = await addCommitmentAction({
        who,
        what: what.trim(),
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
        source: source.trim() || undefined,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setWhat("");
      setStartDate("");
      setDueDate("");
      setSource("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          new commitment
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>new commitment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="who">who</Label>
            <Select value={who} onValueChange={(v) => setWho(v ?? "garrett")}>
              <SelectTrigger id="who">
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
            <Label htmlFor="what">what</Label>
            <Input
              id="what"
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder="e.g. draft the WTG proposal"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">start date (optional)</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due">due date (optional)</Label>
              <Input
                id="due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source">source (optional)</Label>
            <Input
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. whirlpool, 1:1, slack"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "saving…" : "create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
