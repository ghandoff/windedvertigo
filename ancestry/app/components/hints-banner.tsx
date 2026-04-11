"use client";

import { useState } from "react";
import { HintsModal } from "./hints-modal";

export function HintsBanner({ pendingCount }: { pendingCount: number }) {
  const [open, setOpen] = useState(false);

  if (pendingCount <= 0) return null;

  return (
    <>
      <div className="bg-primary/5 border-b border-primary/20 px-4 py-2 flex items-center justify-between">
        <p className="text-sm text-primary">
          {pendingCount} suggested {pendingCount === 1 ? "match" : "matches"} waiting for review
        </p>
        <button
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-primary hover:underline"
        >
          review hints
        </button>
      </div>

      <HintsModal open={open} onClose={() => setOpen(false)} pendingCount={pendingCount} />
    </>
  );
}
