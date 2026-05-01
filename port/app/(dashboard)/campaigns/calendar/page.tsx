import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { queryCampaigns } from "@/lib/notion/campaigns";
import { queryEvents } from "@/lib/notion/events";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const revalidate = 300;

const TYPE_COLORS: Record<string, string> = {
  "event-based": "bg-blue-500",
  "recurring cadence": "bg-purple-500",
  "one-off blast": "bg-orange-500",
};

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Pad start to Monday
  const startPad = (firstDay.getDay() + 6) % 7; // Monday = 0
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push(d);
  }

  // Month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  // Pad end to fill 6 rows
  while (days.length < 42) {
    days.push(new Date(year, month + 1, days.length - lastDay.getDate() - startPad + 1));
  }

  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isInRange(day: Date, start: string, end?: string | null): boolean {
  const d = day.getTime();
  const s = new Date(start).getTime();
  if (end) {
    return d >= s && d <= new Date(end).getTime();
  }
  return isSameDay(day, new Date(start));
}

export default async function CampaignCalendarPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = getMonthDays(year, month);
  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toLowerCase();

  const { data: campaigns } = await queryCampaigns(undefined, { pageSize: 50 });
  const activeCampaigns = campaigns.filter((c) => c.status === "active" || c.status === "draft");

  const { data: events } = await queryEvents({ upcoming: true }, { pageSize: 20 });

  const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  return (
    <>
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        back to campaigns
      </Link>

      <PageHeader title={`campaign calendar — ${monthName}`} />

      {/* legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {activeCampaigns.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${TYPE_COLORS[c.type] ?? "bg-gray-400"}`} />
            <span className="text-xs">{c.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-xs">events</span>
        </div>
      </div>

      {/* calendar grid */}
      <Card>
        <CardContent className="p-2">
          {/* header */}
          <div className="grid grid-cols-7 mb-1">
            {weekdays.map((d) => (
              <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">
                {d}
              </div>
            ))}
          </div>

          {/* days */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const isCurrentMonth = day.getMonth() === month;
              const isToday = isSameDay(day, now);

              // Find campaigns active on this day
              const dayCampaigns = activeCampaigns.filter((c) => {
                if (!c.startDate?.start) return false;
                return isInRange(day, c.startDate.start, c.endDate?.start);
              });

              // Find events on this day
              const dayEvents = events.filter((e) => {
                if (!e.eventDates?.start) return false;
                return isInRange(day, e.eventDates.start, e.eventDates.end);
              });

              return (
                <div
                  key={i}
                  className={`min-h-[60px] border border-border/30 p-1 ${
                    isCurrentMonth ? "" : "opacity-30"
                  } ${isToday ? "bg-accent/10 ring-1 ring-accent/30" : ""}`}
                >
                  <span className={`text-[10px] ${isToday ? "font-bold text-accent" : "text-muted-foreground"}`}>
                    {day.getDate()}
                  </span>
                  <div className="space-y-0.5 mt-0.5">
                    {dayCampaigns.map((c) => (
                      <div
                        key={c.id}
                        className={`h-1.5 rounded-full ${TYPE_COLORS[c.type] ?? "bg-gray-400"}`}
                        title={c.name}
                      />
                    ))}
                    {dayEvents.map((e) => (
                      <div
                        key={e.id}
                        className="text-[8px] text-red-600 truncate leading-tight"
                        title={e.event}
                      >
                        {e.event}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
