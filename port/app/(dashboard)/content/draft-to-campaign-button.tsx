"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  contentId: string;
}

export function DraftToCampaignButton({ contentId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await fetch(`/api/content/${contentId}/draft-to-campaign`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => null)) as
        | { redirectUrl?: string; error?: string }
        | null;

      if (!res.ok) {
        setErrMsg(data?.error ?? "failed to draft campaign");
        return;
      }

      if (data?.redirectUrl) {
        router.push(data.redirectUrl);
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
        onClick={handleClick}
        disabled={loading}
        className="text-xs h-7 px-2"
      >
        {loading ? "drafting…" : "draft to campaign"}
      </Button>
      {errMsg && (
        <span className="text-[10px] text-red-600">{errMsg}</span>
      )}
    </div>
  );
}
