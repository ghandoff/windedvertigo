"use client";

import { Pencil, ExternalLink } from "lucide-react";
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

// Read-only detail view of a citation — the fields the table cards hide
// (abstract, notes, keywords, links). "edit" hands off to the existing dialog.
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
  if (row.publisherLink) links.push({ label: "publisher", href: row.publisherLink });
  if (row.scholarLink) links.push({ label: "scholar", href: row.scholarLink });

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

          {row.abstract && (
            <Section label="abstract">{row.abstract}</Section>
          )}
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground leading-relaxed whitespace-pre-wrap">{children}</p>
    </div>
  );
}
