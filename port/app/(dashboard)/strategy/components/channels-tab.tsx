/**
 * channels-tab.tsx — 6-channel grid from channels.md.
 *
 * Each card: icon + name + purpose + cadence + tone + owner + KPIs.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Briefcase,
  Camera,
  AtSign,
  Mail,
  FileText,
  Calendar,
} from "lucide-react";
import { CHANNELS } from "@/lib/strategy-data";

const ICON_MAP = {
  Briefcase,
  Camera,
  AtSign,
  Mail,
  FileText,
  Calendar,
} as const;

export function ChannelsTab() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-[#273248]">channel strategy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CHANNELS.map((channel) => {
            const Icon = ICON_MAP[channel.iconName];
            return (
              <div
                key={channel.id}
                className="rounded-lg border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 rounded-md bg-muted p-2">
                    <Icon className="h-4 w-4 text-[#273248]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{channel.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {channel.purpose}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <Row label="cadence" value={channel.cadence} />
                  <Row label="tone" value={channel.tone} />
                  <Row label="owner" value={channel.ownerLabel} />
                </div>

                <div className="pt-2 border-t border-border space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    kpis
                  </p>
                  {channel.kpis.map((k) => (
                    <p
                      key={k}
                      className="text-[11px] text-foreground leading-snug"
                    >
                      <span className="text-[#b15043] mr-1">·</span>
                      {k}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted-foreground uppercase tracking-wider text-[9px] shrink-0 w-14">
        {label}
      </span>
      <span className="text-foreground leading-snug">{value}</span>
    </div>
  );
}

