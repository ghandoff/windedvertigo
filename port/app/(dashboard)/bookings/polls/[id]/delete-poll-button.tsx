"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deletePollAction } from "./actions";

interface Props {
  pollId: string;
  pollTitle: string;
}

export function DeletePollButton({ pollId, pollTitle }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
      >
        <Trash2 className="h-3 w-3" />
        delete poll
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        delete &ldquo;{pollTitle}&rdquo;?
      </span>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deletePollAction(pollId);
          })
        }
        className="h-6 text-xs px-2"
      >
        {pending ? "deleting…" : "yes, delete"}
      </Button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        cancel
      </button>
    </div>
  );
}
