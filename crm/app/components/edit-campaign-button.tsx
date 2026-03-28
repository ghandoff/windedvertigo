"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Campaign, CampaignStatus } from "@/lib/notion/types";

interface EditCampaignButtonProps {
  campaign: Campaign;
}

export function EditCampaignButton({ campaign }: EditCampaignButtonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state initialised from campaign
  const [name, setName] = useState(campaign.name);
  const [owner, setOwner] = useState(campaign.owner ?? "");
  const [status, setStatus] = useState<CampaignStatus>(campaign.status ?? "draft");
  const [startDate, setStartDate] = useState(campaign.startDate?.start?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(campaign.endDate?.start?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(campaign.notes ?? "");

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          owner: owner || undefined,
          status,
          startDate: startDate ? { start: startDate, end: null } : undefined,
          endDate: endDate ? { start: endDate, end: null } : undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Save failed");
      }
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" />
        edit
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-96">
          <SheetTitle>edit campaign</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Update campaign details and settings.
          </SheetDescription>
          <div className="mt-6 space-y-4">
            <div>
              <Label className="mb-1.5 block">name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" />
            </div>
            <div>
              <Label className="mb-1.5 block">owner</Label>
              <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. Payton" />
            </div>
            <div>
              <Label className="mb-1.5 block">status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v as CampaignStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">draft</SelectItem>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="paused">paused</SelectItem>
                  <SelectItem value="complete">complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">end date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Campaign notes..."
                rows={3}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button onClick={handleSave} disabled={!name.trim() || saving} className="w-full">
              {saving ? "saving..." : "save changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
