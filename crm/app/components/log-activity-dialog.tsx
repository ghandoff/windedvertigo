"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

const ACTIVITY_TYPES = [
  "email sent", "email received", "meeting", "call",
  "conference encounter", "intro made", "linkedin message",
  "proposal shared", "other",
] as const;

const OUTCOMES = ["positive", "neutral", "no response", "declined"] as const;

const TEAM_MEMBERS = ["garrett", "maría", "jamie", "lamis", "yigal"] as const;

interface LogActivityDialogProps {
  contactId?: string;
  contactName?: string;
  organizationIds?: string[];
  /** Callback when a positive activity is logged on an early-stage contact */
  onSuggestAdvance?: (nextStage: string) => void;
  currentStage?: string;
}

export function LogActivityDialog({
  contactId,
  contactName,
  organizationIds,
  onSuggestAdvance,
  currentStage,
}: LogActivityDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const [activity, setActivity] = useState("");
  const [type, setType] = useState<string | null>("meeting");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [loggedBy, setLoggedBy] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!activity.trim()) return;
    setSaving(true);

    try {
      await fetch("/crm/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity: activity.trim(),
          type: type ?? "other",
          contactIds: contactId ? [contactId] : [],
          organizationIds: organizationIds ?? [],
          date: date ? { start: date, end: null } : undefined,
          outcome: outcome ?? undefined,
          notes: notes.trim() || undefined,
          loggedBy: loggedBy.trim() || undefined,
        }),
      });

      // Check if we should suggest advancing the relationship stage
      if (
        outcome === "positive" &&
        onSuggestAdvance &&
        currentStage &&
        (currentStage === "stranger" || currentStage === "introduced")
      ) {
        const nextStage = currentStage === "stranger" ? "introduced" : "in conversation";
        onSuggestAdvance(nextStage);
      }

      // Reset form
      setActivity("");
      setType("meeting");
      setDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setOutcome(null);
      setLoggedBy("");
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors">
        <Plus className="h-4 w-4" />
        log activity
      </SheetTrigger>
      <SheetContent side="right" className="w-96">
        <SheetTitle>log activity{contactName ? ` — ${contactName}` : ""}</SheetTitle>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="mb-1.5 block">description</Label>
            <Input
              placeholder="coffee at BETT 2026..."
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">type</Label>
            <Select value={type ?? "meeting"} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">outcome</Label>
            <Select value={outcome ?? ""} onValueChange={setOutcome}>
              <SelectTrigger>
                <SelectValue placeholder="select outcome..." />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">notes</Label>
            <Textarea
              placeholder="details about the interaction..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">logged by</Label>
            <Select value={loggedBy || ""} onValueChange={(v) => setLoggedBy(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="who are you?" />
              </SelectTrigger>
              <SelectContent>
                {TEAM_MEMBERS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={!activity.trim() || saving} className="w-full">
            {saving ? "saving..." : "save activity"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
