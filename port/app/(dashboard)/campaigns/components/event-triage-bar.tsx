"use client";

/**
 * 4-button triage row that lives at the bottom of every event tile.
 * Clicking a button:
 *   - PATCHes /api/events/[id] with the new status
 *   - For "attend" → also navigates to /campaigns/new?event=<id>&type=event-based
 *   - For "pursue" → also opens the EventSubmissionsModal (Phase 6) so the
 *     team can immediately register their talk/panel/sponsorship submissions
 *     for the conference. This replaced the original Phase-1 redirect to
 *     /opportunities/new because conferences are N-to-1 (multiple submissions
 *     per event), which RFP-Radar's 1:1 model doesn't capture.
 *   - For "watch" / "not_relevant" → just patches and refreshes the page
 *
 * Optimistic UX: the clicked button shows a spinner while the request
 * is in flight; on success the page refreshes (server component re-fetches
 * with the updated status). Errors surface inline and disable the row.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Eye, Users, Mic, Ban } from "lucide-react";
import type { ConferenceStatus } from "@/lib/notion/types";
import { EventSubmissionsModal } from "@/app/components/event-submissions-modal";

interface Props {
  eventId: string;
  eventName: string;
  currentStatus: ConferenceStatus;
}

interface Action {
  status: ConferenceStatus;
  label: string;
  Icon: typeof Eye;
  navigate?: (id: string) => string;
  /** When true, after PATCHing status we open the submissions modal
   *  instead of navigating away. */
  opensSubmissionsModal?: boolean;
  hint: string;
}

const ACTIONS: Action[] = [
  {
    status: "watch",
    label: "watch",
    Icon: Eye,
    hint: "keep on the radar; decide later",
  },
  {
    status: "attend",
    label: "attend",
    Icon: Users,
    navigate: (id) => `/campaigns/new?event=${id}&type=event-based`,
    hint: "someone from w.v will go (networking)",
  },
  {
    status: "pursue",
    label: "pursue",
    Icon: Mic,
    // Phase 6 swap: PATCH the status, then open the submissions modal.
    // The modal handles the N-submissions-per-event flow.
    opensSubmissionsModal: true,
    hint: "submit a contribution / sponsor / speak",
  },
  {
    status: "not_relevant",
    label: "not relevant",
    Icon: Ban,
    hint: "rejected; hidden from default view",
  },
];

export function EventTriageBar({ eventId, eventName, currentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ConferenceStatus | null>(null);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);

  async function handleClick(action: Action) {
    setError(null);
    setPendingStatus(action.status);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action.status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `request failed (${res.status})`);
      }
      if (action.opensSubmissionsModal) {
        // Status patched; now open the submissions modal so the team can
        // immediately log their talk/panel/sponsor proposals. Page refresh
        // happens when the modal closes (via onOpenChange below).
        setSubmissionsOpen(true);
      } else if (action.navigate) {
        router.push(action.navigate(eventId));
      } else {
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "triage failed");
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <div className="space-y-1.5 pt-2 border-t">
      <div className="flex flex-wrap items-center gap-1.5">
        {ACTIONS.map((a) => {
          const isCurrent = a.status === currentStatus;
          const isLoading = pendingStatus === a.status;
          return (
            <button
              key={a.status}
              type="button"
              disabled={pending || isLoading}
              onClick={() => handleClick(a)}
              title={a.hint}
              className={
                "inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md " +
                "transition-colors disabled:opacity-50 " +
                (isCurrent
                  ? "bg-foreground text-background font-medium"
                  : "bg-muted hover:bg-foreground/10 text-foreground/70")
              }
            >
              {isLoading ? (
                <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <a.Icon className="h-3 w-3" />
              )}
              <span>{a.label}</span>
              {isCurrent && <CheckCircle2 className="h-3 w-3" />}
            </button>
          );
        })}
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
      {/* Hidden trigger — modal is opened programmatically from the pursue
          handler. We still pass `open`/`onOpenChange` so the modal is fully
          controlled. Closing the modal refreshes the page so the new tile
          submission count rolls in. */}
      <EventSubmissionsModal
        eventId={eventId}
        eventName={eventName}
        open={submissionsOpen}
        onOpenChange={(o) => {
          setSubmissionsOpen(o);
          if (!o) startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}
