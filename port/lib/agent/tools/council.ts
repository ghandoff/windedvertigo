/**
 * Council tools for wv-claw (W4 — partial, wv-claw query side only).
 *
 * Exposes the Council Supabase data through the agent so users can DM
 * wv-claw with things like "what meetings did we have this week?" or
 * "what are my open action items?" without leaving Slack.
 *
 * Read-only for this slice. Write tools (draftMeetingAgenda, markActionDone)
 * land alongside the GCal integration in the rest of W4.
 */

import { listRecentMeetings } from "@/lib/supabase/meetings";
import {
  listOpenActionsForOwner,
  listActionsForMeeting,
  type MeetingActionItem,
} from "@/lib/supabase/meeting-action-items";

export interface QueryMeetingsInput {
  limit?: number;
}

export async function queryMeetingsTool(input: QueryMeetingsInput): Promise<{
  meetings: Array<{
    id: string;
    title: string;
    summary: string | null;
    startedAt: string | null;
    capturedVia: string;
    attendeeCount: number;
    actionCount: number;
  }>;
}> {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 25);
  const meetings = await listRecentMeetings(limit);

  // Compute action counts in parallel.
  const withCounts = await Promise.all(
    meetings.map(async (m) => {
      const actions = await listActionsForMeeting(m.id);
      return {
        id:            m.id,
        title:         m.title,
        summary:       m.summary,
        startedAt:     m.startedAt,
        capturedVia:   m.capturedVia,
        attendeeCount: m.attendeeEmails.length,
        actionCount:   actions.length,
      };
    }),
  );

  return { meetings: withCounts };
}

export interface GetMeetingActionsInput {
  ownerEmail?: string;
  meetingId?: string;
  status?: "open" | "done" | "cancelled";
}

export async function getMeetingActionsTool(input: GetMeetingActionsInput): Promise<{
  actions: Array<{
    id: string;
    meetingId: string;
    title: string;
    ownerEmail: string | null;
    ownerName: string | null;
    deadline: string | null;
    priority: string | null;
    type: string | null;
    context: string | null;
    status: string;
  }>;
  scopeNote?: string;
}> {
  let actions: MeetingActionItem[] = [];
  let scopeNote: string | undefined;

  if (input.meetingId) {
    actions = await listActionsForMeeting(input.meetingId);
    if (input.status) {
      actions = actions.filter((a) => a.status === input.status);
    }
    scopeNote = `actions for meeting ${input.meetingId}`;
  } else if (input.ownerEmail) {
    // listOpenActionsForOwner only returns OPEN. If a different status is
    // requested, fall back to listing the most-recent meetings and filtering
    // — but for the common "my open actions" case, the indexed path wins.
    if (input.status && input.status !== "open") {
      // Build a broader view: get recent meetings + all their actions, filter.
      const meetings = await listRecentMeetings(50);
      const all = (await Promise.all(meetings.map((m) => listActionsForMeeting(m.id)))).flat();
      actions = all.filter(
        (a) =>
          a.ownerEmail === input.ownerEmail!.toLowerCase() &&
          a.status === input.status,
      );
    } else {
      actions = await listOpenActionsForOwner(input.ownerEmail);
    }
    scopeNote = `${input.status ?? "open"} actions for ${input.ownerEmail}`;
  } else {
    scopeNote = "missing ownerEmail or meetingId — returning empty";
  }

  return {
    actions: actions.map((a) => ({
      id:          a.id,
      meetingId:   a.meetingId,
      title:       a.title,
      ownerEmail:  a.ownerEmail,
      ownerName:   a.ownerName,
      deadline:    a.deadline,
      priority:    a.priority,
      type:        a.type,
      context:     a.context,
      status:      a.status,
    })),
    scopeNote,
  };
}
