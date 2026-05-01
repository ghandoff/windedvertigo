"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EnrichOrgButtonProps {
  orgId: string;
  hasWebsite?: boolean;
}

type EnrichState = "idle" | "loading" | "done" | "error";

export function EnrichOrgButton({ orgId, hasWebsite }: EnrichOrgButtonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<EnrichState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleEnrich() {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/organizations/${orgId}/enrich`, {
        method: "POST",
      });
      if (res.ok) {
        setState("done");
        startTransition(() => router.refresh());
      } else {
        const data = await res.json().catch(() => ({ error: "enrichment failed" }));
        setErrorMsg(data.error || `failed (${res.status})`);
        setState("error");
      }
    } catch {
      setErrorMsg("network error");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <Button variant="outline" size="sm" disabled className="text-green-600 border-green-300">
        <Sparkles className="h-4 w-4 mr-1.5" />
        enriched
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleEnrich}
        disabled={state === "loading"}
        title={undefined}
        className="gap-1.5"
      >
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {state === "loading" ? "enriching..." : "enrich"}
      </Button>
      {state === "error" && (
        <span className="text-[10px] text-destructive">{errorMsg}</span>
      )}
    </div>
  );
}
