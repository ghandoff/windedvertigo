"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SyncResult } from "@/lib/gusto/sync";

interface Props {
  approvedCount: number;
  approvedHours: number;
}

export function GustoSyncButton({ approvedCount, approvedHours }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSync() {
    setState("loading");
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/gusto/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error ?? `Sync failed (${res.status})`);
        return;
      }

      setResult(data as SyncResult);
      setState("success");
      router.refresh();
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Network error");
    }
  }

  if (approvedCount === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {approvedCount} approved {approvedCount === 1 ? "entry" : "entries"} ({approvedHours.toFixed(1)}h) ready for Gusto
        </span>
        <button
          onClick={handleSync}
          disabled={state === "loading"}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === "loading" ? "syncing..." : "sync to Gusto"}
        </button>
      </div>

      {state === "success" && result && (
        <div className="text-xs p-2 rounded-md bg-green-50 text-green-700">
          synced {result.synced} {result.synced === 1 ? "entry" : "entries"}
          {result.failed > 0 && ` / ${result.failed} failed`}
          {result.unmapped > 0 && ` / ${result.unmapped} unmapped`}
          {result.skipped > 0 && ` / ${result.skipped} already synced`}
        </div>
      )}

      {state === "error" && (
        <div className="text-xs p-2 rounded-md bg-red-50 text-red-700">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
