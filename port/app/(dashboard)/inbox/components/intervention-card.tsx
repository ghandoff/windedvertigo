"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, ArrowRightLeft, X } from "lucide-react";
import type { InterventionRow } from "@/lib/supabase/agent-interventions";

const AGENT_LABELS: Record<InterventionRow["agent"], string> = {
  mo: "Mo",
  pam: "PaM",
  carl: "cARL",
  opsy: "Opsy",
  fin: "Fin",
  biz: "Biz",
};

const TIER_EMOJI: Record<InterventionRow["riskTier"], string> = {
  low: "🟢",
  medium: "🟡",
  high: "🔴",
};

function describeArtifact(artifact: InterventionRow["artifact"]): string {
  if (!artifact) return "(no artifact)";
  const title = typeof artifact.title === "string" ? artifact.title : null;
  const body = typeof artifact.body === "string" ? artifact.body : null;
  return title ?? body ?? JSON.stringify(artifact);
}

type Action = "approve" | "edit" | "redirect" | "ignore";

export function InterventionCard({ item }: { item: InterventionRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | Action>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: Action) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/agent/interventions/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
          {TIER_EMOJI[item.riskTier]} {AGENT_LABELS[item.agent]}
        </span>
        <span className="text-sm font-medium text-foreground truncate">{item.trigger}</span>
      </div>
      <p className="text-xs text-muted-foreground break-words">{describeArtifact(item.artifact)}</p>
      {item.expiresAt && (
        <p className="text-[10px] text-muted-foreground">
          decide by {new Date(item.expiresAt).toLocaleString()} — no response = default-deny
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => act("approve")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 text-xs rounded-md px-2.5 py-1.5 font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#43b187" }}
        >
          <Check className="h-3.5 w-3.5" /> {busy === "approve" ? "…" : "approve"}
        </button>
        <button
          onClick={() => act("edit")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 text-xs rounded-md border border-border px-2.5 py-1.5 text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          <Pencil className="h-3.5 w-3.5" /> {busy === "edit" ? "…" : "edit"}
        </button>
        <button
          onClick={() => act("redirect")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 text-xs rounded-md border border-border px-2.5 py-1.5 text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" /> {busy === "redirect" ? "…" : "redirect"}
        </button>
        <button
          onClick={() => act("ignore")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 text-xs rounded-md border border-border px-2.5 py-1.5 text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> {busy === "ignore" ? "…" : "ignore"}
        </button>
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
    </div>
  );
}
