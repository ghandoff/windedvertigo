"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface Props {
  strategicName: string;
  objective: string;
  keyMetrics: string[];
  owner: string;
  matchKeywords: string[];
}

export function CreateWithClaudeButton(props: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await fetch("/api/strategy/create-campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(props),
      });
      const data = (await res.json().catch(() => null)) as
        | { redirectUrl?: string; campaignId?: string; error?: string }
        | null;

      if (!res.ok) {
        setErrMsg(data?.error ?? "failed to draft campaign");
        return;
      }

      if (data?.redirectUrl) {
        router.push(data.redirectUrl);
      } else if (data?.campaignId) {
        router.push(`/campaigns/${data.campaignId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void handleCreate();
        }}
        disabled={loading}
        className="text-[10px] h-6 px-2 gap-1 border-[#b15043]/40 text-[#b15043] hover:bg-[#b15043]/10 hover:text-[#b15043]"
      >
        <Sparkles className="h-3 w-3" />
        {loading ? "claude is writing…" : "create with claude"}
      </Button>
      {errMsg && (
        <span className="text-[10px] text-red-600 max-w-[180px] text-right leading-tight">
          {errMsg}
        </span>
      )}
    </div>
  );
}
