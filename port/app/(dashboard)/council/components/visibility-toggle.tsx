"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Users, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface VisibilityToggleProps {
  meetingId: string;
  initialVisibility: "shared" | "private";
  initialOwnerEmail: string | null;
  viewerEmail: string | null;
}

/**
 * Client toggle for switching a meeting between shared (team-visible) and
 * private (owner-only). Optimistic UI; rolls back on API failure.
 *
 * Disabled when the viewer isn't the owner (and an owner is set). The API
 * also enforces this — defense in depth.
 */
export function VisibilityToggle({
  meetingId,
  initialVisibility,
  initialOwnerEmail,
  viewerEmail,
}: VisibilityToggleProps) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [ownerEmail, setOwnerEmail] = useState(initialOwnerEmail);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Can the current viewer toggle? Either they're the owner, or no owner is
  // set yet (first-toggler claims ownership).
  const canToggle = !ownerEmail || ownerEmail === viewerEmail;

  const flip = () => {
    const next = visibility === "shared" ? "private" : "shared";
    const prev = visibility;
    const prevOwner = ownerEmail;

    setVisibility(next);
    if (next === "private" && !ownerEmail && viewerEmail) {
      setOwnerEmail(viewerEmail);
    }
    setError(null);

    startTransition(async () => {
      const res = await fetch(
        `/api/council/meetings/${meetingId}/visibility`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility: next }),
        },
      );
      if (res.ok) {
        // Re-render so the meeting list (which filters by visibility) refreshes
        // when you navigate back.
        router.refresh();
      } else {
        setVisibility(prev);
        setOwnerEmail(prevOwner);
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
    });
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Button
          onClick={flip}
          disabled={isPending || !canToggle}
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          title={
            !canToggle
              ? `only ${ownerEmail} can change visibility`
              : visibility === "shared"
                ? "make this meeting private — only you'll see it in /council"
                : "share back with the team"
          }
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
          ) : visibility === "shared" ? (
            <Users className="h-3 w-3 mr-1.5 text-[#43b187]" />
          ) : (
            <Lock className="h-3 w-3 mr-1.5 text-[#cb7858]" />
          )}
          {visibility === "shared" ? "shared with team" : "private (only you)"}
        </Button>
        {ownerEmail && (
          <span className="text-[10px] text-muted-foreground">
            owner: {ownerEmail}
          </span>
        )}
      </div>
      {error && (
        <p className="text-[10px] text-[#b15043] inline-flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}
