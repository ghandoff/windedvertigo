"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AddDocumentDialogProps {
  dealId: string;
  currentDocuments?: string;
}

export function AddDocumentDialog({ dealId, currentDocuments }: AddDocumentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    const updated = currentDocuments
      ? `${currentDocuments}\n${trimmed}`
      : trimmed;

    await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: updated }),
    });

    setUrl("");
    setOpen(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="gap-1.5">
          <FilePlus className="h-3.5 w-3.5" />
          add document
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>add google drive document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="doc-url">google drive url</Label>
            <Input
              id="doc-url"
              type="url"
              placeholder="https://docs.google.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setUrl(""); setOpen(false); }}
            >
              cancel
            </Button>
            <Button type="submit" disabled={!url.trim() || isPending}>
              add document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
