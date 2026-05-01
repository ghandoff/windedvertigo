"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "cycle", label: "current cycle" },
  { key: "backlog", label: "backlog" },
  { key: "roadmap", label: "roadmap" },
  { key: "timeline", label: "timeline" },
] as const;

export function StudioTabs({ activeView }: { activeView: string }) {
  return (
    <div className="flex items-center gap-1 mb-6 bg-muted rounded-lg p-1 w-fit">
      {VIEWS.map((view) => (
        <Link
          key={view.key}
          href={`/work/studios${view.key === "cycle" ? "" : `?view=${view.key}`}`}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            activeView === view.key
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {view.label}
        </Link>
      ))}
    </div>
  );
}
