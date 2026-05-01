"use client";

/**
 * Error boundary for /admin routes.
 */
export default function AdminError({
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
        admin error
      </h1>

      <p className="text-sm text-cadet/60 mb-8 max-w-md">
        something broke in the admin panel. try refreshing or head back
        to the admin hub.
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
          href="/admin"
          className="px-4 py-2 text-sm font-medium rounded border border-redwood/30 text-redwood hover:bg-redwood/5 transition-colors"
        >
          admin hub
        </a>
      </div>
    </main>
  );
}
