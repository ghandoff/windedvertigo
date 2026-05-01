"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

interface Props {
  rfpId: string;
  /** Current proposalStatus from Notion — used to gate the button label. */
  currentStatus: string | null | undefined;
}

/**
 * "Re-generate proposal" button shown on the RFP detail page when an
 * opportunity is in "pursuing" status. Calls the regenerate-proposal route,
 * then refreshes the Server Component so the updated proposalStatus shows.
 *
 * Also provides an escape hatch when the job is stuck in "generating":
 * a "reset" link calls reset-proposal-status so generation can be retried.
 */
export function RfpRegenerateButton({ rfpId, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [triggered, setTriggered] = useState(false);
  const [resetting, setResetting] = useState(false);

  const isGenerating = currentStatus === "generating" || currentStatus === "queued";

  async function handleClick() {
    setError(null);
    const res = await fetch(`/api/rfp-radar/${rfpId}/regenerate-proposal`, {
      method: "POST",
    });

    if (res.status === 409) {
      // Already generating — just refresh to show the current state
      startTransition(() => router.refresh());
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? "failed to trigger generation");
      return;
    }

    setTriggered(true);
    // Refresh the Server Component so the "generating…" badge appears
    startTransition(() => router.refresh());
  }

  async function handleReset() {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/reset-proposal-status`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "reset failed");
        return;
      }
      // Status cleared — refresh so the generate button reappears
      startTransition(() => router.refresh());
    } finally {
      setResetting(false);
    }
  }

  // When actively generating, show a "stuck? reset" escape hatch instead of hiding
  if (isGenerating) {
    return (
      <div className="pt-1 space-y-0.5">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3 animate-spin" />
          generating…
          <span className="text-muted-foreground/50 mx-0.5">·</span>
          <button
            onClick={handleReset}
            disabled={resetting || isPending}
            className="text-xs text-muted-foreground/70 hover:text-foreground underline underline-offset-2 disabled:opacity-50 transition-colors"
          >
            {resetting ? "resetting…" : "stuck? reset"}
          </button>
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="pt-1">
      {triggered ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3 animate-spin" />
          queued — generating with latest TOR…
        </p>
      ) : (
        <button
          onClick={handleClick}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
          {currentStatus ? "re-generate proposal" : "generate proposal"}
        </button>
      )}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
