"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X, UserPlus } from "lucide-react";

/**
 * floating action button for mobile — quick access to search and add person.
 * shows above the bottom nav bar.
 */
export function FloatingActions() {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  return (
    <div className="fixed bottom-20 right-4 z-30 flex flex-col items-end gap-2 md:hidden">
      {/* expanded actions */}
      {expanded && (
        <>
          <button
            onClick={() => {
              router.push("/?focus=search");
              setExpanded(false);
            }}
            className="flex h-11 items-center gap-2 rounded-full bg-card border border-border px-4 shadow-lg text-sm font-medium text-foreground animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <Search className="h-4 w-4" />
            search
          </button>
          <button
            onClick={() => {
              router.push("/?focus=add");
              setExpanded(false);
            }}
            className="flex h-11 items-center gap-2 rounded-full bg-card border border-border px-4 shadow-lg text-sm font-medium text-foreground animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <UserPlus className="h-4 w-4" />
            add person
          </button>
        </>
      )}

      {/* main FAB */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 ${
          expanded
            ? "bg-muted text-muted-foreground rotate-45"
            : "bg-primary text-primary-foreground"
        }`}
        aria-label={expanded ? "close quick actions" : "quick actions"}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
