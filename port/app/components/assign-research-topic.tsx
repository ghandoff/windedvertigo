"use client";

/**
 * AssignResearchTopic — the Pam/Mo → cARL handoff surface.
 *
 * A button that opens a small dialog to queue a research topic for cARL. On
 * submit it writes a `carl_curriculum` row (status: planned) via
 * assignResearchTopicAction; cARL's study cron picks it up and the sources it
 * cites file back into the bibliography. Mounted on /bibliography, /carl, and
 * the agent dashboards (Pam, Mo) — same component, same action, everywhere.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { assignResearchTopicAction } from "@/app/(dashboard)/carl/actions";

// cARL's standing domains (from docs/carl/posture.md) — suggestions, not a fixed list.
const DOMAINS = [
  "threshold concepts",
  "play-based learning",
  "AI in education",
  "learning design patterns",
  "assessment & evaluation",
  "accessibility & UDL",
  "cultural responsiveness",
];

export function AssignResearchTopic({
  assignedBy,
  defaultDomain,
  variant = "outline",
  size = "sm",
  label = "assign cARL a topic",
}: {
  /** who's assigning — stamped on the curriculum note (e.g. "Mo", "Pam", "Jamie"). */
  assignedBy?: string;
  defaultDomain?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState(defaultDomain ?? "");
  const [topic, setTopic] = useState("");
  const [keyWorks, setKeyWorks] = useState("");
  const [priority, setPriority] = useState("2");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await assignResearchTopicAction({
        domain,
        topic,
        keyWorks: keyWorks.split(",").map((s) => s.trim()).filter(Boolean),
        priority: Number(priority) || 2,
        notes: notes.trim() || undefined,
        assignedBy,
      });
      if (res.error) return setError(res.error);
      setDone(true);
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setTopic("");
        setKeyWorks("");
        setNotes("");
      }, 1100);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant={variant} size={size} className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          {label}
        </Button>
      } />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>assign cARL a research topic</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground -mt-1">
            cARL studies queued topics on its schedule and files the sources it cites
            back into the bibliography.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">research domain</Label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. threshold concepts"
              list="carl-domains"
            />
            <datalist id="carl-domains">
              {DOMAINS.map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">topic to cover</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. efficacy of AI tutoring in higher ed"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">priority</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="h-9 w-full text-sm border border-input rounded-md px-2 bg-background"
              >
                <option value="1">high</option>
                <option value="2">medium</option>
                <option value="3">low</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">key works (optional)</Label>
              <Input
                value={keyWorks}
                onChange={(e) => setKeyWorks(e.target.value)}
                placeholder="comma-separated"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">notes for cARL (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="why this matters / what we're building"
              rows={2}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving || done || !domain.trim() || !topic.trim()} className="gap-1.5">
            {done ? <><Check className="h-3.5 w-3.5" /> queued</>
              : saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> queuing…</>
              : "assign to cARL"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
