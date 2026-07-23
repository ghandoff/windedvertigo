"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineGroup } from "@/lib/pam/project-timeline";

const DAY = 86_400_000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const LABEL_W = 168;

// px-per-day per zoom level — tuned so roughly that period fills the ~440px pane.
const PPD: Record<string, number> = { week: 55, month: 15, quarter: 5, year: 1.2 };
type Zoom = keyof typeof PPD;
const ZOOMS: Zoom[] = ["week", "month", "quarter", "year"];

export function ProjectTimeline({ groups }: { groups: TimelineGroup[] }) {
  const [zoom, setZoom] = useState<Zoom>("quarter");
  const scrollRef = useRef<HTMLDivElement>(null);

  const model = useMemo(() => {
    const all = groups.flatMap((g) => g.items);
    const starts = all.map((i) => (i.start ? Date.parse(i.start) : NaN)).filter((n) => !Number.isNaN(n));
    if (starts.length === 0) return null;
    const ends = all
      .map((i) => (i.end ? Date.parse(i.end) : i.start ? Date.parse(i.start) + 21 * DAY : NaN))
      .filter((n) => !Number.isNaN(n));
    const minS = Math.min(...starts);
    const winStartD = new Date(minS);
    winStartD.setUTCDate(1);
    const winS = winStartD.getTime();
    const winE = Math.max(...ends, winS + 60 * DAY);
    return { winS, winE };
  }, [groups]);

  const ppd = PPD[zoom];
  const trackW = model ? ((model.winE - model.winS) / DAY) * ppd : 0;
  const xOf = (t: number) => (model ? ((t - model.winS) / DAY) * ppd : 0);
  const nowX = xOf(Date.now());

  // centre the view near "now" whenever the zoom (and so the scale) changes
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, nowX - 90);
  }, [zoom, nowX]);

  const ticks = useMemo(() => {
    if (!model) return [];
    const out: { x: number; label: string }[] = [];
    if (zoom === "week" || zoom === "month") {
      const gap = zoom === "week" ? 1 : 7;
      for (let t = model.winS; t <= model.winE; t += gap * DAY) {
        const d = new Date(t);
        out.push({ x: xOf(t), label: zoom === "week" ? `${d.getUTCDate()}` : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` });
      }
    } else {
      const d = new Date(model.winS);
      d.setUTCDate(1);
      if (zoom === "year") while (d.getUTCMonth() % 3 !== 0) d.setUTCMonth(d.getUTCMonth() + 1);
      const step = zoom === "quarter" ? 1 : 3;
      while (d.getTime() <= model.winE) {
        out.push({
          x: xOf(d.getTime()),
          label: d.getUTCMonth() === 0 ? `${MONTHS[0]} '${String(d.getUTCFullYear()).slice(2)}` : MONTHS[d.getUTCMonth()],
        });
        d.setUTCMonth(d.getUTCMonth() + step);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, zoom, ppd]);

  if (!model) {
    return (
      <div className="rounded-lg border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">no active deliverables with dates yet</p>
        <p className="text-xs text-muted-foreground mt-1">deliverables come from each programme&apos;s milestones, plus near-term rfp deadlines</p>
      </div>
    );
  }

  const rowW = LABEL_W + trackW;
  const stickyLabel = "sticky left-0 z-10 bg-background shrink-0";
  const NowLine = () => (
    <div className="absolute -top-0.5 bottom-[-2px] w-px bg-muted-foreground/50" style={{ left: nowX }} />
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">deliverables in flight, coloured by programme</p>
        <div className="inline-flex items-center rounded-md border border-border bg-muted/50 p-0.5">
          {ZOOMS.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-sm transition-colors capitalize",
                zoom === z ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* tier legend — the logic behind the chart, on demand */}
      <details className="rounded-md border border-border bg-muted/30">
        <summary className="cursor-pointer select-none px-2.5 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5 [&::-webkit-details-marker]:hidden">
          <Info className="h-3 w-3" /> how this reads · the tiers
        </summary>
        <div className="px-2.5 pb-2.5 pt-1 space-y-2 text-[11px] text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">programmes</span> are the colour &amp; grouping (the portfolio level — contracts &amp; studios) ·{" "}
            <span className="font-medium text-foreground">deliverables</span> are the rows (milestones with dates) ·{" "}
            the <span className="font-medium" style={{ color: "#BA7517" }}>amber lane</span> is the rfp pipeline ·{" "}
            day-to-day <span className="font-medium text-foreground">tasks</span> live in the whirlpool tab.
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {groups.map((g) => (
              <span key={g.program} className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: g.mark }} />
                <span className="capitalize">{g.program}</span>
                <span className="text-muted-foreground/60">{g.tier}</span>
              </span>
            ))}
          </div>
        </div>
      </details>

      <div ref={scrollRef} className="overflow-x-auto">
        {/* axis */}
        <div className="flex" style={{ width: rowW }}>
          <div className={stickyLabel} style={{ width: LABEL_W }} />
          <div className="relative h-4 text-[10px] text-muted-foreground/70" style={{ width: trackW }}>
            {ticks.map((t, i) => (
              <span key={i} className="absolute whitespace-nowrap" style={{ left: t.x }}>{t.label}</span>
            ))}
            <span className="absolute text-muted-foreground" style={{ left: nowX }}>now</span>
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.program} style={{ width: rowW }}>
            <div className="flex">
              <div className={cn(stickyLabel, "flex items-center gap-2 pt-2 pb-1")} style={{ width: LABEL_W }}>
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: g.mark }} />
                <span className="text-xs font-medium capitalize truncate">{g.program}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{g.tier}</span>
              </div>
              <div className="relative" style={{ width: trackW }}><NowLine /></div>
            </div>
            {g.items.map((it, i) => {
              const s = it.start ? Date.parse(it.start) : null;
              const e = it.end ? Date.parse(it.end) : null;
              const tip = `${g.program} · ${it.name}${it.start ? ` · ${it.start}${it.end ? ` → ${it.end}` : ""}` : ""}`;
              return (
                <div key={i} className="flex">
                  <div className={cn(stickyLabel, "text-[11px] text-muted-foreground pl-4 pr-2 py-0.5 truncate")} style={{ width: LABEL_W }} title={tip}>
                    {it.name}
                  </div>
                  <div className="relative h-[18px]" style={{ width: trackW }}>
                    {s !== null && e !== null ? (
                      <div title={tip} className="absolute top-1 h-2.5 rounded-full cursor-default" style={{ left: xOf(s), width: Math.max(4, xOf(e) - xOf(s)), background: g.fill }} />
                    ) : s !== null ? (
                      <div title={tip} className="absolute top-1.5 cursor-default" style={{ left: xOf(s), width: 10, height: 10, marginLeft: -5, transform: "rotate(45deg)", background: g.mark }} />
                    ) : null}
                    <NowLine />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">scroll sideways to look back or ahead · zoom with week / month / quarter / year</p>
    </div>
  );
}
