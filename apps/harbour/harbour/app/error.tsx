"use client";

/**
 * Error boundary for the harbour app root segment.
 *
 * Catches unhandled errors thrown during server-component rendering
 * (e.g. Notion API failures, data-source resolution errors) and renders
 * a graceful fallback instead of a 500. The `reset` callback re-triggers
 * the render so a transient API hiccup can recover without a full reload.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-8 text-center">
      <p className="text-sm text-gray-400">
        harbour is having trouble loading right now.
      </p>
      <button
        onClick={reset}
        className="text-xs text-gray-500 underline underline-offset-4 hover:text-gray-700 transition-colors"
      >
        try again
      </button>
      {error.digest && (
        <p className="text-xs text-gray-300">ref: {error.digest}</p>
      )}
    </div>
  );
}
