"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type HintStatus =
  | { phase: "idle" }
  | { phase: "streaming"; personName: string; current: number; total: number; hintsFound: number; warning?: string }
  | { phase: "done"; generated: number; total: number; elapsed: number }
  | { phase: "error"; message: string };

export function GenerateHintsButton({ treeId, pendingCount }: { treeId: string; pendingCount?: number }) {
  const [status, setStatus] = useState<HintStatus>({ phase: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const handleStart = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ phase: "streaming", personName: "", current: 0, total: 0, hintsFound: 0 });

    try {
      const res = await fetch("/api/hints/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setStatus({ phase: "error", message: `server error: ${res.status}` });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let warning: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // parse SSE frames
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            switch (event.type) {
              case "progress":
                setStatus({
                  phase: "streaming",
                  personName: event.personName,
                  current: event.current,
                  total: event.total,
                  hintsFound: event.hintsFound,
                  warning,
                });
                break;
              case "warning":
                warning = event.message;
                break;
              case "complete":
                setStatus({
                  phase: "done",
                  generated: event.generated,
                  total: event.total,
                  elapsed: event.elapsed,
                });
                router.refresh();
                setTimeout(() => setStatus({ phase: "idle" }), 5000);
                break;
              case "cancelled":
                setStatus({ phase: "idle" });
                router.refresh();
                break;
              case "error":
                // per-person error — continue streaming
                break;
            }
          } catch {
            // ignore malformed SSE frames
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus({ phase: "idle" });
        router.refresh();
      } else {
        setStatus({ phase: "error", message: (err as Error).message ?? "connection failed" });
        setTimeout(() => setStatus({ phase: "idle" }), 5000);
      }
    } finally {
      abortRef.current = null;
    }
  }, [treeId, router]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const isStreaming = status.phase === "streaming";

  return (
    <div className="space-y-2">
      {status.phase === "idle" && (
        <button
          onClick={handleStart}
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M11 8v4" />
            <path d="M11 16h.01" />
          </svg>
          discover hints
          {pendingCount != null && pendingCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {pendingCount}
            </span>
          )}
        </button>
      )}

      {isStreaming && (
        <div className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">searching...</span>
            <button
              onClick={handleCancel}
              className="text-xs text-destructive hover:underline"
            >
              cancel
            </button>
          </div>

          {/* progress bar */}
          {status.total > 0 && (
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(status.current / status.total) * 100}%` }}
              />
            </div>
          )}

          <p className="text-xs text-muted-foreground truncate">
            {status.current}/{status.total} — {status.personName}
          </p>
          {status.hintsFound > 0 && (
            <p className="text-xs text-primary">{status.hintsFound} hints found</p>
          )}
          {status.warning && (
            <p className="text-[10px] text-amber-600">{status.warning}</p>
          )}
        </div>
      )}

      {status.phase === "done" && (
        <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-center">
          <p className="text-xs text-foreground font-medium">
            {status.generated} hints found across {status.total} people
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            completed in {(status.elapsed / 1000).toFixed(1)}s
          </p>
          {status.generated > 0 && (
            <a href="/hints" className="text-xs text-primary hover:underline mt-1 inline-block">
              view hints
            </a>
          )}
        </div>
      )}

      {status.phase === "error" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <p className="text-xs text-destructive">{status.message}</p>
          <button
            onClick={() => setStatus({ phase: "idle" })}
            className="text-xs text-muted-foreground hover:underline mt-1"
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
