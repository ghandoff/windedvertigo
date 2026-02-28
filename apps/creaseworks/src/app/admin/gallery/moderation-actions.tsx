"use client";

/**
 * Gallery moderation actions component.
 *
 * Provides approve and reject buttons for admins to moderate
 * pending gallery items.
 */

import { useState } from "react";
import { useTransition } from "react";
import { apiUrl } from "@/lib/api-url";

interface GalleryModerationActionsProps {
  evidenceId: string;
}

export default function GalleryModerationActions({
  evidenceId,
}: GalleryModerationActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleAction = async (action: "approve" | "reject") => {
    startTransition(async () => {
      try {
        const response = await fetch(apiUrl("/api/admin/gallery"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidenceId,
            action,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          setMessage({
            type: "error",
            text: error.error ?? "failed to moderate item",
          });
          return;
        }

        setMessage({
          type: "success",
          text: action === "approve" ? "approved \u2713" : "rejected",
        });

        // Reload page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        console.error("moderation error:", error);
        setMessage({
          type: "error",
          text: "an error occurred",
        });
      }
    });
  };

  return (
    <div className="mt-6 space-y-3">
      <div className="flex gap-3">
        <button
          onClick={() => handleAction("approve")}
          disabled={isPending}
          className="flex-1 px-4 py-2 rounded-lg font-medium transition-all text-white"
          style={{
            backgroundColor: "var(--wv-sienna)",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? "..." : "approve"}
        </button>
        <button
          onClick={() => handleAction("reject")}
          disabled={isPending}
          className="flex-1 px-4 py-2 rounded-lg font-medium transition-all"
          style={{
            backgroundColor: "rgba(39, 50, 72, 0.1)",
            color: "var(--wv-cadet)",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? "..." : "reject"}
        </button>
      </div>

      {message && (
        <p
          className="text-xs text-center"
          style={{
            color: message.type === "success" ? "var(--wv-sienna)" : "var(--wv-redwood)",
          }}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

