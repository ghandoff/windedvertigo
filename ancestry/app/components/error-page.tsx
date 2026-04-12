"use client";

export function ErrorPage({
  error,
  reset,
  title = "something went wrong",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <span className="text-red-500 text-xl">!</span>
        </div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {error.message || "an unexpected error occurred. please try again."}
        </p>
        {error.digest && (
          <p className="text-[10px] text-muted-foreground/50 font-mono">
            error id: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            try again
          </button>
          <a
            href="/"
            className="rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            back to tree
          </a>
        </div>
      </div>
    </div>
  );
}
