import type { TimelineGroup } from "@/lib/pam/project-timeline";

const DAY = 86_400_000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function ProjectTimeline({ groups }: { groups: TimelineGroup[] }) {
  const all = groups.flatMap((g) => g.items);
  const starts = all.map((i) => (i.start ? Date.parse(i.start) : NaN)).filter((n) => !Number.isNaN(n));
  const ends = all
    .map((i) => (i.end ? Date.parse(i.end) : i.start ? Date.parse(i.start) + 21 * DAY : NaN))
    .filter((n) => !Number.isNaN(n));

  if (groups.length === 0 || starts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">no active deliverables with dates yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          deliverables appear here from each programme&apos;s milestones, plus near-term rfp deadlines
        </p>
      </div>
    );
  }

  const rawS = Math.min(...starts);
  const rawE = Math.max(...ends, rawS + 60 * DAY);
  const pad = (rawE - rawS) * 0.04;
  const winS = rawS - pad;
  const winE = rawE + pad;
  const range = winE - winS || DAY;
  const pct = (t: number) => ((t - winS) / range * 100);
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const nowLeft = clamp(pct(Date.now()));

  // quarter ticks
  const ticks: { label: string; left: number }[] = [];
  const d = new Date(winS);
  d.setUTCDate(1);
  while (d.getUTCMonth() % 3 !== 0) d.setUTCMonth(d.getUTCMonth() + 1);
  while (d.getTime() <= winE) {
    const left = pct(d.getTime());
    if (left >= -2 && left <= 102) {
      const m = d.getUTCMonth();
      ticks.push({ label: m === 0 ? `jan '${String(d.getUTCFullYear()).slice(2)}` : MONTHS[m], left: clamp(left) });
    }
    d.setUTCMonth(d.getUTCMonth() + 3);
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2">deliverables in flight, coloured by programme</p>

      {/* axis */}
      <div className="flex">
        <div className="w-[172px] shrink-0" />
        <div className="relative flex-1 h-4 text-[10px] text-muted-foreground/70">
          {ticks.map((t, i) => (
            <span key={i} className="absolute" style={{ left: `${t.left}%` }}>{t.label}</span>
          ))}
          <span className="absolute text-muted-foreground" style={{ left: `${nowLeft}%` }}>now</span>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.program}>
          <div className="flex items-center gap-2 pt-2 pb-1 border-t border-border/60">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: g.mark }} />
            <span className="text-xs font-medium capitalize">{g.program}</span>
            <span className="text-[10px] text-muted-foreground">{g.tier}</span>
          </div>
          {g.items.map((it, i) => {
            const s = it.start ? Date.parse(it.start) : null;
            const e = it.end ? Date.parse(it.end) : null;
            return (
              <div key={i} className="flex items-center">
                <div className="w-[172px] shrink-0 text-[11px] text-muted-foreground pl-4 pr-2 py-0.5 truncate" title={it.name}>
                  {it.name}
                </div>
                <div className="relative flex-1 h-[18px]">
                  {s !== null && e !== null ? (
                    <div
                      className="absolute top-1 h-2.5 rounded-full"
                      style={{ left: `${clamp(pct(s))}%`, width: `${Math.max(1.5, clamp(pct(e)) - clamp(pct(s)))}%`, background: g.fill }}
                    />
                  ) : s !== null ? (
                    <div
                      title="milestone"
                      className="absolute top-1.5"
                      style={{ left: `${clamp(pct(s))}%`, width: 10, height: 10, marginLeft: -5, transform: "rotate(45deg)", background: g.mark }}
                    />
                  ) : null}
                  <div className="absolute -top-0.5 bottom-[-2px] w-px bg-muted-foreground/50" style={{ left: `${nowLeft}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
