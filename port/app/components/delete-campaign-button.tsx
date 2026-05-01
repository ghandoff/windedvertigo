"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteCampaignButtonProps {
  campaignId: string;
  campaignName: string;
  /** compact = icon-only button (for kanban cards), full = labeled button (for detail page) */
  variant?: "compact" | "full";
  /** redirect to /campaigns after delete (for detail page) */
  redirect?: boolean;
}

export function DeleteCampaignButton({
  campaignId,
  campaignName,
  variant = "full",
  redirect = false,
}: DeleteCampaignButtonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        startTransition(() => {
          if (redirect) {
            router.push("/campaigns");
          } else {
            router.refresh();
          }
        });
      } else {
        const data = await res.json().catch(() => ({ error: "delete failed" }));
        setError(data.error || `failed (${res.status})`);
      }
    } catch {
      setError("network error");
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming && variant === "compact") {
    return (
      <div
        className="flex items-center gap-1"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <Button
          size="sm"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
          className="h-6 text-[10px] px-1.5"
        >
          {deleting ? "…" : "delete"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirming(false)}
          className="h-6 text-[10px] px-1.5"
        >
          cancel
        </Button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-destructive">
          {error || <>delete &ldquo;{campaignName}&rdquo;?</>}
        </span>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
          className="h-7 text-xs"
        >
          {deleting ? "deleting..." : "yes, delete"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirming(false)}
          className="h-7 text-xs"
        >
          cancel
        </Button>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(true); }}
        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        title="delete campaign"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setConfirming(true)}
      className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
    >
      <Trash2 className="h-4 w-4 mr-1.5" />
      delete campaign
    </Button>
  );
}
