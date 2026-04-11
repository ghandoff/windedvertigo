"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { deletePersonAction } from "./actions";

export function DeletePersonButton({ personId, personName }: { personId: string; personName: string }) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="rounded-md bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
      >
        delete
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <p className="text-sm text-foreground">
        permanently delete <strong>{personName}</strong>? this will also remove all their events, relationships, and hints. this cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => {
            startTransition(async () => {
              await deletePersonAction(personId);
              router.push("/");
            });
          }}
          disabled={isPending}
          className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          {isPending ? "deleting..." : "yes, delete"}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/80"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
