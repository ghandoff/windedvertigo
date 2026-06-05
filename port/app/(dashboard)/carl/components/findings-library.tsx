"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BookOpen } from "lucide-react";
import type { CarlFinding } from "@/lib/supabase/carl";

function FindingCard({ f }: { f: CarlFinding }) {
  return (
    <Card className="border-l-2 border-l-primary/30">
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <BookOpen className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm font-medium leading-tight">{f.title}</p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">{f.domain}</Badge>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{f.summary}</p>

        {f.relevance && (
          <p className="text-xs text-foreground/80">
            <span className="text-muted-foreground">for our work: </span>
            {f.relevance}
          </p>
        )}

        {(f.source || f.citation) && (
          <p className="text-[11px] text-muted-foreground italic">
            {f.citation || f.source}
          </p>
        )}

        {f.tags?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap pt-1">
            {f.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[11px] py-0">{tag}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FindingsLibrary({ findings }: { findings: CarlFinding[] }) {
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const domains = ["all", ...Array.from(new Set(findings.map((f) => f.domain))).sort()];
  const allTags = Array.from(new Set(findings.flatMap((f) => f.tags ?? []))).sort();

  const q = search.trim().toLowerCase();
  const filtered = findings.filter((f) => {
    if (domainFilter !== "all" && f.domain !== domainFilter) return false;
    if (tagFilter && !(f.tags ?? []).includes(tagFilter)) return false;
    if (q && !`${f.title} ${f.summary}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {domains.map((d) => (
            <button
              key={d}
              onClick={() => setDomainFilter(d)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                domainFilter === d
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {d}
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
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search findings…"
          className="h-8 w-48 text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {findings.length === 0
            ? "no findings yet. cARL fills this library through scheduled study and conversations."
            : "no findings match the current filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => (
            <FindingCard key={f.id} f={f} />
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground pt-2">
        {filtered.length} of {findings.length} findings
      </p>
    </div>
  );
}
