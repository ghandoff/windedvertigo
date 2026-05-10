"use client";

/**
 * event-retro-modal.tsx — post-event retrospective modal.
 *
 * A passive "add retro →" link that appears on gallery tiles where
 * `lifecycle_state === 'past'` AND the retro hasn't been filed yet
 * (outcome_notes is null or contacts_met_count is null).
 *
 * On open: fetches /api/event-contacts?eventId=... to count "met" rows,
 * pre-fills contactsMetCount (editable).
 *
 * On submit: PATCH /api/events/{id} with { outcomeNotes, contactsMetCount, followupDueBy }.
 *
 * Phase 15 of the conference intelligence pipeline.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, NotebookPen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  eventId: string;
  eventName: string;
  /** Pre-filled from server if already set. */
  existingOutcomeNotes?: string | null;
  existingContactsMetCount?: number | null;
  existingFollowupDueBy?: string | null;
}

export function EventRetroModal({
  eventId,
  eventName,
  existingOutcomeNotes,
  existingContactsMetCount,
  existingFollowupDueBy,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingMet, setLoadingMet] = useState(false);

  const [outcomeNotes, setOutcomeNotes] = useState(existingOutcomeNotes ?? "");
  const [contactsMetCount, setContactsMetCount] = useState<number | "">(
    existingContactsMetCount ?? "",
  );
  const [followupDueBy, setFollowupDueBy] = useState(existingFollowupDueBy ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // When modal opens, prefetch the "met" count from event-contacts API
  // and pre-fill the field if not already set.
  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;

    if (existingContactsMetCount === null || existingContactsMetCount === undefined) {
      setLoadingMet(true);
      try {
        const res = await fetch(
          `/api/event-contacts?eventId=${encodeURIComponent(eventId)}`,
        );
        if (res.ok) {
          const json = await res.json() as { contacts: Array<{ status: string }> };
          const metCount = (json.contacts ?? []).filter((c) => c.status === "met").length;
          if (metCount > 0) setContactsMetCount(metCount);
        }
      } catch {
        // silently ignore — the field stays blank for manual entry
      } finally {
        setLoadingMet(false);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcomeNotes: outcomeNotes.trim() || null,
          contactsMetCount: contactsMetCount === "" ? null : Number(contactsMetCount),
          followupDueBy: followupDueBy || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `server error ${res.status}`);
      }

      setSaved(true);
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setSaved(false);
      }, 1200);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "failed to save");
    } finally {
      setSaving(false);
    }
  }

  const alreadyFiled = !!(existingOutcomeNotes || existingContactsMetCount !== null);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <NotebookPen className="h-3 w-3" />
        {alreadyFiled ? "edit retro →" : "add retro →"}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-left">
            post-event retro
          </DialogTitle>
          <p className="text-xs text-muted-foreground text-left leading-relaxed">
            {eventName}
          </p>
        </DialogHeader>

        {saved ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            ✓ retro saved
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Outcome notes */}
            <div className="space-y-1.5">
              <Label htmlFor="retro-outcome" className="text-sm">
                outcome notes
              </Label>
              <Textarea
                id="retro-outcome"
                placeholder="What happened? Key connections made, opportunities identified, lessons learned…"
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
                rows={4}
                disabled={saving}
              />
            </div>

            {/* Contacts met count */}
            <div className="space-y-1.5">
              <Label htmlFor="retro-contacts" className="text-sm">
                contacts met
                {loadingMet && (
                  <Loader2 className="h-3 w-3 animate-spin inline ml-1.5" />
                )}
              </Label>
              <Input
                id="retro-contacts"
                type="number"
                min={0}
                placeholder="0"
                value={contactsMetCount}
                onChange={(e) =>
                  setContactsMetCount(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={saving || loadingMet}
                className="w-28"
              />
              <p className="text-[10px] text-muted-foreground">
                pre-filled from your tracked contacts when available
              </p>
            </div>

            {/* Follow-up due date */}
            <div className="space-y-1.5">
              <Label htmlFor="retro-followup" className="text-sm">
                follow-up due by
              </Label>
              <Input
                id="retro-followup"
                type="date"
                value={followupDueBy}
                onChange={(e) => setFollowupDueBy(e.target.value)}
                disabled={saving}
                className="w-44"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-destructive">{errorMsg}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    saving…
                  </>
                ) : (
                  "save retro"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
