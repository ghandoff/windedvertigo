"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, ExternalLink, FileText, Download, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BibliographyRow } from "@/lib/supabase/bibliography";
import { retrievePdfAction } from "../actions";

// Read-only detail view of a citation — the fields the table cards hide
// (abstract, notes, keywords, links, PDF). "edit" hands off to the existing dialog.
export function CitationDetail({
  row,
  open,
  onOpenChange,
  onEdit,
}: {
  row: BibliographyRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: (row: BibliographyRow) => void;
}) {
  if (!row) return null;

  const links: { label: string; href: string }[] = [];
  if (row.doi) links.push({ label: "doi", href: row.doi });
  if (row.publisherLink && row.publisherLink !== row.doi) links.push({ label: "publisher", href: row.publisherLink });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium leading-snug pr-6">{row.fullCitation}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1 max-h-[60vh] overflow-y-auto text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            {row.topic && <Badge variant="outline" className="text-[10px] py-0">{row.topic}</Badge>}
            {row.sourceType && <Badge variant="secondary" className="text-[10px] py-0">{row.sourceType}</Badge>}
            {row.year != null && <span className="text-muted-foreground tabular-nums">{row.year}</span>}
            {row.citationCount != null && <span className="text-muted-foreground">· cited by {row.citationCount}</span>}
          </div>

          {row.abstract && <Section label="abstract">{row.abstract}</Section>}
          {row.notes && <Section label="notes / annotation">{row.notes}</Section>}
          {row.keywords && <Section label="keywords">{row.keywords}</Section>}

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">used in</p>
            {row.usedIn?.length ? (
              <div className="flex gap-1 flex-wrap">
                {row.usedIn.map((a) => (
                  <Badge key={a} variant="secondary" className="text-[10px] py-0">{a}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">— untagged</p>
            )}
          </div>

          {links.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">links</p>
              <div className="flex gap-3 flex-wrap">
                {links.map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> {l.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          <PdfControls row={row} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>close</Button>
          <Button className="gap-1.5" onClick={() => { onOpenChange(false); onEdit(row); }}>
            <Pencil className="h-3.5 w-3.5" /> edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PdfControls({ row }: { row: BibliographyRow }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pdf, setPdf] = useState<{ url: string; source: string | null } | null>(
    row.pdfUrl ? { url: row.pdfUrl, source: row.pdfSource } : null,
  );
  const [note, setNote] = useState<string | null>(null);
  const [retrieving, startRetrieve] = useTransition();
  const [uploading, setUploading] = useState(false);

  function retrieve() {
    setNote(null);
    startRetrieve(async () => {
      const res = await retrievePdfAction(row.id);
      if (res.ok) {
        setPdf({ url: `/api/bibliography/${row.id}/pdf`, source: res.source ?? null });
        router.refresh();
      } else {
        setNote(res.error ?? "couldn't retrieve a PDF");
      }
    });
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNote(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/bibliography/${row.id}/pdf-upload`, { method: "POST", body: fd });
      if (res.ok) {
        setPdf({ url: `/api/bibliography/${row.id}/pdf`, source: "upload" });
        router.refresh();
      } else {
        setNote((await res.json().catch(() => ({})))?.error ?? "upload failed");
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">pdf</p>
      {pdf ? (
        <div className="flex items-center gap-3 flex-wrap">
          <a href={pdf.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            <FileText className="h-3 w-3" /> open PDF
          </a>
          {pdf.source && <span className="text-[10px] text-muted-foreground">via {pdf.source}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={retrieve} disabled={retrieving} className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-60">
            {retrieving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            {retrieving ? "searching…" : "retrieve PDF"}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-60">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} upload
          </button>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
        </div>
      )}
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground leading-relaxed whitespace-pre-wrap">{children}</p>
    </div>
  );
}
