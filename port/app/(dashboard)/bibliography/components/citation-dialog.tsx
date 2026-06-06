"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { BibliographyRow } from "@/lib/supabase/bibliography";
import { addCitationAction, updateCitationAction, fetchDoiMetadataAction } from "../actions";
import { AssetPicker } from "./asset-picker";

// Add (trigger + own state) or edit (controlled, `existing` provided) a citation.
export function CitationDialog({
  existing,
  open: cOpen,
  onOpenChange,
  allAssets = [],
}: {
  existing?: BibliographyRow;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  allAssets?: string[];
}) {
  const router = useRouter();
  const isEdit = existing !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isEdit ? cOpen ?? false : internalOpen;
  const setOpen = isEdit ? onOpenChange ?? (() => {}) : setInternalOpen;

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
        : await addCitationAction({
            fullCitation,
            topic,
            sourceType,
            year: yearNum,
            doi,
            abstract,
            usedIn,
          });
      if (res.error) return setError(res.error);
      if (!existing) {
        setFullCitation("");
        setTopic("");
        setSourceType("");
        setYear("");
        setDoi("");
        setAbstract("");
        setUsedIn([]);
      }
      setOpen(false);
      router.refresh();
    });
  }

  const fields = (
    <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
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
  );

  const content = (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? "edit citation" : "add citation"}</DialogTitle>
      </DialogHeader>
      {fields}
      <DialogFooter>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "saving…" : isEdit ? "save" : "add"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  if (isEdit) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {content}
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          add citation
        </Button>
      } />
      {content}
    </Dialog>
  );
}
