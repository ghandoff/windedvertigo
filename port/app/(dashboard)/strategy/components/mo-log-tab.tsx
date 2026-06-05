"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CmoDecision } from "@/lib/supabase/cmo";

const WHO_OPTIONS = ["all", "garrett", "maria", "payton", "jamie", "lamis"];

function DecisionCard({ d }: { d: CmoDecision }) {
  const date = new Date(d.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Card className="border-l-2 border-l-primary/30">
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-mono">{date}</span>
          <Badge variant="outline" className="text-xs capitalize">{d.who}</Badge>
          {d.session_type !== "cowork" && (
            <Badge variant="secondary" className="text-xs">{d.session_type}</Badge>
          )}
        </div>
        <p className="text-sm leading-relaxed">{d.summary}</p>
        {d.decisions?.length > 0 && (
          <ul className="space-y-1 mt-1">
            {d.decisions.map((dec, i) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                <span className="text-primary shrink-0">→</span>
                <span>{dec}</span>
              </li>
            ))}
          </ul>
        )}
        {d.tags?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap pt-1">
            {d.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[11px] py-0">{tag}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MoLogTab({ decisions }: { decisions: CmoDecision[] }) {
  const [whoFilter, setWhoFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("");

  const allTags = Array.from(new Set(decisions.flatMap((d) => d.tags ?? []))).sort();

  const filtered = decisions.filter((d) => {
    if (whoFilter !== "all" && d.who !== whoFilter) return false;
    if (tagFilter && !(d.tags ?? []).includes(tagFilter)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {WHO_OPTIONS.map((w) => (
            <button
              key={w}
              onClick={() => setWhoFilter(w)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                whoFilter === w
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {w}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-background text-muted-foreground"
          >
            <option value="">all tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {decisions.length === 0
            ? "no conversations recorded yet. Mo will write here after each session."
            : "no conversations match the current filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DecisionCard key={d.id} d={d} />
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground pt-2">
        {filtered.length} of {decisions.length} conversations · logged by Mo during each session
      </p>
    </div>
  );
}
