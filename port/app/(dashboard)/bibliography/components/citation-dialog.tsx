"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { addCitationAction, updateCitationAction } from "../actions";

// Add (trigger + own state) or edit (controlled, `existing` provided) a citation.
export function CitationDialog({
  existing,
  open: cOpen,
  onOpenChange,
}: {
  existing?: BibliographyRow;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
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
  const [usedIn, setUsedIn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (existing) {
      setFullCitation(existing.fullCitation);
      setTopic(existing.topic ?? "");
      setSourceType(existing.sourceType ?? "");
      setYear(existing.year ? String(existing.year) : "");
      setDoi(existing.doi ?? "");
      setAbstract(existing.abstract ?? "");
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
          })
        : await addCitationAction({
            fullCitation,
            topic,
            sourceType,
            year: yearNum,
            doi,
            abstract,
            usedIn: usedIn.split(",").map((s) => s.trim()).filter(Boolean),
          });
      if (res.error) return setError(res.error);
      if (!existing) {
        setFullCitation("");
        setTopic("");
        setSourceType("");
        setYear("");
        setDoi("");
        setAbstract("");
        setUsedIn("");
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
          <Input id="bib-doi" value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="https://doi.org/…" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bib-abstract">abstract / annotation</Label>
        <Textarea id="bib-abstract" value={abstract} onChange={(e) => setAbstract(e.target.value)} rows={3} />
      </div>
      {!isEdit && (
        <div className="space-y-1.5">
          <Label htmlFor="bib-usedin">used in (comma-separated assets)</Label>
          <Input id="bib-usedin" value={usedIn} onChange={(e) => setUsedIn(e.target.value)} placeholder="certificate series, PPCS report" />
        </div>
      )}
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
