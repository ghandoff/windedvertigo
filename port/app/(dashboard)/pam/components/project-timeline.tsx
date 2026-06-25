"use client";

import { useState, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineProject } from "@/lib/pam/project-timeline";

const DAY = 86_400_000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** fuzzy project-status → bar colours (light fill + same-family elapsed/text). */
function statusColour(s: string): { fill: string; elapsed: string; text: string } {
  const t = s.toLowerCase();
  if (/(done|complete|shipped|live)/.test(t)) return { fill: "#9FE1CB", elapsed: "#1D9E75", text: "#0F6E56" };
  if (/(block|risk|hold|stuck)/.test(t)) return { fill: "#FAC775", elapsed: "#BA7517", text: "#854F0B" };
  if (/(plan|upcoming|backlog|idea|proposed)/.test(t)) return { fill: "#D3D1C7", elapsed: "#888780", text: "#5F5E5A" };
  return { fill: "#85B7EB", elapsed: "#185FA5", text: "#185FA5" }; // active / in-progress
}

export function ProjectTimeline({ projects }: { projects: TimelineProject[] }) {
  const [open, setOpen] = useState<string | null>(null);

  const layout = useMemo(() => {
    if (projects.length === 0) return null;
    const starts = projects.map((p) => Date.parse(p.start)).filter((n) => !Number.isNaN(n));
    const ends = projects.map((p) => Date.parse(p.end ?? p.start) + (p.end ? 0 : 14 * DAY)).filter((n) => !Number.isNaN(n));
    if (starts.length === 0) return null;
    const rawStart = Math.min(...starts);
    const rawEnd = Math.max(...ends, rawStart + 30 * DAY);
    const pad = (rawEnd - rawStart) * 0.04;
    const winStart = rawStart - pad;
    const winEnd = rawEnd + pad;
    const range = winEnd - winStart || DAY;
    const pct = (t: number) => ((t - winStart) / range) * 100;

    // month ticks
    const ticks: { label: string; left: number }[] = [];
    const d = new Date(winStart);
    d.setUTCDate(1);
    while (d.getTime() <= winEnd) {
      const left = pct(d.getTime());
      if (left >= 0 && left <= 100) ticks.push({ label: MONTHS[d.getUTCMonth()], left });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    const nowLeft = Math.max(0, Math.min(100, pct(Date.now())));

    const bars = projects.map((p) => {
      const s = Date.parse(p.start);
      const e = p.end ? Date.parse(p.end) : s + 14 * DAY;
      const left = pct(s);
      const width = Math.max(2, pct(e) - left);
      const elapsedFrac = Date.now() > s ? Math.min(1, (Math.min(Date.now(), e) - s) / (e - s || DAY)) : 0;
      return { ...p, left, width, elapsedFrac, colour: statusColour(p.status) };
    });

    return { ticks, nowLeft, bars };
  }, [projects]);

  if (!layout) {
    return (
      <div className="rounded-lg border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">no projects with timelines yet</p>
        <p className="text-xs text-muted-foreground mt-1">projects appear here once they have a start date in notion</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2">projects in flight · tap a bar for milestones</p>

      {/* axis */}
      <div className="flex">
        <div className="w-36 shrink-0" />
        <div className="relative flex-1 h-4 text-[10px] text-muted-foreground/70">
          {layout.ticks.map((t, i) => (
            <span key={i} className="absolute" style={{ left: `${t.left}%` }}>
              {t.label}
            </span>
          ))}
          <span className="absolute text-muted-foreground" style={{ left: `${layout.nowLeft}%` }}>
            now
          </span>
        </div>
      </div>

      {layout.bars.map((b) => (
        <div key={b.id}>
          <button
            type="button"
            onClick={() => setOpen(open === b.id ? null : b.id)}
            className="flex items-center w-full py-1.5 border-t border-border/60 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="w-36 shrink-0 flex items-center gap-1 pr-2 min-w-0">
              <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform shrink-0", open === b.id && "rotate-90")} />
              <span className="text-xs truncate">{b.name}</span>
            </div>
            <div className="relative flex-1 h-5">
              <div
                className="absolute top-0.5 h-4 rounded-full overflow-hidden"
                style={{ left: `${b.left}%`, width: `${b.width}%`, background: b.colour.fill }}
              >
                {b.elapsedFrac > 0 && (
                  <div className="h-full" style={{ width: `${Math.round(b.elapsedFrac * 100)}%`, background: b.colour.elapsed }} />
                )}
              </div>
              <div className="absolute -top-0.5 bottom-[-2px] w-px bg-muted-foreground/60" style={{ left: `${layout.nowLeft}%` }} />
            </div>
          </button>
          {open === b.id && (
            <div className="pl-36 pb-2 text-[11px] text-muted-foreground">
              <span style={{ color: b.colour.text }}>{b.status}</span>
              {" · "}
              {b.milestones.length === 0 ? (
                "no milestones"
              ) : (
                b.milestones.map((m, i) => (
                  <span key={i} className="inline-block bg-muted/60 rounded-full px-2 py-0.5 mr-1.5 mt-1">
                    {m.name}
                    {m.date ? ` · ${m.date.slice(5)}` : ""}
                  </span>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
