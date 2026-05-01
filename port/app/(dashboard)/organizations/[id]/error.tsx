"use client";

export default function OrgDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 space-y-4">
      <h2 className="text-lg font-semibold text-destructive">failed to load organization</h2>
      <p className="text-sm text-muted-foreground font-mono break-all">
        {error.message}
        {error.digest && <span className="block text-xs mt-1">digest: {error.digest}</span>}
      </p>
      <button
        onClick={reset}
        className="text-sm underline text-primary"
      >
        try again
      </button>
    </div>
  );
}
