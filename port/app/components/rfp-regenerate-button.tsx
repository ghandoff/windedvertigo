"use client";

import { useEffect, useState, useTransition } from "react";
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
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false); // true while fetch is in-flight
  const [triggered, setTriggered] = useState(false); // true once API returns ok

  // After triggering, keep refreshing every 5s until the Server Component
  // picks up the "generating" status from Notion — bridges the Inngest lag.
  useEffect(() => {
    if (!triggered) return;
    const id = setInterval(() => startTransition(() => router.refresh()), 5000);
    return () => clearInterval(id);
  }, [triggered, router]);

  async function handleClick() {
    setIsLoading(true); // immediate feedback — show spinner before network call
    setError(null);
    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/regenerate-proposal`, {
        method: "POST",
      });

      if (res.status === 409) {
        // Already generating — refresh to reveal the progress tracker
        startTransition(() => router.refresh());
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "failed to trigger generation");
        return;
      }

      setTriggered(true);
      startTransition(() => router.refresh());
    } finally {
      setIsLoading(false);
    }
  }

  const label = currentStatus ? "re-generate proposal" : "generate proposal";
  const isBusy = isLoading || triggered;

  return (
    <div className="pt-1">
      {isBusy ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3 animate-spin" />
          {isLoading ? "triggering…" : "queued — generating with latest TOR…"}
        </p>
      ) : (
        <button
          onClick={handleClick}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          {label}
        </button>
      )}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
