"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { BibliographyRow } from "@/lib/supabase/bibliography";
import { addCitationAction, updateCitationAction, fetchDoiMetadataAction } from "../actions";
import { AssetPicker } from "./asset-picker";

// The citation fields + submit, shared by the manual "type it in" tab (add) and
// the edit dialog (controlled `existing`). Calls onDone after a successful save.
export function CitationForm({
  existing,
  allAssets = [],
  onDone,
  onCancel,
}: {
  existing?: BibliographyRow;
  allAssets?: string[];
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [fullCitation, setFullCitation] = useState("");
  const [topic, setTopic] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [year, setYear] = useState("");
  const [doi, setDoi] = useState("");
  const [abstract, setAbstract] = useState("");
  const [usedIn, setUsedIn] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fetching, setFetching] = useState(false);
  const [doiNote, setDoiNote] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setFullCitation(existing.fullCitation);
      setTopic(existing.topic ?? "");
      setSourceType(existing.sourceType ?? "");
      setYear(existing.year ? String(existing.year) : "");
      setDoi(existing.doi ?? "");
      setAbstract(existing.abstract ?? "");
      setUsedIn(existing.usedIn ?? []);
      setError(null);
    }
  }, [existing]);

  async function fetchFromDoi() {
    if (!doi.trim() || fetching) return;
    setDoiNote(null);
    setError(null);
    setFetching(true);
    const res = await fetchDoiMetadataAction(doi);
    setFetching(false);
    if (res.error || !res.meta) {
      setDoiNote(res.error ?? "no record found");
      return;
    }
    const m = res.meta;
    setFullCitation(m.fullCitation);
    if (m.year != null) setYear(String(m.year));
    if (m.sourceType) setSourceType(m.sourceType);
    if (m.abstract) setAbstract(m.abstract);
    if (m.doiUrl) setDoi(m.doiUrl);
    setDoiNote("filled from Crossref — review, then save.");
  }

  function reset() {
    setFullCitation("");
    setTopic("");
    setSourceType("");
    setYear("");
    setDoi("");
    setAbstract("");
    setUsedIn([]);
    setDoiNote(null);
  }

  function submit() {
    setError(null);
    if (!fullCitation.trim()) return setError("a full citation is required");
    const yearNum = year.trim() ? Number(year) : null;
    startTransition(async () => {
      const res = existing
        ? await updateCitationAction(existing.id, {
            fullCitation: fullCitation.trim(),
            topic: topic.trim() || null,
            sourceType: sourceType.trim() || null,
            year: yearNum,
            doi: doi.trim() || null,
            abstract: abstract.trim() || null,
            usedIn,
          })
        : await addCitationAction({ fullCitation, topic, sourceType, year: yearNum, doi, abstract, usedIn });
      if (res.error) return setError(res.error);
      if (!existing) reset();
      onDone?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
        <div className="space-y-1.5">
          <Label htmlFor="bib-cite">full citation</Label>
          <Textarea
            id="bib-cite"
            value={fullCitation}
            onChange={(e) => setFullCitation(e.target.value)}
            rows={3}
            placeholder="Author, A. A. (Year). Title. Journal, vol(issue), pages."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bib-topic">topic</Label>
            <Input id="bib-topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bib-type">source type</Label>
            <Input id="bib-type" value={sourceType} onChange={(e) => setSourceType(e.target.value)} placeholder="e.g. Book, RCT, Report" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bib-year">year</Label>
            <Input id="bib-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bib-doi">DOI / link</Label>
            <div className="flex gap-1.5">
              <Input id="bib-doi" value={doi} onChange={(e) => { setDoi(e.target.value); setDoiNote(null); }} placeholder="10.1080/… or https://doi.org/…" />
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1" onClick={fetchFromDoi} disabled={fetching || !doi.trim()} title="auto-fill from Crossref">
                {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                fetch
              </Button>
            </div>
            {doiNote && <p className="text-[11px] text-muted-foreground">{doiNote}</p>}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bib-abstract">abstract / annotation</Label>
          <Textarea id="bib-abstract" value={abstract} onChange={(e) => setAbstract(e.target.value)} rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label>used in (assets)</Label>
          <AssetPicker value={usedIn} allAssets={allAssets} onChange={setUsedIn} />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>cancel</Button>
        )}
        <Button onClick={submit} disabled={pending}>
          {pending ? "saving…" : existing ? "save" : "add citation"}
        </Button>
      </div>
    </div>
  );
}
