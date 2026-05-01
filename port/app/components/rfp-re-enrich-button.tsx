"use client";

/**
 * Button that calls POST /api/rfp-radar/[id]/re-enrich on demand.
 * Shown on the detail page when rfpDocumentUrl is null and the record has a
 * valid HTTP source URL. Refreshes the page on success so the document link appears.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  rfpId: string;
}

type State = "idle" | "loading" | "success" | "error";

export function RfpReEnrichButton({ rfpId }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string>("");

  async function handleClick() {
    setState("loading");
    setMessage("");

    try {
      const res = await fetch(`/api/rfp-radar/${rfpId}/re-enrich`, { method: "POST" });
      const data = await res.json();

      if (data.ok) {
        const found = Object.keys(data.found ?? {});
        setMessage(
          found.length > 0
            ? `found: ${found.join(", ")} — refreshing…`
            : "data updated",
        );
        setState("success");
        router.refresh();
      } else {
        setMessage(data.message ?? data.error ?? "nothing found at source URL");
        setState("error");
      }
    } catch {
      setMessage("request failed");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-green-600">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        {message}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleClick}
        disabled={state === "loading"}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        {state === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {state === "loading" ? "searching source page…" : "re-discover document"}
      </button>
      {state === "error" && message && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {message}
        </p>
      )}
    </div>
  );
}
