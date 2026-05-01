"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncResult {
  created: number;
  skipped: number;
  failed: number;
  feeds: number;
  errors?: string[];
}

export function SyncFeedsButton() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleSync() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/rfp-radar/sync", { method: "POST" });
      const data: SyncResult = await res.json();
      setResult(data);
      startTransition(() => router.refresh());
    } catch {
      setResult({ created: 0, skipped: 0, failed: 0, feeds: 0, errors: ["request failed"] });
    } finally {
      setRunning(false);
    }
  }

  const label = running
    ? "syncing..."
    : result
      ? result.created > 0
        ? `+${result.created} new`
        : "up to date"
      : "sync feeds";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={running}
      className="gap-1.5"
      title={result ? `${result.created} created · ${result.skipped} skipped · ${result.feeds} feeds` : undefined}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
      {label}
    </Button>
  );
}
