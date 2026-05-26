"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { Users, Lock, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type VisibilityFilter = "all" | "team" | "private";

export interface VisibilityFilterPillsProps {
  /** Currently-active filter (read from URL search params on the server). */
  active: VisibilityFilter;
  /**
   * Hide the 'private' pill when there's no signed-in user (e.g. unusual
   * auth state). 'team' and 'all' still work without a user.
   */
  showPrivate?: boolean;
}

/**
 * Pill-style filter for team / private / all on Council Upcoming + Recent.
 *
 * URL-param driven (`?visibility=team`) so SSR can resolve the right query
 * up-front. Switching pills preserves the active tab (?tab=upcoming|recent)
 * and any other params.
 */
export function VisibilityFilterPills({
  active,
  showPrivate = true,
}: VisibilityFilterPillsProps) {
  const pathname = usePathname();
  const params = useSearchParams();

  function href(filter: VisibilityFilter): string {
    const sp = new URLSearchParams(params?.toString() ?? "");
    if (filter === "all") sp.delete("visibility");
    else sp.set("visibility", filter);
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const cls = "inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border transition-colors";

  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="text-muted-foreground">show:</span>
      <Link
        href={href("all")}
        className={cn(
          cls,
          active === "all"
            ? "border-[#273248] bg-[#273248]/5 text-[#273248]"
            : "border-border text-muted-foreground hover:border-[#273248]/40",
        )}
      >
        <LayoutGrid className="h-3 w-3" />
        all
      </Link>
      <Link
        href={href("team")}
        className={cn(
          cls,
          active === "team"
            ? "border-[#43b187] bg-[#43b187]/10 text-[#43b187]"
            : "border-border text-muted-foreground hover:border-[#43b187]/40",
        )}
      >
        <Users className="h-3 w-3" />
        team
      </Link>
      {showPrivate && (
        <Link
          href={href("private")}
          className={cn(
            cls,
            active === "private"
              ? "border-[#cb7858] bg-[#cb7858]/10 text-[#cb7858]"
              : "border-border text-muted-foreground hover:border-[#cb7858]/40",
          )}
        >
          <Lock className="h-3 w-3" />
          private (only you)
        </Link>
      )}
    </div>
  );
}
