"use client";

/**
 * RunStudyButton — triggers a cARL study run on demand from the /carl header.
 * Calls GET /api/cron/carl-study?count=N with the session cookie; the route
 * accepts a logged-in user in addition to the cron/agent bearer.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RunResult {
  studied?: number;
  grounded?: number;
  sources_filed?: number;
  delivered_to_agents?: number;
  replenished?: number;
  cost_usd?: number;
  error?: string;
}

export function RunStudyButton({ count = 10 }: { count?: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [, startTransition] = useTransition();

  async function run() {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cron/carl-study?count=${count}`, { credentials: "include" });
      const data = (await res.json()) as RunResult;
      setResult(res.ok ? data : { error: data.error ?? `failed (${res.status})` });
      startTransition(() => router.refresh());
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "network error" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={run} disabled={running}>
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {running ? "studying…" : "run a study now"}
      </Button>
      {result && !result.error && (
        <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <Check className="h-3 w-3 text-green-600" />
          {result.studied ?? 0} studied · {result.grounded ?? 0} search-grounded · {result.sources_filed ?? 0} filed
          {result.delivered_to_agents ? ` · ${result.delivered_to_agents} to Mo/Pam` : ""}
          {result.replenished ? ` · +${result.replenished} queued` : ""}
          {result.cost_usd != null ? ` · $${result.cost_usd.toFixed(3)}` : ""}
        </p>
      )}
      {result?.error && <p className="text-[10px] text-destructive">{result.error}</p>}
    </div>
  );
}
