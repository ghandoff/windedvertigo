"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, RotateCcw, Send } from "lucide-react";

interface ProposalReviewActionsProps {
  rfpId: string;
  stage: "v1-generated" | "biz-review" | "human-review" | "approved" | "exported";
}

export function ProposalReviewActions({ rfpId, stage }: ProposalReviewActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function act(action: string) {
    setLoading(action);
    try {
      await fetch(`/api/proposals/${rfpId}/review-gate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  if (stage === "v1-generated") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-xs"
        disabled={loading === "advance"}
        onClick={() => act("advance")}
      >
        mark biz review
      </Button>
    );
  }

  if (stage === "human-review") {
    return (
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="default"
          className="text-xs"
          disabled={!!loading}
          onClick={() => act("approve")}
        >
          <CheckCircle className="mr-1 h-3 w-3" />
          {loading === "approve" ? "saving…" : "approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          disabled={!!loading}
          onClick={() => act("revise")}
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          {loading === "revise" ? "saving…" : "request revision"}
        </Button>
      </div>
    );
  }

  if (stage === "approved") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-xs"
        disabled={loading === "export"}
        onClick={() => act("export")}
      >
        <Send className="mr-1 h-3 w-3" />
        {loading === "export" ? "saving…" : "mark exported"}
      </Button>
    );
  }

  return null;
}
