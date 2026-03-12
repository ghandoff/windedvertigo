"use client";

/**
 * Segment error boundary — catches unhandled runtime errors in pages/components.
 *
 * Uses the vault dark theme colour palette.  Offers a retry button that calls
 * Next.js reset() to re-render the errored segment.
 */
export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1
        className="text-5xl font-bold tracking-tight mb-4"
        style={{ color: "var(--vault-accent)" }}
      >
        something went wrong
      </h1>

      <p
        className="text-sm mb-8 max-w-md"
        style={{ color: "var(--vault-text-muted)" }}
      >
        an unexpected error occurred. you can try again, or head back to the
        vault.
      </p>

      {process.env.NODE_ENV === "development" && error?.message && (
        <pre
          className="text-xs mb-6 max-w-lg overflow-auto whitespace-pre-wrap"
          style={{ color: "var(--vault-text-muted)" }}
        >
          {error.message}
        </pre>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-4 py-2 text-sm font-medium rounded hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "var(--vault-accent)", color: "#fff" }}
        >
          try again
        </button>

        <a
          href="/"
          className="px-4 py-2 text-sm font-medium rounded hover:opacity-80 transition-opacity"
          style={{
            border: "1px solid var(--vault-accent)",
            color: "var(--vault-accent)",
          }}
        >
          back to vault
        </a>
      </div>
    </main>
  );
}
