"use client";

import { useState, useTransition, useRef, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RfpPasteTor } from "@/app/components/rfp-paste-tor";
import type {
  RfpOpportunity, RfpStatus, OpportunityType, WvFitScore, RfpSource, RfpServiceMatch,
} from "@/lib/notion/types";

const SERVICE_MATCH_OPTIONS: RfpServiceMatch[] = [
  "MEL & Evaluation",
  "Curriculum Design",
  "Play-Based Learning",
  "Professional Learning & PD",
  "Learning Design",
  "Assessment & Research",
  "Facilitation",
  "Dashboards & Tech",
  "Strategic Planning",
];

interface Props {
  rfpId: string;
  rfp: RfpOpportunity;
}

/** Minimal inline tag input — pill display + Enter/comma to add. */
function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [inputVal, setInputVal] = useState("");

  function add(raw: string) {
    const trimmed = raw.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInputVal("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(inputVal);
    } else if (e.key === "Backspace" && !inputVal && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="text-xs gap-1">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="hover:text-destructive"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (inputVal.trim()) add(inputVal); }}
        placeholder={placeholder ?? "type and press Enter to add"}
        className="text-sm"
      />
    </div>
  );
}

export function RfpEditForm({ rfpId, rfp }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Field state ─────────────────────────────────────────────────────────────
  const [opportunityName, setOpportunityName] = useState(rfp.opportunityName ?? "");
  const [status, setStatus] = useState<RfpStatus>(rfp.status ?? "radar");
  const [opportunityType, setOpportunityType] = useState<OpportunityType | "">(rfp.opportunityType ?? "");
  const [dueDate, setDueDate] = useState(rfp.dueDate?.start?.slice(0, 10) ?? "");
  const [estimatedValue, setEstimatedValue] = useState(
    rfp.estimatedValue != null ? String(rfp.estimatedValue) : "",
  );
  const [wvFitScore, setWvFitScore] = useState<WvFitScore | "">(rfp.wvFitScore ?? "");
  const [serviceMatch, setServiceMatch] = useState<RfpServiceMatch[]>(rfp.serviceMatch ?? []);
  const [category, setCategory] = useState<string[]>(rfp.category ?? []);
  const [geography, setGeography] = useState<string[]>(rfp.geography ?? []);
  const [source, setSource] = useState<RfpSource | "">(rfp.source ?? "");
  const [url, setUrl] = useState(rfp.url ?? "");
  const [requirementsSnapshot, setRequirementsSnapshot] = useState(rfp.requirementsSnapshot ?? "");
  const [decisionNotes, setDecisionNotes] = useState(rfp.decisionNotes ?? "");
  // debrief fields (shown when status is won/lost/no-go)
  const [whatWorked, setWhatWorked] = useState(rfp.whatWorked ?? "");
  const [whatFellFlat, setWhatFellFlat] = useState(rfp.whatFellFlat ?? "");
  const [clientFeedback, setClientFeedback] = useState(rfp.clientFeedback ?? "");
  const [lessonsForNextTime, setLessonsForNextTime] = useState(rfp.lessonsForNextTime ?? "");
  const [proposalNotes, setProposalNotes] = useState(rfp.proposalNotes ?? "");
  // delta capture — track initial value to detect human edits to AI-generated content
  const initialSnapshotRef = useRef(rfp.requirementsSnapshot ?? "");

  // ── Save state ───────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleService(s: RfpServiceMatch) {
    setServiceMatch((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  async function handleSave() {
    if (!opportunityName.trim()) return;
    setSaving(true);
    setError("");

    // Delta capture: if the requirements snapshot was edited, append a log entry to proposalNotes
    const snapshotChanged = requirementsSnapshot !== initialSnapshotRef.current;
    let finalProposalNotes = proposalNotes;
    if (snapshotChanged) {
      const timestamp = new Date().toISOString().slice(0, 10);
      const entry = `[${timestamp}] requirements snapshot edited by human`;
      finalProposalNotes = proposalNotes ? `${proposalNotes}\n\n${entry}` : entry;
      setProposalNotes(finalProposalNotes);
      // Update baseline so a second save without changes doesn't re-append
      initialSnapshotRef.current = requirementsSnapshot;
    }

    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityName: opportunityName.trim(),
          status,
          ...(opportunityType && { opportunityType }),
          ...(dueDate && { dueDate: { start: dueDate, end: null } }),
          ...(estimatedValue && { estimatedValue: parseInt(estimatedValue, 10) }),
          ...(wvFitScore && { wvFitScore }),
          serviceMatch,
          category,
          geography,
          ...(source && { source }),
          url: url || undefined,
          requirementsSnapshot: requirementsSnapshot || undefined,
          decisionNotes: decisionNotes || undefined,
          whatWorked: whatWorked || undefined,
          whatFellFlat: whatFellFlat || undefined,
          clientFeedback: clientFeedback || undefined,
          lessonsForNextTime: lessonsForNextTime || undefined,
          proposalNotes: finalProposalNotes || undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "save failed");
      }

      startTransition(() => router.push(`/rfp-radar/${rfpId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-16">

      {/* Back nav */}
      <button
        type="button"
        onClick={() => startTransition(() => router.push(`/rfp-radar/${rfpId}`))}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to opportunity
      </button>

      {/* ── Section 1: Core fields ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">core details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5 block">opportunity name</Label>
            <Input
              value={opportunityName}
              onChange={(e) => setOpportunityName(e.target.value)}
              placeholder="opportunity name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v as RfpStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="radar">radar</SelectItem>
                  <SelectItem value="reviewing">reviewing</SelectItem>
                  <SelectItem value="pursuing">pursuing</SelectItem>
                  <SelectItem value="interviewing">interviewing</SelectItem>
                  <SelectItem value="submitted">submitted</SelectItem>
                  <SelectItem value="won">won</SelectItem>
                  <SelectItem value="lost">lost</SelectItem>
                  <SelectItem value="no-go">no-go</SelectItem>
                  <SelectItem value="missed deadline">missed deadline</SelectItem>
                </SelectContent>
              </Select>
              {status === "pursuing" && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  ⚡ moving to pursuing will trigger proposal generation
                </p>
              )}
            </div>

            <div>
              <Label className="mb-1.5 block">opportunity type</Label>
              <Select
                value={opportunityType}
                onValueChange={(v) => v && setOpportunityType(v as OpportunityType)}
              >
                <SelectTrigger><SelectValue placeholder="select type…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RFP">RFP</SelectItem>
                  <SelectItem value="RFQ">RFQ</SelectItem>
                  <SelectItem value="RFI">RFI</SelectItem>
                  <SelectItem value="Grant">Grant</SelectItem>
                  <SelectItem value="EOI">EOI</SelectItem>
                  <SelectItem value="Cold Lead">Cold Lead</SelectItem>
                  <SelectItem value="Warm Intro">Warm Intro</SelectItem>
                  <SelectItem value="Conference Contact">Conference Contact</SelectItem>
                  <SelectItem value="Direct Outreach">Direct Outreach</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div>
              <Label className="mb-1.5 block">estimated value (USD)</Label>
              <Input
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="e.g. 150000"
              />
            </div>

            <div>
              <Label className="mb-1.5 block">w.v fit score</Label>
              <Select
                value={wvFitScore}
                onValueChange={(v) => v && setWvFitScore(v as WvFitScore)}
              >
                <SelectTrigger><SelectValue placeholder="select fit…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high fit">high fit</SelectItem>
                  <SelectItem value="medium fit">medium fit</SelectItem>
                  <SelectItem value="low fit">low fit</SelectItem>
                  <SelectItem value="TBD">TBD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">source</Label>
              <Select
                value={source}
                onValueChange={(v) => v && setSource(v as RfpSource)}
              >
                <SelectTrigger><SelectValue placeholder="select source…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RFP Platform">RFP Platform</SelectItem>
                  <SelectItem value="Google Alert">Google Alert</SelectItem>
                  <SelectItem value="RSS Feed">RSS Feed</SelectItem>
                  <SelectItem value="Cold Research">Cold Research</SelectItem>
                  <SelectItem value="Conference">Conference</SelectItem>
                  <SelectItem value="Direct Network">Direct Network</SelectItem>
                  <SelectItem value="Partner Referral">Partner Referral</SelectItem>
                  <SelectItem value="Email Alert">Email Alert</SelectItem>
                  <SelectItem value="Manual Entry">Manual Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">source URL</Label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Service match ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">service match</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {SERVICE_MATCH_OPTIONS.map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 text-sm cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={serviceMatch.includes(s)}
                  onChange={() => toggleService(s)}
                  className="rounded border-border"
                />
                {s}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Tags ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TagInput
            label="category"
            values={category}
            onChange={setCategory}
            placeholder="e.g. Education — press Enter to add"
          />
          <TagInput
            label="geography"
            values={geography}
            onChange={setGeography}
            placeholder="e.g. Sub-Saharan Africa — press Enter to add"
          />
        </CardContent>
      </Card>

      {/* ── Section 4: Notes ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1.5 block">requirements snapshot</Label>
            <Textarea
              value={requirementsSnapshot}
              onChange={(e) => setRequirementsSnapshot(e.target.value)}
              placeholder="Describe what work is being procured, key objectives, scope, and deliverables…"
              rows={6}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">decision notes</Label>
            <Textarea
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              placeholder="Internal notes on bid/no-bid decision, strategy, context…"
              rows={4}
            />
          </div>

          {/* Paste-TOR-as-file: for cases where the TOR lives in an email
              body or page copy rather than a downloadable PDF. Saves to R2
              as a .txt and attaches to the RFP via the same paste endpoint. */}
          <div className="pt-2 border-t border-border/40">
            <RfpPasteTor rfpId={rfpId} />
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Debrief (won / lost / no-go only) ────────────────────── */}
      {(status === "won" || status === "lost" || status === "no-go") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">debrief</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1.5 block">what worked</Label>
              <Textarea
                value={whatWorked}
                onChange={(e) => setWhatWorked(e.target.value)}
                placeholder="What did we do well? What landed with the client?"
                rows={3}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">what fell flat</Label>
              <Textarea
                value={whatFellFlat}
                onChange={(e) => setWhatFellFlat(e.target.value)}
                placeholder="What missed the mark? Pricing, scope, team, narrative?"
                rows={3}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">client feedback</Label>
              <Textarea
                value={clientFeedback}
                onChange={(e) => setClientFeedback(e.target.value)}
                placeholder="Any direct feedback from the client or evaluation committee…"
                rows={3}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">lessons for next time</Label>
              <Textarea
                value={lessonsForNextTime}
                onChange={(e) => setLessonsForNextTime(e.target.value)}
                placeholder="What would we do differently? What should feed into the next proposal?"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 6: Proposal notes (delta log) ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">proposal notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={proposalNotes}
            onChange={(e) => setProposalNotes(e.target.value)}
            placeholder="Internal notes on this proposal — edits, decisions, delta log…"
            rows={4}
          />
          <p className="text-[10px] text-muted-foreground mt-1.5">
            changes to the requirements snapshot are logged here automatically.
          </p>
        </CardContent>
      </Card>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          type="button"
          onClick={() => startTransition(() => router.push(`/rfp-radar/${rfpId}`))}
          disabled={saving}
        >
          cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!opportunityName.trim() || saving}
        >
          {saving ? "saving…" : "save changes"}
        </Button>
      </div>
    </div>
  );
}
