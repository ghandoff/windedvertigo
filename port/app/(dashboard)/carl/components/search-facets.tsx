"use client";

import { Search, TrendingDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchFacetsProps {
  search: string;
  onSearchChange: (v: string) => void;
  filterNeedsDepth: boolean;
  onFilterNeedsDepthChange: (v: boolean) => void;
  filterAgent: string | null;
  onFilterAgentChange: (v: string | null) => void;
  availableAgents: string[];
  agentLabel: (agent: string) => string;
  viewMode: "domain" | "agent";
  onViewModeChange: (v: "domain" | "agent") => void;
  showViewToggle: boolean;
}

export function SearchFacets({
  search,
  onSearchChange,
  filterNeedsDepth,
  onFilterNeedsDepthChange,
  filterAgent,
  onFilterAgentChange,
  availableAgents,
  agentLabel,
  viewMode,
  onViewModeChange,
  showViewToggle,
}: SearchFacetsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[160px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="search domains and findings…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <button
        onClick={() => onFilterNeedsDepthChange(!filterNeedsDepth)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors whitespace-nowrap",
          filterNeedsDepth
            ? "bg-amber-500/10 border-amber-500/40 text-amber-600"
            : "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
        )}
      >
        <TrendingDown className="h-3 w-3" />
        needs depth
      </button>

      {availableAgents.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {availableAgents.map((a) => (
            <button
              key={a}
              onClick={() => onFilterAgentChange(filterAgent === a ? null : a)}
              className={cn(
                "px-2 py-1 text-xs rounded-md border transition-colors whitespace-nowrap",
                filterAgent === a
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {agentLabel(a)}
            </button>
          ))}
        </div>
      )}

      {showViewToggle && (
        <div className="inline-flex items-center rounded-md border border-border bg-muted/50 p-0.5 ml-auto">
          <button
            onClick={() => onViewModeChange("domain")}
            className={cn(
              "px-2.5 py-1 text-xs rounded-sm transition-colors whitespace-nowrap",
              viewMode === "domain"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            by domain
          </button>
          <button
            onClick={() => onViewModeChange("agent")}
            className={cn(
              "px-2.5 py-1 text-xs rounded-sm transition-colors whitespace-nowrap",
              viewMode === "agent"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            by agent
          </button>
        </div>
      )}
    </div>
  );
}
