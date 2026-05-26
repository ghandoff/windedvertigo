/**
 * recent-tab.tsx — meetings list as summary cards.
 *
 * Despite the file name, this component renders both the "upcoming" and
 * "recent" tab content — the only difference is the empty-state copy and
 * the footer label. The caller passes `mode` to pick which copy to show;
 * sort order is the caller's responsibility (set by which list function
 * they used to fetch).
 *
 * Server component. Each card shows: title, started_at, captured_via badge,
 * summary, and a count of action items. Click → detail page.
 */

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Mic, FileText, Sparkles, Users as UsersIcon, Calendar, Lock } from "lucide-react";
import { listActionsForMeeting } from "@/lib/supabase/meeting-action-items";
import type { Meeting } from "@/lib/supabase/meetings";

export interface RecentTabProps {
  meetings: Meeting[];
  /** "upcoming" = future meetings (sorted ASC); "recent" = past (sorted DESC). */
  mode?: "upcoming" | "recent";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Hour:minute (e.g. "12:00 PM"). Used to disambiguate multiple same-day
 *  meetings — e.g. the back-to-back Session 5 recordings stacked at the
 *  same date but different start times. */
function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function capturedViaLabel(via: Meeting["capturedVia"]): string {
  const labels: Record<Meeting["capturedVia"], string> = {
    "in-browser":    "in-browser",
    "google-meet":   "google meet",
    "plaud":         "plaud",
    "recall":        "recall.ai",
    "manual":        "manual",
    "notion-legacy": "notion AI (trial)",
  };
  return labels[via];
}

export async function RecentTab({ meetings, mode = "recent" }: RecentTabProps) {
  if (meetings.length === 0) {
    const emptyCopy =
      mode === "upcoming"
        ? "no meetings on the calendar in the next 7 days. the gcal-sync cron runs hourly and will pre-create Council records as new events land on your calendar."
        : "no past meetings ingested yet. the meeting-notes ingest cron runs every 4 hours and will pick up Notion AI meeting notes once they're written.";
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {emptyCopy}
        </CardContent>
      </Card>
    );
  }

  // Fetch action counts per meeting in parallel.
  const actionCountsByMeeting = await Promise.all(
    meetings.map(async (m) => ({
      meetingId: m.id,
      actions: await listActionsForMeeting(m.id),
    })),
  );
  const countMap = new Map(
    actionCountsByMeeting.map((x) => [x.meetingId, x.actions.length]),
  );

  return (
    <div className="space-y-3">
      {meetings.map((m) => (
        <Card key={m.id} className="hover:border-[#cb7858] transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/council/${m.id}`}
                  className="text-sm font-medium text-[#273248] hover:text-[#b15043] truncate block"
                >
                  {m.title}
                </Link>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">
                    {formatDate(m.startedAt ?? m.createdAt)}
                    {m.startedAt && (
                      <span className="ml-1.5 text-muted-foreground/70">· {formatTime(m.startedAt)}</span>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Mic className="h-3 w-3" />
                    {capturedViaLabel(m.capturedVia)}
                  </span>
                  {m.attendeeEmails.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <UsersIcon className="h-3 w-3" />
                      {m.attendeeEmails.length} attendee{m.attendeeEmails.length === 1 ? "" : "s"}
                    </span>
                  )}
                  {m.visibility === "private" && (
                    <span className="inline-flex items-center gap-1 text-[#cb7858]" title="only you can see this meeting at /council">
                      <Lock className="h-3 w-3" />
                      private
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs text-[#43b187] font-medium inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {countMap.get(m.id) ?? 0} action{(countMap.get(m.id) ?? 0) === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </CardHeader>
          {m.summary && (
            <CardContent className="pt-1">
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {m.summary}
              </p>
            </CardContent>
          )}
        </Card>
      ))}
      <p className="text-[10px] text-muted-foreground pt-2">
        {mode === "upcoming" ? (
          <>
            <Calendar className="inline h-3 w-3 mr-1" />
            showing {meetings.length} meeting{meetings.length === 1 ? "" : "s"} in the next 7 days, soonest first. URLs to this Council page are appended to each event description in your Google Calendar.
          </>
        ) : (
          <>
            <FileText className="inline h-3 w-3 mr-1" />
            showing latest {meetings.length}. transcripts available on detail pages.
          </>
        )}
      </p>
    </div>
  );
}
