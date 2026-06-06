"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BibliographyRow } from "@/lib/supabase/bibliography";
import { CitationForm } from "./citation-form";

// Edit a citation (controlled). Adding now lives in AddCitationsDialog → CitationForm.
export function CitationDialog({
  existing,
  open,
  onOpenChange,
  allAssets = [],
}: {
  existing?: BibliographyRow;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  allAssets?: string[];
}) {
  const setOpen = onOpenChange ?? (() => {});
  return (
    <Dialog open={open ?? false} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>edit citation</DialogTitle>
        </DialogHeader>
        {existing && (
          <CitationForm
            existing={existing}
            allAssets={allAssets}
            onDone={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
