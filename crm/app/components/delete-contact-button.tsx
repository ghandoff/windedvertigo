"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeleteContactButtonProps {
  contactId: string;
  contactName: string;
}

export function DeleteContactButton({ contactId, contactName }: DeleteContactButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setOpen(false);
      router.push("/contacts");
      router.refresh();
    } catch {
      setDeleting(false);
      setDeleteError("Failed to delete — try again");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-1.5" />
          delete
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>delete {contactName}?</DialogTitle>
          <DialogDescription>
            This archives the contact in Notion. It can be restored from Notion if needed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {deleteError && (
            <p className="text-sm text-destructive mr-auto">{deleteError}</p>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>cancel</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "deleting…" : "delete contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
