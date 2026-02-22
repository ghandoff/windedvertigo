"use client";

/**
 * Global error boundary — catches unhandled runtime errors.
 *
 * Branded with the creaseworks colour palette and lowercase style.
 * Offers a retry button that calls Next.js reset() to re-render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: "#273248", color: "#ffebd2" }}
    >
      <h1
        className="text-5xl font-bold tracking-tight mb-4"
        style={{ color: "#cb7858" }}
      >
        something went wrong
      </h1>

      <p className="text-sm opacity-70 mb-8 max-w-md">
        an unexpected error occurred. you can try again, or head back to the
        homepage.
      </p>

      {process.env.NODE_ENV === "development" && error?.message && (
        <pre className="text-xs opacity-50 mb-6 max-w-lg overflow-auto whitespace-pre-wrap">
          {error.message}
        </pre>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-4 py-2 text-sm font-medium rounded hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "#cb7858", color: "#273248" }}
        >
          try again
        </button>

        <a
          href="/"
          className="px-4 py-2 text-sm font-medium rounded hover:opacity-80 transition-opacity"
          style={{
            border: "1px solid #cb7858",
            color: "#cb7858",
          }}
        >
          go home
        </a>
      </div>
    </main>
  );
}
