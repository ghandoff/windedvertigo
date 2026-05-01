"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CompetitorFormModal, type CompetitorFormData } from "./competitor-form-modal";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import type { Competitor } from "@/lib/notion/types";

interface Props {
  competitor: Competitor;
}

export function CompetitorCardActions({ competitor }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleEdit = useCallback(async (data: CompetitorFormData) => {
    await fetch(`/api/competitors/${competitor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditOpen(false);
    router.refresh();
  }, [competitor.id, router]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await fetch(`/api/competitors/${competitor.id}`, { method: "DELETE" });
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }, [competitor.id, router]);

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
          title="edit"
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
          title="delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <CompetitorFormModal
        open={editOpen}
        competitor={competitor}
        onSave={handleEdit}
        onClose={() => setEditOpen(false)}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>remove {competitor.organisation}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This will archive the record. It can be restored from Notion if needed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "removing…" : "remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
