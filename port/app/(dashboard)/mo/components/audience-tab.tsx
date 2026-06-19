/**
 * audience-tab.tsx — 6 audience persona cards.
 *
 * Each card: name + priority badge + who-they-are + pain points (top 3)
 * + where they engage (chips) + w.v products that map (chips).
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AUDIENCE_SEGMENTS } from "@/lib/strategy-data";

export function AudienceTab() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-[#273248]">audience segments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AUDIENCE_SEGMENTS.map((seg) => (
            <div
              key={seg.id}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-tight">
                  {seg.name}
                </h3>
                <Badge
                  variant="outline"
                  className={`text-[9px] tabular-nums shrink-0 uppercase tracking-wider ${
                    seg.priority === "high"
                      ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                      : "border-amber-300 text-amber-700 bg-amber-50"
                  }`}
                >
                  {seg.priority} priority
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {seg.whoTheyAre}
              </p>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  pain points
                </p>
                <ul className="space-y-0.5">
                  {seg.painPoints.map((p) => (
                    <li
                      key={p}
                      className="text-[11px] flex items-start gap-1.5 text-foreground"
                    >
                      <span className="text-[#b15043] mt-0.5 shrink-0">·</span>
                      <span className="leading-snug">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  where they engage
                </p>
                <div className="flex flex-wrap gap-1">
                  {seg.whereTheyEngage.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-border/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  w.v products that map
                </p>
                <div className="flex flex-wrap gap-1">
                  {seg.productsThatMap.map((p) => (
                    <Badge
                      key={p.name}
                      variant="outline"
                      className="text-[10px] border-[#43b187]/40 text-[#43b187] bg-[#43b187]/5"
                    >
                      {p.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
