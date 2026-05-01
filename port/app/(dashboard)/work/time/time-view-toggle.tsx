"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Users, User } from "lucide-react";

interface MemberOption {
  name: string;
  /** Notion workspace user ID — used as the ?member= param. */
  notionUserId: string;
}

interface TimeViewToggleProps {
  activeView: "mine" | "collective" | "member";
  activeMemberId?: string;
  members: MemberOption[];
  /** Whether the user has permission to see team data. */
  canSeeTeam: boolean;
}

/**
 * URL-driven view toggle for the time page.
 *
 * - "mine"       → /work/time (default for members, explicit for admin)
 * - "collective"  → /work/time?view=collective (all entries, admin/team only)
 * - individual    → /work/time?member={notionUserId} (admin/team only)
 */
export function TimeViewToggle({
  activeView,
  activeMemberId,
  members,
  canSeeTeam,
}: TimeViewToggleProps) {
  if (!canSeeTeam) return null;

  return (
    <div className="flex items-center gap-4 mb-6">
      {/* Primary toggle: mine vs collective */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        <Link
          href="/work/time"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            activeView === "mine"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <User className="h-3 w-3" />
          mine
        </Link>
        <Link
          href="/work/time?view=collective"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            activeView === "collective"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Users className="h-3 w-3" />
          collective
        </Link>
      </div>

      {/* Member picker — shown when viewing collective or individual */}
      {(activeView === "collective" || activeView === "member") && members.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">filter:</span>
          <Link
            href="/work/time?view=collective"
            className={cn(
              "px-2 py-1 text-[11px] font-medium rounded-md transition-colors",
              activeView === "collective" && !activeMemberId
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            all
          </Link>
          {members.map((m) => (
            <Link
              key={m.notionUserId}
              href={`/work/time?member=${m.notionUserId}`}
              className={cn(
                "px-2 py-1 text-[11px] font-medium rounded-md transition-colors",
                activeMemberId === m.notionUserId
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {m.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
