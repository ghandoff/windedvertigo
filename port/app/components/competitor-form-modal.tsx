"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { Competitor, CompetitorType, ThreatLevel, Geography, Quadrant } from "@/lib/notion/types";

const TYPES: CompetitorType[] = [
  "Direct Competitor", "Adjacent Player", "Conference / Event",
  "Network / Association", "Certification Body",
];

const THREAT_LEVELS: ThreatLevel[] = ["🔴 High", "🟡 Medium", "🟢 Low"];

const GEOGRAPHIES: Geography[] = [
  "Global", "US", "UK", "Europe", "Latin America", "East Africa", "Middle East", "Asia-Pacific",
];

const QUADRANTS: Quadrant[] = [
  "Design + Deploy", "Pinpoint + Prove", "Build + Iterate", "Test + Validate",
];

export interface CompetitorFormData {
  organisation: string;
  type: CompetitorType | "";
  threatLevel: ThreatLevel | "";
  quadrantOverlap: Quadrant[];
  geography: Geography[];
  whatTheyOffer: string;
  whereWvWins: string;
  relevanceToWv: string;
  notes: string;
  url: string;
}

function emptyForm(): CompetitorFormData {
  return {
    organisation: "",
    type: "",
    threatLevel: "",
    quadrantOverlap: [],
    geography: [],
    whatTheyOffer: "",
    whereWvWins: "",
    relevanceToWv: "",
    notes: "",
    url: "",
  };
}

function competitorToForm(c: Competitor): CompetitorFormData {
  return {
    organisation: c.organisation,
    type: c.type ?? "",
    threatLevel: c.threatLevel ?? "",
    quadrantOverlap: c.quadrantOverlap ?? [],
    geography: (c.geography ?? []) as Geography[],
    whatTheyOffer: c.whatTheyOffer ?? "",
    whereWvWins: c.whereWvWins ?? "",
    relevanceToWv: c.relevanceToWv ?? "",
    notes: c.notes ?? "",
    url: c.url ?? "",
  };
}

interface Props {
  open: boolean;
  competitor?: Competitor | null; // null/undefined = create mode
  onSave: (data: CompetitorFormData) => Promise<void>;
  onClose: () => void;
}

export function CompetitorFormModal({ open, competitor, onSave, onClose }: Props) {
  const [form, setForm] = useState<CompetitorFormData>(() =>
    competitor ? competitorToForm(competitor) : emptyForm(),
  );
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens with new competitor
  function handleOpenChange(v: boolean) {
    if (!v) onClose();
    else setForm(competitor ? competitorToForm(competitor) : emptyForm());
  }

  // Sync form when competitor prop changes while open
  function syncIfNeeded() {
    const fresh = competitor ? competitorToForm(competitor) : emptyForm();
    setForm(fresh);
  }

  // Toggle multi-select value
  function toggleMulti<T extends string>(
    key: keyof Pick<CompetitorFormData, "quadrantOverlap" | "geography">,
    value: T,
  ) {
    setForm((prev) => {
      const arr = prev[key] as T[];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }

  async function handleSubmit() {
    if (!form.organisation.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  const isEdit = !!competitor;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" >
        <DialogHeader>
          <DialogTitle>{isEdit ? `edit: ${competitor!.organisation}` : "add competitor"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name + URL */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>name *</Label>
              <Input
                value={form.organisation}
                onChange={(e) => setForm({ ...form, organisation: e.target.value })}
                placeholder="org name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>website</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Type + Threat */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as CompetitorType })}
              >
                <SelectTrigger><SelectValue placeholder="select type" /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>threat level</Label>
              <Select
                value={form.threatLevel}
                onValueChange={(v) => setForm({ ...form, threatLevel: v as ThreatLevel })}
              >
                <SelectTrigger><SelectValue placeholder="select threat" /></SelectTrigger>
                <SelectContent>
                  {THREAT_LEVELS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quadrant overlap */}
          <div className="space-y-1.5">
            <Label>quadrant overlap</Label>
            <div className="flex flex-wrap gap-2">
              {QUADRANTS.map((q) => {
                const selected = form.quadrantOverlap.includes(q);
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => toggleMulti("quadrantOverlap", q)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {q}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Geography */}
          <div className="space-y-1.5">
            <Label>geography</Label>
            <div className="flex flex-wrap gap-2">
              {GEOGRAPHIES.map((g) => {
                const selected = form.geography.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleMulti("geography", g)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      selected
                        ? "bg-secondary text-secondary-foreground border-secondary"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text fields */}
          <div className="space-y-1.5">
            <Label>what they offer</Label>
            <Textarea
              value={form.whatTheyOffer}
              onChange={(e) => setForm({ ...form, whatTheyOffer: e.target.value })}
              placeholder="1-2 sentences on their services..."
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-green-700">where w.v wins</Label>
            <Textarea
              value={form.whereWvWins}
              onChange={(e) => setForm({ ...form, whereWvWins: e.target.value })}
              placeholder="our competitive edge over them..."
              rows={2}
              className="border-green-200 focus-visible:ring-green-400"
            />
          </div>
          <div className="space-y-1.5">
            <Label>relevance to w.v</Label>
            <Textarea
              value={form.relevanceToWv}
              onChange={(e) => setForm({ ...form, relevanceToWv: e.target.value })}
              placeholder="why this org matters to our positioning..."
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="internal notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.organisation.trim()}>
            {saving ? "saving…" : isEdit ? "save changes" : "add competitor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── AI Suggestions Review Modal ──────────────────────────────

import type { CompetitorSuggestion } from "@/app/api/competitors/generate/route";

interface AiSuggestionsModalProps {
  open: boolean;
  suggestions: CompetitorSuggestion[];
  onAdd: (s: CompetitorSuggestion) => Promise<void>;
  onClose: () => void;
}

export function AiSuggestionsModal({ open, suggestions, onAdd, onClose }: AiSuggestionsModalProps) {
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function handleAdd(s: CompetitorSuggestion) {
    setAdding(s.organisation);
    try {
      await onAdd(s);
      setAdded((prev) => new Set(prev).add(s.organisation));
    } finally {
      setAdding(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setAdded(new Set()); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ai-suggested competitors</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2 mb-3">
          Review each suggestion and add the ones that are relevant.
        </p>
        <div className="space-y-4">
          {suggestions.map((s) => {
            const isAdded = added.has(s.organisation);
            return (
              <div key={s.organisation} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{s.organisation}</p>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-muted-foreground hover:underline">
                        {s.url}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                    <Badge variant="outline" className="text-[10px]">{s.threatLevel}</Badge>
                  </div>
                </div>
                {s.whatTheyOffer && (
                  <p className="text-xs text-muted-foreground">{s.whatTheyOffer}</p>
                )}
                {s.whereWvWins && (
                  <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1">{s.whereWvWins}</p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-wrap gap-1">
                    {(s.geography ?? []).map((g) => (
                      <Badge key={g} variant="secondary" className="text-[9px]">{g}</Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant={isAdded ? "outline" : "default"}
                    disabled={isAdded || adding === s.organisation}
                    onClick={() => handleAdd(s)}
                    className="text-xs h-7"
                  >
                    {isAdded ? "added ✓" : adding === s.organisation ? "adding…" : "add to landscape"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => { setAdded(new Set()); onClose(); }}>done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
