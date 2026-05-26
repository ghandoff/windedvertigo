"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, CheckCircle2, ExternalLink } from "lucide-react";

export interface PromoteActionButtonProps {
  actionId: string;
  /** Set if already promoted — renders a link instead of a button. */
  initialWorkItemId: string | null;
  compact?: boolean;
}

/**
 * Promote a meeting action item into a port work_item (Notion task).
 *
 * Three states:
 *   - Not promoted → button "→ work item"
 *   - Promoting → spinner
 *   - Promoted → link "open task ↗" to the Notion page (or just an icon
 *     when compact)
 */
export function PromoteActionButton({
  actionId,
  initialWorkItemId,
  compact = false,
}: PromoteActionButtonProps) {
  const [workItemId, setWorkItemId] = useState<string | null>(initialWorkItemId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const cls = compact
    ? "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border"
    : "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border";

  if (workItemId) {
    return (
      <a
        href={`https://www.notion.so/${workItemId.replace(/-/g, "")}`}
        target="_blank"
        rel="noreferrer"
        className={`${cls} border-[#5872cb]/40 text-[#5872cb] hover:bg-[#5872cb]/10`}
        title="open in notion work items"
      >
        <CheckCircle2 className="h-3 w-3" />
        {compact ? "task" : "open task"}
        <ExternalLink className="h-3 w-3 opacity-60" />
      </a>
    );
  }

  const promote = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/council/actions/${actionId}/promote`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.ok) {
        const id = (data as { workItemId?: string }).workItemId;
        if (id) setWorkItemId(id);
        router.refresh();
      } else {
        setError(
          (data as { message?: string; error?: string }).message ??
            (data as { error?: string }).error ??
            `HTTP ${res.status}`,
        );
      }
    });
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        onClick={promote}
        disabled={isPending}
        className={`${cls} border-[#cb7858]/40 text-[#cb7858] hover:bg-[#cb7858]/10`}
        title="promote this action to a port work_item (Notion task)"
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3 w-3" />}
        {compact ? "→ task" : "promote → work item"}
      </button>
      {error && <span className="text-[10px] text-[#b15043] max-w-[160px] truncate">{error}</span>}
    </div>
  );
}
