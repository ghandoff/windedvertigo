"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BlueprintPicker } from "./blueprint-picker";
import { StepCustomizer, type WizardStep } from "./step-customizer";
import { AudienceBuilderInline } from "./audience-builder-inline";
import { AudienceList } from "./audience-list";
import { LaunchChecklist } from "./launch-checklist";
import { CampaignTutorial, TutorialToggle, useTutorial } from "./campaign-tutorial";
import { useMembers } from "@/lib/pwa/use-members";
import type { Blueprint, StepChannel, AudienceFilter } from "@/lib/notion/types";

const CHANNELS: { key: StepChannel; label: string }[] = [
  { key: "email", label: "email" },
  { key: "linkedin", label: "linkedin" },
  { key: "twitter", label: "twitter / X" },
  { key: "bluesky", label: "bluesky" },
];

const CAMPAIGN_TYPES = [
  { key: "event-based", label: "event-based", desc: "timed around a specific event" },
  { key: "recurring cadence", label: "recurring cadence", desc: "regular outreach rhythm" },
  { key: "one-off blast", label: "one-off blast", desc: "single targeted send" },
] as const;

type WizardStepNum = 1 | 2 | 3 | 4 | 5;

interface CampaignWizardProps {
  preselectedTemplateId?: string;
}

export function CampaignWizard({ preselectedTemplateId }: CampaignWizardProps) {
  const router = useRouter();
  const members = useMembers();
  const [, startTransition] = useTransition();
  const { enabled: tutorialEnabled, toggle: toggleTutorial } = useTutorial();

  // Load preselected template and skip to step 3 (audience)
  useEffect(() => {
    if (!preselectedTemplateId) return;
    fetch(`/api/email-templates/${preselectedTemplateId}`)
      .then((r) => r.json())
      .then((tpl) => {
        if (!tpl.id) return;
        const channel = tpl.channel || "email";
        setSelectedChannels([channel as StepChannel]);
        setSteps([{
          id: crypto.randomUUID(),
          channel: channel as StepChannel,
          subject: tpl.subject || "",
          body: tpl.body || "",
          delayDays: 0,
          delayReference: "after previous step",
          templateName: tpl.name,
        }]);
        // Skip to audience step (channels + blueprint already set via template)
        setCurrentStep(3);
      })
      .catch(() => {});
  }, [preselectedTemplateId]);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStepNum>(1);

  // Step 1: channels + type
  const [selectedChannels, setSelectedChannels] = useState<StepChannel[]>(["email"]);
  const [campaignType, setCampaignType] = useState("one-off blast");

  // Step 2: blueprint
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);

  // Step 3: audience
  const [audienceFilters, setAudienceFilters] = useState<AudienceFilter>({});
  const [audienceOrgCount, setAudienceOrgCount] = useState(0);
  const [audienceContactCount, setAudienceContactCount] = useState(0);
  const [addedOrgIds, setAddedOrgIds] = useState<string[]>([]);
  const [removedOrgIds, setRemovedOrgIds] = useState<string[]>([]);
  const [addedContactIds, setAddedContactIds] = useState<string[]>([]);

  // Step 4: steps
  const [steps, setSteps] = useState<WizardStep[]>([]);

  // Step 5: review
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [startDate, setStartDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  function toggleChannel(ch: StepChannel) {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  }

  async function handleBlueprintSelect(bp: Blueprint) {
    setSelectedBlueprint(bp);
    setCampaignType(
      bp.category === "event-based" ? "event-based" :
      bp.category === "nurture" ? "recurring cadence" : "one-off blast"
    );

    // Fetch blueprint steps with template content
    try {
      const res = await fetch(`/api/blueprints/${bp.id}/steps`);
      const data = await res.json();
      const bpSteps = (data.data ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) => ({
          id: crypto.randomUUID(),
          channel: s.channel ?? "email",
          subject: s.template?.subject ?? "",
          body: s.template?.body ?? "",
          delayDays: s.delayDays ?? 0,
          delayReference: s.delayReference ?? "after previous step",
          templateName: s.template?.name ?? s.name,
        }),
      );
      setSteps(bpSteps);
    } catch {
      setSteps([]);
    }

    setCurrentStep(3);
  }

  function handleCustom() {
    setSelectedBlueprint(null);
    setSteps([{
      id: crypto.randomUUID(),
      channel: selectedChannels[0] ?? "email",
      subject: "",
      body: "",
      delayDays: 0,
      delayReference: "after previous step",
    }]);
    setCurrentStep(3);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);

    try {
      // 1. Create campaign
      const campaignRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: campaignType,
          status: "draft",
          owner: owner || undefined,
          audienceFilters,
          startDate: startDate ? { start: startDate, end: null } : undefined,
        }),
      });
      const campaign = await campaignRes.json();
      if (!campaign.id) throw new Error("failed to create campaign");

      // 2. Create steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await fetch(`/api/campaigns/${campaign.id}/steps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `step ${i + 1} — ${step.channel}`,
            stepNumber: i + 1,
            channel: step.channel,
            subject: step.subject || undefined,
            body: step.body || undefined,
            delayDays: step.delayDays,
            status: "draft",
          }),
        });
      }

      // 3. Redirect to campaign detail
      startTransition(() => router.push(`/campaigns/${campaign.id}`));
    } catch (err) {
      console.error("campaign creation failed:", err);
      setCreateError(err instanceof Error ? err.message : "campaign creation failed — try again");
      setCreating(false);
    }
  }

  const stepLabels = ["channels", "blueprint", "audience", "steps", "review"];

  return (
    <div className="max-w-2xl">
      {/* Progress bar + tutorial toggle */}
      <div className="flex items-center gap-2 mb-2">
        <TutorialToggle enabled={tutorialEnabled} onToggle={toggleTutorial} />
      </div>
      <div className="flex items-center gap-2 mb-6">
        {stepLabels.map((label, i) => {
          const num = (i + 1) as WizardStepNum;
          const isActive = num === currentStep;
          const isDone = num < currentStep;
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                  isDone ? "bg-accent text-white" :
                  isActive ? "bg-accent/20 text-accent border border-accent" :
                  "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : num}
              </div>
              <span className={`text-xs hidden sm:block ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
              {i < stepLabels.length - 1 && (
                <div className={`h-px flex-1 ${isDone ? "bg-accent" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Channels + Type */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <CampaignTutorial step={1} enabled={tutorialEnabled} />
          <div>
            <h2 className="text-lg font-semibold mb-1">what channels will this campaign use?</h2>
            <p className="text-sm text-muted-foreground mb-4">select one or more</p>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.key}
                  onClick={() => toggleChannel(ch.key)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    selectedChannels.includes(ch.key)
                      ? "bg-accent/10 border-accent text-accent"
                      : "bg-muted/50 border-border text-muted-foreground hover:border-accent/50"
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-1">what kind of campaign?</h2>
            <div className="space-y-2">
              {CAMPAIGN_TYPES.map((t) => (
                <label
                  key={t.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    campaignType === t.key
                      ? "bg-accent/10 border-accent"
                      : "hover:border-accent/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t.key}
                    checked={campaignType === t.key}
                    onChange={() => setCampaignType(t.key)}
                    className="accent-accent"
                  />
                  <div>
                    <span className="text-sm font-medium">{t.label}</span>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={() => setCurrentStep(2)} disabled={selectedChannels.length === 0}>
            next <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      )}

      {/* Step 2: Blueprint */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <CampaignTutorial step={2} enabled={tutorialEnabled} />
          <h2 className="text-lg font-semibold">choose a blueprint</h2>
          <BlueprintPicker
            selectedChannels={selectedChannels}
            onSelect={handleBlueprintSelect}
            onCustom={handleCustom}
          />
          <Button variant="outline" onClick={() => setCurrentStep(1)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> back
          </Button>
        </div>
      )}

      {/* Step 3: Audience */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <CampaignTutorial step={3} enabled={tutorialEnabled} />
          <h2 className="text-lg font-semibold">target audience</h2>
          <AudienceBuilderInline
            value={audienceFilters}
            onChange={(f) => {
              setAudienceFilters(f);
              setRemovedOrgIds([]);
            }}
          />

          {/* Full audience list with add/remove orgs + contacts */}
          <AudienceList
            filters={audienceFilters}
            addedIds={addedOrgIds}
            removedIds={removedOrgIds}
            onAddedChange={setAddedOrgIds}
            onRemovedChange={setRemovedOrgIds}
            addedContactIds={addedContactIds}
            onAddedContactsChange={setAddedContactIds}
            onCountChange={(orgs, contacts) => {
              setAudienceOrgCount(orgs);
              setAudienceContactCount(contacts);
            }}
          />

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> back
            </Button>
            <Button onClick={() => setCurrentStep(4)}>
              next ({audienceOrgCount} orgs
              {audienceContactCount > 0 && ` · ${audienceContactCount} contacts`}
              {addedContactIds.length > 0 && ` · ${addedContactIds.length} individual`})
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Customize Steps */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <CampaignTutorial step={4} enabled={tutorialEnabled} />
          <h2 className="text-lg font-semibold">
            campaign steps
            {selectedBlueprint && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                from {selectedBlueprint.name}
              </span>
            )}
          </h2>
          <StepCustomizer steps={steps} onChange={setSteps} />
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(3)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> back
            </Button>
            <Button onClick={() => setCurrentStep(5)} disabled={steps.length === 0}>
              review <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Review + Create */}
      {currentStep === 5 && (
        <div className="space-y-4">
          <CampaignTutorial step={5} enabled={tutorialEnabled} />
          <h2 className="text-lg font-semibold">review & create</h2>

          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block">campaign name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., BETT 2026 outreach"
                autoFocus
              />
            </div>
            <div>
              <Label className="mb-1.5 block">owner</Label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">select owner...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.firstName}>{m.firstName}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block">start date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          {/* Launch checklist gate */}
          <LaunchChecklist
            name={name}
            campaignType={campaignType}
            selectedChannels={selectedChannels}
            blueprintName={selectedBlueprint?.name}
            audienceFilters={audienceFilters}
            audienceCount={audienceOrgCount}
            addedCount={addedOrgIds.length}
            removedCount={removedOrgIds.length}
            stepCount={steps.length}
            steps={steps.map((s) => ({ channel: s.channel, subject: s.subject, body: s.body }))}
            owner={owner}
            startDate={startDate}
          />

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(4)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> back
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || steps.length === 0 || creating}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  creating...
                </>
              ) : (
                "create campaign"
              )}
            </Button>
            {createError && (
              <p className="text-xs text-destructive mt-2">{createError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
