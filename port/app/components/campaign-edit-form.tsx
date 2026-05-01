"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AudienceBuilderInline } from "@/app/components/audience-builder-inline";
import { AudienceList } from "@/app/components/audience-list";
import { StepCustomizer, type WizardStep } from "@/app/components/step-customizer";
import type {
  Campaign, CampaignStatus, CampaignType, CampaignStep, AudienceFilter,
} from "@/lib/notion/types";

interface CampaignEditFormProps {
  campaignId: string;
  campaign: Campaign;
  initialSteps: CampaignStep[];
}

/** Convert a persisted CampaignStep to the WizardStep shape StepCustomizer expects. */
function stepToWizard(s: CampaignStep): WizardStep {
  return {
    id: s.id, // reuse Notion ID — lets us distinguish persisted vs. new steps
    channel: s.channel ?? "email",
    subject: s.subject ?? "",
    body: s.body ?? "",
    delayDays: s.delayDays ?? 0,
    delayReference: "after previous step",
  };
}

export function CampaignEditForm({ campaignId, campaign, initialSteps }: CampaignEditFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Basic fields ─────────────────────────────────────────────────────────────
  const [name, setName] = useState(campaign.name ?? "");
  const [owner, setOwner] = useState(campaign.owner ?? "");
  const [status, setStatus] = useState<CampaignStatus>(campaign.status ?? "draft");
  const [type, setType] = useState<CampaignType>(campaign.type ?? "one-off blast");
  const [startDate, setStartDate] = useState(campaign.startDate?.start?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(campaign.endDate?.start?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(campaign.notes ?? "");

  // ── Audience ─────────────────────────────────────────────────────────────────
  // Strip the manual-override keys before passing to AudienceBuilderInline so
  // they don't appear as unknown filter chips.
  const {
    addedOrgIds: initialAdded = [],
    removedOrgIds: initialRemoved = [],
    addedContactIds: initialContacts = [],
    ...initialFilters
  } = campaign.audienceFilters ?? {};

  const [audienceFilters, setAudienceFilters] = useState<AudienceFilter>(initialFilters);
  const [addedOrgIds, setAddedOrgIds] = useState<string[]>(initialAdded);
  const [removedOrgIds, setRemovedOrgIds] = useState<string[]>(initialRemoved);
  const [addedContactIds, setAddedContactIds] = useState<string[]>(initialContacts);

  // ── Steps ────────────────────────────────────────────────────────────────────
  // stepIdMap tracks which WizardStep IDs map to persisted Notion IDs.
  // Persisted steps reuse their Notion ID as WizardStep.id, so the map is
  // initially an identity mapping. New (unsaved) steps get a fresh UUID.
  const [steps, setSteps] = useState<WizardStep[]>(initialSteps.map(stepToWizard));
  const [stepIdMap, setStepIdMap] = useState<Set<string>>(
    new Set(initialSteps.map((s) => s.id)),
  );

  // ── Save state ────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Step change handler ───────────────────────────────────────────────────────
  // StepCustomizer calls onChange with the full updated array. We diff against
  // the previous array to detect adds and removes and fire API calls immediately.
  function handleStepsChange(next: WizardStep[]) {
    const prevIds = new Set(steps.map((s) => s.id));
    const nextIds = new Set(next.map((s) => s.id));

    // Removed steps — fire DELETE immediately
    for (const id of prevIds) {
      if (!nextIds.has(id) && stepIdMap.has(id)) {
        fetch(`/api/campaign-steps/${id}`, { method: "DELETE" }).catch(() => {});
        setStepIdMap((prev) => {
          const m = new Set(prev);
          m.delete(id);
          return m;
        });
      }
    }

    // Added steps — fire POST immediately, then swap temp ID → real Notion ID
    for (const step of next) {
      if (!prevIds.has(step.id) && !stepIdMap.has(step.id)) {
        const tempId = step.id;
        fetch(`/api/campaigns/${campaignId}/steps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `step — ${step.channel}`,
            channel: step.channel,
            delayDays: step.delayDays,
            status: "draft",
          }),
        })
          .then((r) => r.json())
          .then((created: { id?: string }) => {
            if (!created.id) return;
            setSteps((prev) =>
              prev.map((s) => (s.id === tempId ? { ...s, id: created.id! } : s)),
            );
            setStepIdMap((prev) => new Set([...prev, created.id!]));
          })
          .catch(() => {});
      }
    }

    setSteps(next);
  }

  // ── Main save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");

    try {
      // 1. PATCH campaign (basic fields + audience)
      const campaignRes = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          owner: owner || undefined,
          status,
          type,
          startDate: startDate ? { start: startDate, end: null } : undefined,
          endDate: endDate ? { start: endDate, end: null } : undefined,
          notes: notes || undefined,
          audienceFilters: {
            ...audienceFilters,
            ...(addedOrgIds.length > 0 && { addedOrgIds }),
            ...(removedOrgIds.length > 0 && { removedOrgIds }),
            ...(addedContactIds.length > 0 && { addedContactIds }),
          },
        }),
      });
      if (!campaignRes.ok) {
        const d = await campaignRes.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "failed to save campaign");
      }

      // 2. PATCH each persisted step's content in parallel
      await Promise.all(
        steps
          .filter((s) => stepIdMap.has(s.id))
          .map((s, i) =>
            fetch(`/api/campaign-steps/${s.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                channel: s.channel,
                subject: s.subject || undefined,
                body: s.body || undefined,
                delayDays: s.delayDays,
                stepNumber: i + 1,
              }),
            }),
          ),
      );

      // 3. Navigate back to detail page
      startTransition(() => router.push(`/campaigns/${campaignId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-16">

      {/* ── Back nav ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => startTransition(() => router.push(`/campaigns/${campaignId}`))}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to campaign
      </button>

      {/* ── Section 1: Basic info ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">basic info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label className="mb-1.5 block">name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="campaign name"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">type</Label>
              <Select value={type} onValueChange={(v) => v && setType(v as CampaignType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-off blast">one-off blast</SelectItem>
                  <SelectItem value="recurring cadence">recurring cadence</SelectItem>
                  <SelectItem value="event-based">event-based</SelectItem>
                </SelectContent>
              </Select>
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
            <div>
              <Label className="mb-1.5 block">owner</Label>
              <Input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. Payton"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">start date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block">end date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="campaign notes..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Audience ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">audience</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <AudienceBuilderInline value={audienceFilters} onChange={setAudienceFilters} />
          <AudienceList
            filters={audienceFilters}
            addedIds={addedOrgIds}
            removedIds={removedOrgIds}
            onAddedChange={setAddedOrgIds}
            onRemovedChange={setRemovedOrgIds}
            addedContactIds={addedContactIds}
            onAddedContactsChange={setAddedContactIds}
          />
        </CardContent>
      </Card>

      {/* ── Section 3: Steps ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">steps</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            adding and removing steps takes effect immediately. subject, body, and delay changes save when you click save changes.
          </p>
          <StepCustomizer steps={steps} onChange={handleStepsChange} />
        </CardContent>
      </Card>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => startTransition(() => router.push(`/campaigns/${campaignId}`))}
          disabled={saving}
        >
          cancel
        </Button>
        <Button onClick={handleSave} disabled={!name.trim() || saving}>
          {saving ? "saving..." : "save changes"}
        </Button>
      </div>
    </div>
  );
}
