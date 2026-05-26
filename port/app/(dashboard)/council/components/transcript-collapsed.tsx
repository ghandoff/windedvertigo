"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, FileText, Search } from "lucide-react";
import type { TranscriptSegment } from "@/lib/supabase/meeting-transcripts";

export interface TranscriptCollapsedProps {
  segments: TranscriptSegment[];
}

/**
 * Collapsed transcript with inline search.
 *
 * Default: hidden behind a disclosure (transcripts are warm-blanket reads,
 * not primary content). When expanded, shows a search box that filters
 * segments client-side. Per-segment formatting kept minimal: timestamp +
 * speaker label + text.
 */
export function TranscriptCollapsed({ segments }: TranscriptCollapsedProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return segments;
    const q = query.toLowerCase();
    return segments.filter(
      (s) =>
        s.text.toLowerCase().includes(q) ||
        (s.speaker && s.speaker.toLowerCase().includes(q)),
    );
  }, [segments, query]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left w-full"
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <CardTitle className="text-sm text-[#273248] inline-flex items-center gap-2">
            <FileText className="h-4 w-4" />
            transcript ({segments.length} segments)
          </CardTitle>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-3">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="search the transcript…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto text-xs">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground py-2">no matches.</p>
            ) : (
              filtered.map((s, i) => (
                <div
                  key={i}
                  className="flex gap-3 py-1 border-b border-border/20 last:border-0"
                >
                  <span className="text-muted-foreground tabular-nums shrink-0 w-16">
                    {typeof s.ts === "number" ? `${Math.floor(s.ts / 60)}:${String(Math.floor(s.ts % 60)).padStart(2, "0")}` : s.ts}
                  </span>
                  {s.speaker && (
                    <span className="text-[#5872cb] font-medium shrink-0 w-20 truncate">
                      {s.speaker}
                    </span>
                  )}
                  <span className="text-[#273248] flex-1">{s.text}</span>
                </div>
              ))
            )}
          </div>
          {query.trim() && (
            <p className="text-[10px] text-muted-foreground">
              showing {filtered.length} / {segments.length} segments matching &ldquo;{query}&rdquo;
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
