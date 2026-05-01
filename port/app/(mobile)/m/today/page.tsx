import { Suspense } from "react";
import { queryActivities } from "@/lib/notion/activities";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock } from "lucide-react";

export const revalidate = 60; // refresh every minute

const TYPE_COLORS: Record<string, string> = {
  "email sent": "bg-blue-100 text-blue-700",
  "email received": "bg-blue-50 text-blue-600",
  meeting: "bg-green-100 text-green-700",
  call: "bg-green-50 text-green-600",
  "conference encounter": "bg-purple-100 text-purple-700",
  "intro made": "bg-yellow-100 text-yellow-700",
  "linkedin message": "bg-blue-100 text-blue-700",
  "proposal shared": "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-600",
};

const OUTCOME_COLORS: Record<string, string> = {
  positive: "text-green-700",
  neutral: "text-gray-600",
  "no response": "text-yellow-700",
  declined: "text-red-600",
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

async function TodayFeed() {
  const today = new Date().toISOString().split("T")[0];

  let activities: Awaited<ReturnType<typeof queryActivities>>["data"] = [];
  try {
    const result = await queryActivities(undefined, { pageSize: 50 });
    // Filter to today's activities (by date field or created time)
    activities = result.data.filter((a) => {
      const actDate = a.date?.start ?? a.createdTime.split("T")[0];
      return actDate === today;
    });
  } catch {
    activities = [];
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CalendarDays className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">no activities logged today</p>
        <p className="text-xs mt-1">head to the log tab to add one</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <p className="text-xs text-muted-foreground mb-3">
        {activities.length} {activities.length === 1 ? "activity" : "activities"} logged today
      </p>

      {activities.map((act) => (
        <div key={act.id} className="flex gap-3 py-3 border-b border-border last:border-0">
          <div className="flex flex-col items-center pt-0.5">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] ${TYPE_COLORS[act.type] ?? "bg-gray-100"}`}>
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{act.activity}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{act.type}</Badge>
              {act.outcome && (
                <span className={`text-[10px] ${OUTCOME_COLORS[act.outcome] ?? ""}`}>
                  {act.outcome}
                </span>
              )}
              {act.loggedBy && (
                <span className="text-[10px] text-muted-foreground">
                  by {act.loggedBy}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                {formatTime(act.createdTime)}
              </span>
            </div>
            {act.notes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{act.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MobileTodayPage() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <h1 className="text-lg font-semibold">today</h1>
      <p className="text-xs text-muted-foreground mb-4">{today}</p>
      <Suspense fallback={<div className="text-center py-8 text-muted-foreground text-sm">loading...</div>}>
        <TodayFeed />
      </Suspense>
    </>
  );
}
