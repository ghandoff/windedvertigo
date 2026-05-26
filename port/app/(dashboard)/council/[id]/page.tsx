/**
 * /council/[id] — single meeting detail page (W1 follow-up).
 *
 * Shows summary + action items + decisions (when populated) + collapsed
 * transcript. Closes the loop on the Recent tab links that previously 404'd.
 *
 * No pretty transcript rendering — per the design conversation, transcripts
 * are "warm blanket" reading, not primary content. We show them collapsed
 * with a basic text view + the suggestion to ask wv-claw for cross-meeting
 * lookups.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Mic, Users as UsersIcon, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/app/components/page-header";
import { getMeeting } from "@/lib/supabase/meetings";
import { listActionsForMeeting } from "@/lib/supabase/meeting-action-items";
import { getTranscriptForMeeting } from "@/lib/supabase/meeting-transcripts";
import { TranscriptCollapsed } from "../components/transcript-collapsed";
import { ActionStatusToggle } from "../components/action-status-toggle";
import { PromoteActionButton } from "../components/promote-action-button";
import { VisibilityToggle } from "../components/visibility-toggle";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "meeting — the port",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function priorityClass(p: string | null): string {
  if (p === "high") return "text-[#b15043] border-[#b15043]/30 bg-[#b15043]/5";
  if (p === "medium") return "text-[#cb7858] border-[#cb7858]/30 bg-[#cb7858]/5";
  return "text-muted-foreground border-muted/30 bg-muted/5";
}

function statusClass(s: string): string {
  if (s === "done") return "text-[#43b187] bg-[#43b187]/10";
  if (s === "cancelled") return "text-muted-foreground bg-muted/20 line-through";
  return "text-[#273248] bg-[#5872cb]/10";
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [meeting, actions, transcript, session] = await Promise.all([
    getMeeting(id),
    listActionsForMeeting(id),
    getTranscriptForMeeting(id),
    auth(),
  ]);

  if (!meeting) notFound();
  const viewerEmail = session?.user?.email?.toLowerCase() ?? null;

  // Enforce visibility at the detail page too — direct URL shouldn't bypass
  // the list filter. If the meeting is private and the viewer isn't the
  // owner, treat as not-found.
  if (meeting.visibility === "private" && meeting.ownerEmail !== viewerEmail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/council"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#b15043]"
      >
        <ChevronLeft className="h-3 w-3" />
        back to council
      </Link>

      <PageHeader
        title={meeting.title}
        description={`${formatDateTime(meeting.startedAt ?? meeting.createdAt)} · ${meeting.capturedVia}`}
      />

      {/* Meta strip */}
      <Card>
        <CardContent className="py-3 space-y-2">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5" />
              {meeting.capturedVia}
            </span>
            {meeting.organizerEmail && (
              <span>organizer: <span className="text-[#273248]">{meeting.organizerEmail}</span></span>
            )}
            {meeting.attendeeEmails.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <UsersIcon className="h-3.5 w-3.5" />
                {meeting.attendeeEmails.length} attendee{meeting.attendeeEmails.length === 1 ? "" : "s"}
              </span>
            )}
            {meeting.gcalEventId && (
              <span className="text-[10px] tabular-nums">gcal: {meeting.gcalEventId.slice(0, 12)}…</span>
            )}
          </div>
          <VisibilityToggle
            meetingId={meeting.id}
            initialVisibility={meeting.visibility}
            initialOwnerEmail={meeting.ownerEmail}
            viewerEmail={viewerEmail}
          />
        </CardContent>
      </Card>

      {/* Summary */}
      {meeting.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#273248] inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#43b187]" />
              summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-[#273248] leading-relaxed whitespace-pre-line">
              {meeting.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-[#273248]">
            action items ({actions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {actions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">none extracted.</p>
          ) : (
            <ul className="space-y-2">
              {actions.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#273248]">{a.title}</p>
                    {a.context && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{a.context}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      {a.ownerName && (
                        <span>
                          owner: <span className="text-[#273248]">{a.ownerName}</span>
                          {a.ownerEmail && <span className="opacity-60"> ({a.ownerEmail})</span>}
                        </span>
                      )}
                      {a.deadline && (
                        <span>
                          due: <span className="text-[#273248] tabular-nums">{a.deadline}</span>
                        </span>
                      )}
                      {a.type && <span>type: {a.type}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {a.priority && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityClass(a.priority)}`}>
                        {a.priority}
                      </span>
                    )}
                    <ActionStatusToggle actionId={a.id} initialStatus={a.status} compact />
                    <PromoteActionButton actionId={a.id} initialWorkItemId={a.workItemId} compact />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Transcript (collapsed; warm-blanket use) */}
      {transcript && transcript.segments.length > 0 && (
        <TranscriptCollapsed segments={transcript.segments} />
      )}
    </div>
  );
}
