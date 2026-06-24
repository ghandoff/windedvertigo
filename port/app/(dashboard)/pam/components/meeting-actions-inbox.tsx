"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  GitMerge,
  X,
  Loader2,
  Inbox,
  ArrowRight,
} from "lucide-react";
import type { TriageSuggestion } from "@/lib/ai/pam-triage";

export interface InboxItem {
  id: string;
  title: string;
  ownerName: string | null;
  ownerEmail: string | null;
  meetingId: string;
  deadline: string | null;
  context: string | null;
  suggestion: TriageSuggestion | null;
}

export interface MeetingActionsInboxProps {
  items: InboxItem[];
  /** commitment id → "who · what" label, for rendering merge targets. */
  commitmentLookup: Record<string, string>;
}

const TYPE_CLASS: Record<string, string> = {
  action: "text-[#5872cb] border-[#5872cb]/30 bg-[#5872cb]/5",
  learning: "text-[#7c5ccb] border-[#7c5ccb]/30 bg-[#7c5ccb]/5",
  connection: "text-emerald-600 border-emerald-500/30 bg-emerald-500/5",
  ritual: "text-[#cb7858] border-[#cb7858]/30 bg-[#cb7858]/5",
};

function firstName(email: string | null, name: string | null): string {
  if (name) return name.trim().split(/\s+/)[0];
  if (email) return email.split("@")[0];
  return "unassigned";
}

/**
 * PaM review inbox — triaged meeting action items awaiting a human decision.
 * Each item carries PaM's suggestion (cycle, type, priority, possible merge);
 * the reviewer Accepts (→ new commitment on the board), Merges (→ links to an
 * existing commitment), or Dismisses.
 */
export function MeetingActionsInbox({ items, commitmentLookup }: MeetingActionsInboxProps) {
  const [queue, setQueue] = useState<InboxItem[]>(items);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const decide = (id: string, decision: "accept" | "merge" | "dismiss") => {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await fetch(`/api/council/actions/${id}/promote-to-commitment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      setBusyId(null);
      if (res.ok) {
        setQueue((q) => q.filter((it) => it.id !== id));
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

  if (queue.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-muted-foreground">
        <Inbox className="mx-auto mb-2 h-5 w-5 opacity-50" />
        inbox clear — no meeting action items awaiting review.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {queue.length} action {queue.length === 1 ? "item" : "items"} from recent meetings, triaged by
        PaM. accept → adds to the whirlpool board · merge → links to an existing commitment · dismiss → drops it.
      </p>

      {error && (
        <p className="text-xs text-[#b15043] border border-[#b15043]/30 bg-[#b15043]/5 rounded px-2 py-1">
          {error}
        </p>
      )}

      {queue.map((item) => {
        const s = item.suggestion;
        const mergeTarget = s?.mergeWith ? commitmentLookup[s.mergeWith] : undefined;
        const busy = busyId === item.id && isPending;
        return (
          <div key={item.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{item.title}</p>
                {item.context && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">{item.context}</p>
                )}
              </div>
              <Link
                href={`/council/${item.meetingId}`}
                className="shrink-0 text-muted-foreground hover:text-[#cb7858]"
                title="view source meeting"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* PaM's suggestion */}
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-muted-foreground">
                {firstName(item.ownerEmail, item.ownerName)}
              </span>
              {s && (
                <>
                  <span className={`rounded border px-1.5 py-0.5 ${TYPE_CLASS[s.suggestedType] ?? TYPE_CLASS.action}`}>
                    {s.suggestedType}
                  </span>
                  <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-muted-foreground">
                    {s.priority}
                  </span>
                  <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-muted-foreground tabular-nums">
                    {s.suggestedCycle ? `week of ${s.suggestedCycle}` : "backlog"}
                  </span>
                  {item.deadline && (
                    <span className="text-muted-foreground tabular-nums">due {item.deadline}</span>
                  )}
                </>
              )}
            </div>

            {s?.reason && <p className="text-[11px] italic text-muted-foreground">PaM: {s.reason}</p>}

            {mergeTarget && (
              <p className="text-[11px] text-[#7c5ccb]">
                possible duplicate of: <span className="font-medium">{mergeTarget}</span>
              </p>
            )}

            {/* Decision buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => decide(item.id, "accept")}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded border border-emerald-500/40 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                accept
              </button>
              {mergeTarget && (
                <button
                  onClick={() => decide(item.id, "merge")}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded border border-[#7c5ccb]/40 px-2 py-1 text-xs text-[#7c5ccb] hover:bg-[#7c5ccb]/10 disabled:opacity-50"
                >
                  <GitMerge className="h-3 w-3" />
                  merge
                </button>
              )}
              <button
                onClick={() => decide(item.id, "dismiss")}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
