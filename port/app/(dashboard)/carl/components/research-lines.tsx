"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, AlertTriangle, ChevronLeft, Circle, CircleDot, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { CarlFinding } from "@/lib/supabase/carl";
import type { CarlCurriculumTopic } from "@/lib/supabase/carl-curriculum";

// deterministic soft colour per domain (hash → hue)
function domainHue(d: string): number {
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) % 360;
  return h;
}

interface Line {
  domain: string;
  findings: CarlFinding[];
  topics: CarlCurriculumTopic[];
}

export function ResearchLines({
  findings,
  curriculum,
  intendedDomains,
}: {
  findings: CarlFinding[];
  curriculum: CarlCurriculumTopic[];
  intendedDomains: string[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const lines = useMemo(() => {
    const map = new Map<string, Line>();
    const ensure = (d: string) => {
      if (!map.has(d)) map.set(d, { domain: d, findings: [], topics: [] });
      return map.get(d)!;
    };
    for (const c of curriculum) ensure(c.domain).topics.push(c);
    for (const f of findings) ensure(f.domain).findings.push(f);
    for (const d of intendedDomains) ensure(d);
    // sort: lines with findings first, then by curriculum size, then name
    return [...map.values()].sort(
      (a, b) =>
        Number(b.findings.length > 0) - Number(a.findings.length > 0) ||
        b.topics.length - a.topics.length ||
        a.domain.localeCompare(b.domain),
    );
  }, [findings, curriculum, intendedDomains]);

  const blindSpots = lines.filter((l) => l.findings.length === 0);

  if (selected) {
    const line = lines.find((l) => l.domain === selected);
    if (line) return <DomainDetail line={line} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      {blindSpots.length > 0 && (
        <Card className="border-l-2 border-l-[#b15043]">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-[#b15043] shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium">{blindSpots.length} blind {blindSpots.length === 1 ? "spot" : "spots"}</span>
                <span className="text-muted-foreground"> — intended research lines with no findings yet: </span>
                {blindSpots.map((l, i) => (
                  <button
                    key={l.domain}
                    onClick={() => setSelected(l.domain)}
                    className="underline-offset-2 hover:underline"
                  >
                    {l.domain}{i < blindSpots.length - 1 ? ", " : ""}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {lines.map((l) => {
          const covered = l.topics.filter((t) => t.status === "covered").length;
          const hue = domainHue(l.domain);
          const latest = l.findings[0];
          const empty = l.findings.length === 0;
          return (
            <button
              key={l.domain}
              onClick={() => setSelected(l.domain)}
              className="text-left rounded-lg border bg-card p-3 space-y-2 hover:shadow-md transition-shadow"
              style={{ borderLeft: `3px solid hsl(${hue} 55% 60%)` }}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: `hsl(${hue} 50% 50%)` }} />
                <span className="text-sm font-medium leading-tight">{l.domain}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
                <Badge variant="secondary" className="text-[10px] py-0">{l.findings.length} findings</Badge>
                {l.topics.length > 0 && (
                  <Badge variant="outline" className="text-[10px] py-0">
                    {covered}/{l.topics.length} topics
                  </Badge>
                )}
              </div>
              <p className={`text-xs leading-relaxed ${empty ? "text-[#b15043] italic" : "text-muted-foreground"}`}>
                {empty ? "no findings yet — a blind spot" : `${latest.title}: ${latest.summary}`.slice(0, 130)}
                {!empty && `${latest.title}: ${latest.summary}`.length > 130 ? "…" : ""}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_ICON = {
  covered: <CheckCircle2 className="h-3 w-3 text-green-600" />,
  "in-progress": <CircleDot className="h-3 w-3 text-yellow-600" />,
  planned: <Circle className="h-3 w-3 text-muted-foreground/50" />,
} as const;

function DomainDetail({ line, onBack }: { line: Line; onBack: () => void }) {
  const hue = domainHue(line.domain);
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> all research lines
      </button>

      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5" style={{ color: `hsl(${hue} 50% 50%)` }} />
        <h3 className="text-lg font-semibold">{line.domain}</h3>
      </div>

      {line.topics.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">curriculum</p>
          {line.topics.map((t) => (
            <div key={t.id} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 shrink-0">{STATUS_ICON[t.status]}</span>
              <div>
                <span className={t.status === "covered" ? "" : "text-foreground"}>{t.topic}</span>
                {t.key_works?.length > 0 && (
                  <span className="text-[11px] text-muted-foreground italic"> — {t.key_works.join("; ")}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          findings ({line.findings.length})
        </p>
        {line.findings.length === 0 ? (
          <p className="text-sm text-[#b15043] italic">
            nothing logged here yet — ask cARL to research this line, or let scheduled study cover it.
          </p>
        ) : (
          line.findings.map((f) => (
            <Card key={f.id} className="border-l-2 border-l-primary/30">
              <CardContent className="pt-3 space-y-1.5">
                <p className="text-sm font-medium leading-tight">{f.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.summary}</p>
                {f.relevance && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">for our work: </span>
                    {f.relevance}
                  </p>
                )}
                {(f.citation || f.source) && (
                  <p className="text-[11px] text-muted-foreground italic">{f.citation || f.source}</p>
                )}
                <p className="text-[10px] text-muted-foreground">logged {formatDate(f.created_at.slice(0, 10))}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
