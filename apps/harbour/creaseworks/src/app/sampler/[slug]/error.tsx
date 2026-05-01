"use client";

import Link from "next/link";

export default function PlaydateDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen px-6 pt-16 pb-24 max-w-3xl mx-auto text-center">
      <h1 className="text-2xl font-semibold text-cadet mb-2">
        couldn&apos;t load this playdate
      </h1>
      <p className="text-sm text-cadet/50 mb-6 max-w-md mx-auto">
        this is usually temporary — try refreshing the page.
      </p>
      {process.env.NODE_ENV === "development" && error?.message && (
        <pre className="text-xs text-cadet/40 mb-6 max-w-lg mx-auto overflow-auto whitespace-pre-wrap">
          {error.message}
        </pre>
      )}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 text-sm font-medium rounded-lg text-white hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "var(--wv-redwood)" }}
        >
          try again
        </button>
        <Link
          href="/browse"
          className="px-5 py-2.5 text-sm font-medium rounded-lg border border-cadet/20 text-cadet/60 hover:border-cadet/40 transition-colors"
        >
          browse all playdates
        </Link>
      </div>
    </main>
  );
}
