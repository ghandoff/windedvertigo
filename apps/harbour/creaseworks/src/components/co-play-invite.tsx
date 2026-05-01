"use client";

import { useCallback, useEffect, useState } from "react";
import { CoPlayDetails } from "@/lib/queries/co-play";
import { apiUrl } from "@/lib/api-url";
import { QrInvite } from "@/components/co-play/qr-invite";
import { haptic } from "@/lib/haptics";

interface CoPlayInviteProps {
  runId: string;
}

export function CoPlayInvite({ runId }: CoPlayInviteProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [coPlayDetails, setCoPlayDetails] = useState<CoPlayDetails | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Load existing co-play details
  const loadCoPlayDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/runs/${runId}/co-play`));
      if (!res.ok) {
        // 404 is normal if co-play hasn't been enabled
        if (res.status === 404) {
          setCoPlayDetails(null);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setCoPlayDetails(data.coPlay);
    } catch (err) {
      console.error("Failed to load co-play details:", err);
      setError("failed to load co-play details");
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  // Enable co-play mode
  const handleEnableCoPlay = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/runs/${runId}/co-play`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setCoPlayDetails({
        inviteCode: data.inviteCode,
        coPlayParentId: null,
        coPlayParentName: null,
        coPlayReflections: null,
      });
    } catch (err) {
      console.error("Failed to enable co-play:", err);
      setError("failed to enable co-play mode");
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  // Load details on mount
  useEffect(() => {
    loadCoPlayDetails();
  }, [loadCoPlayDetails]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
        {error}
      </div>
    );
  }

  // No invite code yet
  if (!coPlayDetails?.inviteCode) {
    return (
      <button
        onClick={() => { haptic("medium"); handleEnableCoPlay(); }}
        disabled={isLoading}
        className="px-4 py-2 bg-redwood text-white rounded hover:bg-redwood/90 disabled:opacity-50"
      >
        {isLoading ? "enabling..." : "invite a co-player"}
      </button>
    );
  }

  return (
    <div className="border border-cadet/10 rounded-lg p-6 bg-background">
      {/* QR invite card with code, copy, and share */}
      <QrInvite inviteCode={coPlayDetails.inviteCode} />

      {/* co-play partner status */}
      <div className="mt-6">
        {coPlayDetails.coPlayParentId ? (
          <div className="bg-white border border-green-200 rounded p-4">
            <p className="text-sm font-medium text-green-700 mb-3">
              {coPlayDetails.coPlayParentName} has joined!
            </p>

            {coPlayDetails.coPlayReflections && (
              <div className="mt-4 border-t border-cadet/10 pt-4">
                <p className="text-sm font-semibold mb-2">
                  their reflections:
                </p>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-cadet/60">rating:</span>{" "}
                    <span className="font-semibold">
                      {coPlayDetails.coPlayReflections.rating} / 5
                    </span>
                  </p>
                  <p>
                    <span className="text-cadet/60">notes:</span>{" "}
                    <span className="block mt-1">
                      {coPlayDetails.coPlayReflections.notes}
                    </span>
                  </p>
                  {coPlayDetails.coPlayReflections.highlights?.length > 0 && (
                    <p>
                      <span className="text-cadet/60">highlights:</span>
                      <ul className="list-disc list-inside mt-1">
                        {coPlayDetails.coPlayReflections.highlights.map(
                          (h, i) => (
                            <li key={i} className="text-cadet/80">
                              {h}
                            </li>
                          ),
                        )}
                      </ul>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-cadet/10 rounded p-4 text-center">
            <p className="text-sm text-cadet/60">
              waiting for co-player to join...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
