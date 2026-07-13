"use client";

import { useState } from "react";
import Link from "next/link";
import type { PollWithMeta } from "@/lib/booking/queries";
import { CopyLinkButton } from "@/app/(dashboard)/bookings/components/copy-link-button";

type StatusFilter = "all" | "open" | "finalized" | "expired";

function getStatus(poll: PollWithMeta): "finalized" | "expired" | "open" {
  if (poll.locked_option_id) return "finalized";
  if (poll.allOptionsPast) return "expired";
  return "open";
}

interface Props {
  polls: PollWithMeta[];
  siteOrigin: string;
}

export function PollsList({ polls, siteOrigin }: Props) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const visible =
    filter === "all" ? polls : polls.filter((p) => getStatus(p) === filter);

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex gap-2 text-xs">
        {(["all", "open", "finalized", "expired"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 rounded-md border transition-colors ${
              filter === f
                ? "bg-foreground text-background border-foreground"
                : "text-muted-foreground border-border hover:border-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Poll cards */}
      {visible.map((poll) => {
        const shareUrl = `${siteOrigin}/book/poll/${poll.slug}`;
        const status = getStatus(poll);
        return (
          <div
            key={poll.id}
            className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/bookings/polls/${poll.id}`}
                  className="font-medium text-sm hover:underline underline-offset-4 truncate"
                >
                  {poll.title}
                </Link>
                {/* Status badge */}
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    status === "finalized"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : status === "expired"
                        ? "bg-muted text-muted-foreground"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}
                >
                  {status}
                </span>
              </div>
              {poll.description && (
                <p className="text-xs text-muted-foreground max-w-md truncate">
                  {poll.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  created{" "}
                  {new Date(poll.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span>
                  {poll.responseCount} response
                  {poll.responseCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <CopyLinkButton url={shareUrl} label="copy link" />
              <Link
                href={`/bookings/polls/${poll.id}`}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                view results
              </Link>
            </div>
          </div>
        );
      })}

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          no {filter === "all" ? "" : filter + " "}polls.
        </p>
      )}
    </div>
  );
}
