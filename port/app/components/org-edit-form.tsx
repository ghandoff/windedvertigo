"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  Organization, OrgCategory, Region, Quadrant,
} from "@/lib/notion/types";

// ── option lists ──────────────────────────────────────────

const CONNECTION_OPTIONS = [
  "unengaged", "exploring", "in progress", "collaborating", "champion", "steward", "past client",
] as const;

const TYPE_OPTIONS = [
  "ngo", "studio", "corporate", "non-profit", "foundation", "government",
  "individual donor", "consultancy/firm", "academic institution",
] as const;

const SOURCE_OPTIONS = [
  "cold research", "conference", "direct network", "partner referral", "rfp platform", "internal",
] as const;

const FIT_OPTIONS = [
  "🔥 Perfect fit", "✅ Strong fit", "🟡 Moderate fit",
] as const;

const HOW_THEY_BUY_OPTIONS = [
  "RFP/Tender", "Direct outreach", "Warm intro", "Conference", "Open call/Grant", "Subcontract",
] as const;

const CATEGORY_OPTIONS: OrgCategory[] = [
  "arts & culture", "community development", "corporate training", "education & learning",
  "healthcare & wellbeing", "international development", "social innovation",
  "sustainability & environment", "technology & innovation", "youth development",
];

const REGION_OPTIONS: Region[] = ["asia", "global", "europe", "north america", "africa"];

const QUADRANT_OPTIONS: Quadrant[] = [
  "Design + Deploy", "Pinpoint + Prove", "Build + Iterate", "Test + Validate",
];

// ── toggle chip ────────────────────────────────────────────

function ToggleChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

// ── tag input for freeform multi-values ────────────────────

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-muted-foreground hover:text-foreground leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? "type and press enter..."}
          className="h-8 text-xs"
        />
        <Button type="button" size="sm" variant="outline" onClick={add} className="h-8 text-xs px-3">
          add
        </Button>
      </div>
    </div>
  );
}

// ── section wrapper ────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// ── main form ─────────────────────────────────────────────

interface OrgEditFormProps {
  org: Organization;
}

export function OrgEditForm({ org }: OrgEditFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  // Identity
  const [name, setName] = useState(org.organization ?? "");
  const [email, setEmail] = useState(org.email ?? "");
  const [website, setWebsite] = useState(org.website ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(org.linkedinUrl ?? "");
  const [logo, setLogo] = useState(org.logo ?? "");
  const [description, setDescription] = useState(org.description ?? "");

  // Status (typed as string so Base UI's nullable onValueChange is compatible)
  // connection still drives the Notion status property; relationship + priority are derived
  const [connection, setConnection] = useState<string>(org.connection ?? "");
  const [fitRating, setFitRating] = useState<string>(org.fitRating ?? "");

  // Classification
  const [type, setType] = useState<string>(org.type ?? "");
  const [source, setSource] = useState<string>(org.source ?? "");
  const [category, setCategory] = useState<OrgCategory[]>(org.category ?? []);
  const [regions, setRegions] = useState<Region[]>(org.regions ?? []);

  // Positioning
  const [quadrant, setQuadrant] = useState<string>(org.quadrant ?? "");
  const [crossQuadrant, setCrossQuadrant] = useState<Quadrant[]>(org.crossQuadrant ?? []);
  const [marketSegment, setMarketSegment] = useState(org.marketSegment ?? "");
  const [serviceLine, setServiceLine] = useState<string[]>(org.serviceLine ?? []);

  // Buying context
  const [howTheyBuy, setHowTheyBuy] = useState<string>(org.howTheyBuy ?? "");
  const [buyerRole, setBuyerRole] = useState(org.buyerRole ?? "");
  const [buyingTrigger, setBuyingTrigger] = useState(org.buyingTrigger ?? "");
  const [targetServices, setTargetServices] = useState(org.targetServices ?? "");
  const [outreachTarget, setOutreachTarget] = useState(org.outreachTarget ?? "");
  const [subject, setSubject] = useState(org.subject ?? "");

  // Outreach content
  const [bespokeEmailCopy, setBespokeEmailCopy] = useState(org.bespokeEmailCopy ?? "");
  const [outreachSuggestion, setOutreachSuggestion] = useState(org.outreachSuggestion ?? "");
  const [notes, setNotes] = useState(org.notes ?? "");

  function toggleMulti<T extends string>(arr: T[], item: T, set: (v: T[]) => void) {
    set(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization: name || undefined,
          email: email || undefined,
          website: website || undefined,
          linkedinUrl: linkedinUrl || undefined,
          logo: logo || undefined,
          description: description || undefined,
          connection: connection || undefined,
          fitRating: fitRating || undefined,
          type: type || undefined,
          source: source || undefined,
          category: category.length ? category : undefined,
          regions: regions.length ? regions : undefined,
          quadrant: quadrant || undefined,
          crossQuadrant: crossQuadrant.length ? crossQuadrant : undefined,
          marketSegment: marketSegment || undefined,
          serviceLine: serviceLine.length ? serviceLine : undefined,
          howTheyBuy: howTheyBuy || undefined,
          buyerRole: buyerRole || undefined,
          buyingTrigger: buyingTrigger || undefined,
          targetServices: targetServices || undefined,
          outreachTarget: outreachTarget || undefined,
          subject: subject || undefined,
          bespokeEmailCopy: bespokeEmailCopy || undefined,
          outreachSuggestion: outreachSuggestion || undefined,
          notes: notes || undefined,
        }),
      });
      startTransition(() => router.push(`/organizations/${org.id}`));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => startTransition(() => router.push(`/organizations/${org.id}`))}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          back to {org.organization}
        </button>
        <Button onClick={handleSave} disabled={!name.trim() || saving} size="sm" className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving ? "saving..." : "save changes"}
        </Button>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{name || "edit organisation"}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">

          {/* Identity */}
          <Section title="identity">
            <Field label="name *">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Organisation name" />
            </Field>
            <Field label="email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@org.com" />
            </Field>
            <Field label="website">
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="linkedin url">
              <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/company/..." />
            </Field>
            <Field label="logo url">
              <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="description">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="brief description of the organisation..." className="text-sm" />
            </Field>
          </Section>

          {/* Relationship status */}
          <Section title="relationship">
            <Field label="connection stage">
              <Select value={connection} onValueChange={(v) => setConnection(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="select..." /></SelectTrigger>
                <SelectContent>
                  {CONNECTION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="fit rating">
              <Select value={fitRating} onValueChange={(v) => setFitRating(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="select..." /></SelectTrigger>
                <SelectContent>
                  {FIT_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="col-span-2 text-xs text-muted-foreground border rounded-md p-3 bg-muted/30">
              <span className="font-medium text-foreground">derived fields</span>
              <div className="mt-1 flex gap-4">
                <span>relationship: <strong className="text-foreground">{org.relationship}</strong></span>
                <span>priority: <strong className="text-foreground">{org.derivedPriority}</strong></span>
              </div>
              <p className="mt-1 text-[10px]">
                relationship is computed from connection stage. priority is computed from fit × relationship.
              </p>
            </div>
          </Section>

          {/* Buying context */}
          <Section title="buying context">
            <Field label="how they buy">
              <Select value={howTheyBuy} onValueChange={(v) => setHowTheyBuy(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="select..." /></SelectTrigger>
                <SelectContent>
                  {HOW_THEY_BUY_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="buyer role">
              <Input value={buyerRole} onChange={(e) => setBuyerRole(e.target.value)} placeholder="e.g. head of learning, program director..." />
            </Field>
            <Field label="buying trigger">
              <Textarea value={buyingTrigger} onChange={(e) => setBuyingTrigger(e.target.value)} rows={2} placeholder="what prompts them to buy..." className="text-sm" />
            </Field>
            <Field label="target services">
              <Textarea value={targetServices} onChange={(e) => setTargetServices(e.target.value)} rows={2} placeholder="which of our services fit..." className="text-sm" />
            </Field>
            <Field label="outreach target">
              <Input value={outreachTarget} onChange={(e) => setOutreachTarget(e.target.value)} placeholder="name / role to reach..." />
            </Field>
            <Field label="subject line">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="default email subject for this org..." />
            </Field>
          </Section>

        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Classification */}
          <Section title="classification">
            <Field label="type">
              <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="select..." /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="source">
              <Select value={source} onValueChange={(v) => setSource(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="select..." /></SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="categories">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_OPTIONS.map((c) => (
                  <ToggleChip
                    key={c}
                    label={c}
                    selected={category.includes(c)}
                    onToggle={() => toggleMulti(category, c, setCategory)}
                  />
                ))}
              </div>
            </Field>
            <Field label="regions">
              <div className="flex flex-wrap gap-1.5">
                {REGION_OPTIONS.map((r) => (
                  <ToggleChip
                    key={r}
                    label={r}
                    selected={regions.includes(r)}
                    onToggle={() => toggleMulti(regions, r, setRegions)}
                  />
                ))}
              </div>
            </Field>
          </Section>

          {/* Positioning */}
          <Section title="positioning">
            <Field label="primary quadrant">
              <Select value={quadrant} onValueChange={(v) => setQuadrant(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="select..." /></SelectTrigger>
                <SelectContent>
                  {QUADRANT_OPTIONS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="cross-quadrant">
              <div className="flex flex-wrap gap-1.5">
                {QUADRANT_OPTIONS.map((q) => (
                  <ToggleChip
                    key={q}
                    label={q}
                    selected={crossQuadrant.includes(q)}
                    onToggle={() => toggleMulti(crossQuadrant, q, setCrossQuadrant)}
                  />
                ))}
              </div>
            </Field>
            <Field label="market segment">
              <Input value={marketSegment} onChange={(e) => setMarketSegment(e.target.value)} placeholder="e.g. higher ed, corporate L&D..." />
            </Field>
            <Field label="service lines">
              <TagInput values={serviceLine} onChange={setServiceLine} placeholder="type a service line and press enter..." />
            </Field>
          </Section>

          {/* Outreach content */}
          <Section title="outreach content">
            <Field label="bespoke email copy">
              <Textarea
                value={bespokeEmailCopy}
                onChange={(e) => setBespokeEmailCopy(e.target.value)}
                rows={5}
                placeholder="custom copy for this org — resolves as {{bespokeEmailCopy}} in campaign templates..."
                className="text-sm"
              />
            </Field>
            <Field label="outreach suggestion">
              <Textarea
                value={outreachSuggestion}
                onChange={(e) => setOutreachSuggestion(e.target.value)}
                rows={3}
                placeholder="AI-generated or manual outreach angle..."
                className="text-sm"
              />
            </Field>
            <Field label="notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="context, history, open threads..."
                className="text-sm"
              />
            </Field>
          </Section>

        </div>
      </div>

      {/* Bottom save */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={!name.trim() || saving} className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving ? "saving..." : "save changes"}
        </Button>
      </div>
    </div>
  );
}
