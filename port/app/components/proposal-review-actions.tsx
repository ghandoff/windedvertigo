"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
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

// ── skip-ahead popover — pure React, no Base UI dependency ───────────────────

interface SkipDropdownProps {
  options: Stage[];
  loading: string | null;
  onSelect: (stage: Stage) => void;
}

function SkipDropdown({ options, loading, onSelect }: SkipDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  if (options.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={!!loading}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center h-7 w-7 rounded-r-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground border-l-0 disabled:opacity-50"
        aria-label="skip to stage"
      >
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-border bg-popover p-1 shadow-md">
          <p className="px-1.5 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            skip to
          </p>
          <div className="-mx-1 my-1 h-px bg-border" />
          {options.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!!loading}
              className="w-full text-left px-1.5 py-1 text-xs rounded hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              onClick={() => { setOpen(false); onSelect(s); }}
            >
              {loading === s ? "saving…" : SKIP_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

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
        <SkipDropdown options={skipOptions} loading={loading} onSelect={(s) => act("jump", s)} />
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
        <SkipDropdown options={skipOptions} loading={loading} onSelect={(s) => act("jump", s)} />
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
          <SkipDropdown options={skipOptions} loading={loading} onSelect={(s) => act("jump", s)} />
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
        <SkipDropdown options={skipOptions} loading={loading} onSelect={(s) => act("jump", s)} />
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
