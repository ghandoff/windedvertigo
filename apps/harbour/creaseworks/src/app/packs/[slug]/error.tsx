"use client";

export default function PackDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto text-center">
      <h1 className="text-2xl font-semibold text-cadet mb-2">
        something went wrong loading this pack
      </h1>
      <p className="text-sm text-cadet/50 mb-6 max-w-md mx-auto">
        this is usually temporary — try refreshing the page.
      </p>
      {process.env.NODE_ENV === "development" && error?.message && (
        <pre className="text-xs text-cadet/40 mb-6 max-w-lg mx-auto overflow-auto whitespace-pre-wrap">
          {error.message}
        </pre>
      )}
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 text-sm font-medium rounded-lg text-white hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "var(--wv-redwood)" }}
        >
          try again
        </button>
        <a
          href="/packs"
          className="px-5 py-2.5 text-sm font-medium rounded-lg hover:opacity-80 transition-opacity"
          style={{
            border: "1px solid var(--wv-sienna)",
            color: "var(--wv-sienna)",
          }}
        >
          back to packs
        </a>
      </div>
    </main>
  );
}
