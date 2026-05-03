"use client";

/**
 * Dashboard-level error boundary.
 *
 * Catches any unhandled errors thrown by Server Components inside
 * app/(dashboard)/** — including Notion API failures, missing env vars,
 * or network errors. Without this, a single bad Notion call shows the
 * Next.js default error UI (white screen) instead of a recoverable prompt.
 *
 * Next.js requires this to be a Client Component ("use client").
 * It is automatically used by the App Router when a Server Component throws.
 */

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console so Vercel runtime logs capture it with a stack trace.
    // This surfaces in `vercel logs` under level=error.
    console.error("[dashboard] page error:", error.message, error.digest ?? "");
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
      <p className="text-sm text-muted-foreground">
        something went wrong loading this page
      </p>
      {error.digest && (
        <p className="text-xs font-mono text-muted-foreground/60">
          {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors"
      >
        try again
      </button>
    </div>
  );
}
