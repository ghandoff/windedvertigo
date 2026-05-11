"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelBookingAction } from "../actions";

export function CancelButton({ bookingId }: { bookingId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
        className="text-red-500 hover:text-red-600"
      >
        cancel booking
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        this deletes the google calendar event, sends cancellation emails to the
        visitor + host(s), and logs to notion. it can&rsquo;t be undone.
      </p>
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await cancelBookingAction(bookingId);
              if (res.error) {
                setError(res.error);
              } else {
                router.refresh();
              }
            });
          }}
        >
          {pending ? "cancelling…" : "yes, cancel"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          back
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
