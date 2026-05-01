"use client";

/**
 * Error boundary for /packs routes.
 * Catches runtime errors in pack listing and detail pages.
 */
export default function PacksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1
        className="text-3xl font-bold tracking-tight mb-3"
        style={{ color: "var(--wv-redwood)" }}
      >
        couldn&apos;t load packs
      </h1>

      <p className="text-sm text-cadet/60 mb-8 max-w-md">
        something went wrong while loading the pack catalogue. this is
        usually temporary — try refreshing.
      </p>

      {process.env.NODE_ENV === "development" && error?.message && (
        <pre className="text-xs text-cadet/40 mb-6 max-w-lg overflow-auto whitespace-pre-wrap">
          {error.message}
        </pre>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-4 py-2 text-sm font-medium rounded transition-colors bg-redwood text-white hover:bg-sienna"
        >
          try again
        </button>

        <a
          href="/"
          className="px-4 py-2 text-sm font-medium rounded border border-redwood/30 text-redwood hover:bg-redwood/5 transition-colors"
        >
          go home
        </a>
      </div>
    </main>
  );
}
