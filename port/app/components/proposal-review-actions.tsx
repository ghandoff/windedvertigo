"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCircle, RotateCcw, Send, ChevronDown } from "lucide-react";

type Stage =
  | "v1-generated"
  | "biz-review"
  | "human-review"
  | "approved"
  | "exported"
  | "submitted";

interface ProposalReviewActionsProps {
  rfpId: string;
  stage: Stage;
}

const STAGE_ORDER: Stage[] = [
  "v1-generated",
  "biz-review",
  "human-review",
  "approved",
  "exported",
  "submitted",
];

// Short label shown in the "skip to" dropdown
const SKIP_LABEL: Record<Stage, string> = {
  "v1-generated": "v1 generated",
  "biz-review":   "biz review",
  "human-review": "human review",
  "approved":     "approved",
  "exported":     "exported",
  "submitted":    "submitted",
};

function stagesAhead(current: Stage): Stage[] {
  const idx = STAGE_ORDER.indexOf(current);
  return idx === -1 ? [] : STAGE_ORDER.slice(idx + 1);
}

export function ProposalReviewActions({ rfpId, stage }: ProposalReviewActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function act(action: string, targetStage?: Stage) {
    const key = targetStage ?? action;
    setLoading(key);
    try {
      await fetch(`/api/proposals/${rfpId}/review-gate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(targetStage ? { targetStage } : {}) }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const skipOptions = stagesAhead(stage);

  // ── skip-ahead dropdown (shared across all stages) ────────────────────────
  function SkipDropdown({ className }: { className?: string }) {
    if (skipOptions.length === 0) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={!!loading}
          className={`inline-flex items-center justify-center h-7 w-7 rounded-r-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground border-l-0 disabled:opacity-50 ${className ?? ""}`}
        >
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            skip to
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {skipOptions.map((s) => (
            <DropdownMenuItem
              key={s}
              className="text-xs"
              disabled={!!loading}
              onClick={() => act("jump", s)}
            >
              {loading === s ? "saving…" : SKIP_LABEL[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // ── v1-generated: "mark biz review" + skip ───────────────────────────────
  if (stage === "v1-generated") {
    return (
      <div className="flex items-center">
        <Button
          size="sm"
          variant="outline"
          className="text-xs rounded-r-none"
          disabled={!!loading}
          onClick={() => act("advance")}
        >
          {loading === "advance" ? "saving…" : "mark biz review"}
        </Button>
        <SkipDropdown />
      </div>
    );
  }

  // ── biz-review: "mark human review" + skip ───────────────────────────────
  if (stage === "biz-review") {
    return (
      <div className="flex items-center">
        <Button
          size="sm"
          variant="outline"
          className="text-xs rounded-r-none"
          disabled={!!loading}
          onClick={() => act("advance")}
        >
          {loading === "advance" ? "saving…" : "mark human review"}
        </Button>
        <SkipDropdown />
      </div>
    );
  }

  // ── human-review: approve + revise + skip ────────────────────────────────
  if (stage === "human-review") {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center">
          <Button
            size="sm"
            variant="default"
            className="text-xs rounded-r-none"
            disabled={!!loading}
            onClick={() => act("approve")}
          >
            <CheckCircle className="mr-1 h-3 w-3" />
            {loading === "approve" ? "saving…" : "approve"}
          </Button>
          <SkipDropdown />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          disabled={!!loading}
          onClick={() => act("revise")}
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          {loading === "revise" ? "saving…" : "revise"}
        </Button>
      </div>
    );
  }

  // ── approved: "mark exported" + skip to submitted ────────────────────────
  if (stage === "approved") {
    return (
      <div className="flex items-center">
        <Button
          size="sm"
          variant="outline"
          className="text-xs rounded-r-none"
          disabled={!!loading}
          onClick={() => act("export")}
        >
          <Send className="mr-1 h-3 w-3" />
          {loading === "export" ? "saving…" : "mark exported"}
        </Button>
        <SkipDropdown />
      </div>
    );
  }

  // ── exported: "mark submitted" (terminal — no skip) ──────────────────────
  if (stage === "exported") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-xs"
        disabled={loading === "submit"}
        onClick={() => act("submit")}
      >
        <CheckCircle className="mr-1 h-3 w-3" />
        {loading === "submit" ? "saving…" : "mark submitted"}
      </Button>
    );
  }

  return null;
}
