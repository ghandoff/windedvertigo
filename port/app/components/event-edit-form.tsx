"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CrmEvent } from "@/lib/notion/types";

const TYPE_OPTIONS = [
  "Conference", "Summit", "Trade Show", "Academic Conference", "Awards / Ceremony", "Network Event",
] as const;

const FREQUENCY_OPTIONS = ["Annual", "Biannual", "Quarterly", "One-off"] as const;

const QUADRANT_OPTIONS = [
  "Design + Deploy", "Pinpoint + Prove", "Build + Iterate", "Test + Validate",
] as const;

const TEAM_OPTIONS = ["Garrett", "María", "Jamie", "Lamis", "Yigal"] as const;

function ToggleChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
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

interface EventEditFormProps {
  event?: CrmEvent;
}

export function EventEditForm({ event }: EventEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(event?.event ?? "");
  const [type, setType] = useState(event?.type ?? "");
  const [frequency, setFrequency] = useState(event?.frequency ?? "");
  const [eventStart, setEventStart] = useState(event?.eventDates?.start ?? "");
  const [eventEnd, setEventEnd] = useState(event?.eventDates?.end ?? "");
  const [proposalDeadline, setProposalDeadline] = useState(event?.proposalDeadline?.start ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [url, setUrl] = useState(event?.url ?? "");
  const [estAttendance, setEstAttendance] = useState(event?.estAttendance ?? "");
  const [registrationCost, setRegistrationCost] = useState(event?.registrationCost ?? "");
  const [quadrantRelevance, setQuadrantRelevance] = useState<string[]>(event?.quadrantRelevance ?? []);
  const [whoShouldAttend, setWhoShouldAttend] = useState<string[]>(event?.whoShouldAttend ?? []);
  const [bdSegments, setBdSegments] = useState(event?.bdSegments ?? "");
  const [whyItMatters, setWhyItMatters] = useState(event?.whyItMatters ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [error, setError] = useState("");

  function toggleQuadrant(q: string) {
    setQuadrantRelevance((prev) =>
      prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q],
    );
  }

  function toggleAttendee(t: string) {
    setWhoShouldAttend((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  function buildPayload() {
    return {
      event: name.trim(),
      ...(type && { type }),
      ...(frequency && { frequency }),
      ...(eventStart && {
        eventDates: { start: eventStart, end: eventEnd || null },
      }),
      ...(proposalDeadline && {
        proposalDeadline: { start: proposalDeadline, end: null },
      }),
      ...(location && { location }),
      ...(url && { url }),
      ...(estAttendance && { estAttendance }),
      ...(registrationCost && { registrationCost }),
      quadrantRelevance,
      whoShouldAttend,
      ...(bdSegments && { bdSegments }),
      ...(whyItMatters && { whyItMatters }),
      ...(notes && { notes }),
    };
  }

  function handleSave() {
    if (!name.trim()) { setError("event name is required"); return; }
    setError("");

    startTransition(async () => {
      const isEdit = !!event;
      const res = await fetch(
        isEdit ? `/api/events/${event.id}` : "/api/events",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "save failed");
        return;
      }

      router.push("/events");
      router.refresh();
    });
  }

  function handleDelete() {
    if (!event) return;
    if (!confirm(`Delete "${event.event}"? This cannot be undone.`)) return;

    startTransition(async () => {
      await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      router.push("/events");
      router.refresh();
    });
  }

  const SaveButton = (
    <Button onClick={handleSave} disabled={isPending} size="sm" className="gap-1.5">
      <Save className="h-3.5 w-3.5" />
      {isPending ? "saving..." : "save"}
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* toolbar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/events")} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          back
        </Button>
        <div className="flex items-center gap-2">
          {event && (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isPending}
              className="gap-1.5 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
              delete
            </Button>
          )}
          {SaveButton}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* left column */}
        <div className="space-y-6">
          <Section title="Details">
            <Field label="event name *">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" />
            </Field>
            <Field label="type">
              <Select value={type} onValueChange={(v) => setType(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="select type" /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="frequency">
              <Select value={frequency} onValueChange={(v) => setFrequency(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="select frequency" /></SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="location">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
            </Field>
            <Field label="website url">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="est. attendance">
                <Input value={estAttendance} onChange={(e) => setEstAttendance(e.target.value)} placeholder="e.g. 500" />
              </Field>
              <Field label="registration cost">
                <Input value={registrationCost} onChange={(e) => setRegistrationCost(e.target.value)} placeholder="e.g. $1,200" />
              </Field>
            </div>
          </Section>

          <Section title="Dates">
            <div className="grid grid-cols-2 gap-3">
              <Field label="event start">
                <Input type="date" value={eventStart} onChange={(e) => setEventStart(e.target.value)} />
              </Field>
              <Field label="event end">
                <Input type="date" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} />
              </Field>
            </div>
            <Field label="proposal deadline">
              <Input type="date" value={proposalDeadline} onChange={(e) => setProposalDeadline(e.target.value)} />
            </Field>
          </Section>
        </div>

        {/* right column */}
        <div className="space-y-6">
          <Section title="Audience">
            <Field label="quadrant relevance">
              <div className="flex flex-wrap gap-2">
                {QUADRANT_OPTIONS.map((q) => (
                  <ToggleChip key={q} label={q} selected={quadrantRelevance.includes(q)} onToggle={() => toggleQuadrant(q)} />
                ))}
              </div>
            </Field>
            <Field label="who should attend">
              <div className="flex flex-wrap gap-2">
                {TEAM_OPTIONS.map((t) => (
                  <ToggleChip key={t} label={t} selected={whoShouldAttend.includes(t)} onToggle={() => toggleAttendee(t)} />
                ))}
              </div>
            </Field>
            <Field label="BD segments">
              <Textarea
                value={bdSegments}
                onChange={(e) => setBdSegments(e.target.value)}
                placeholder="Which BD segments does this event serve?"
                rows={3}
              />
            </Field>
          </Section>

          <Section title="Content">
            <Field label="why it matters">
              <Textarea
                value={whyItMatters}
                onChange={(e) => setWhyItMatters(e.target.value)}
                placeholder="Why is this event relevant to w.v.?"
                rows={4}
              />
            </Field>
            <Field label="notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </Field>
          </Section>
        </div>
      </div>

      {/* bottom save bar */}
      <div className="flex justify-end pt-2 border-t">
        {SaveButton}
      </div>
    </div>
  );
}
