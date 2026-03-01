"use client";

import { useCallback, useState } from "react";
import { CoPlayDetails } from "@/lib/queries/co-play";
import { apiUrl } from "@/lib/api-url";

interface CoPlayInviteProps {
  runId: string;
}

export function CoPlayInvite({ runId }: CoPlayInviteProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [coPlayDetails, setCoPlayDetails] = useState<CoPlayDetails | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

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
      setError("Failed to load co-play details");
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
      setError("Failed to enable co-play mode");
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  // Copy invite code to clipboard
  const handleCopyCode = useCallback(async () => {
    if (!coPlayDetails?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(coPlayDetails.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
      setError("Failed to copy code");
    }
  }, [coPlayDetails?.inviteCode]);

  // Load details on mount
  useState(() => {
    loadCoPlayDetails();
  });

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
        onClick={handleEnableCoPlay}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? "Enabling..." : "Invite a co-player"}
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
      <h3 className="font-semibold text-lg mb-4">Co-play Invite</h3>

      {/* Invite code display */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-2">Share this code:</p>
        <div className="flex items-center gap-3">
          <div className="text-4xl font-mono font-bold tracking-widest text-blue-600">
            {coPlayDetails.inviteCode}
          </div>
          <button
            onClick={handleCopyCode}
            className="px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm font-medium"
          >
            {copiedCode ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Share this code with your co-player
        </p>
      </div>

      {/* Co-play partner status */}
      {coPlayDetails.coPlayParentId ? (
        <div className="bg-white border border-green-200 rounded p-4">
          <p className="text-sm font-medium text-green-700 mb-3">
            ✓ {coPlayDetails.coPlayParentName} has joined!
          </p>

          {coPlayDetails.coPlayReflections && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <p className="text-sm font-semibold mb-2">
                Their Reflections:
              </p>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-gray-600">Rating:</span>{" "}
                  <span className="font-semibold">
                    {coPlayDetails.coPlayReflections.rating} / 5
                  </span>
                </p>
                <p>
                  <span className="text-gray-600">Notes:</span>{" "}
                  <span className="block mt-1">
                    {coPlayDetails.coPlayReflections.notes}
                  </span>
                </p>
                {coPlayDetails.coPlayReflections.highlights?.length > 0 && (
                  <p>
                    <span className="text-gray-600">Highlights:</span>
                    <ul className="list-disc list-inside mt-1">
                      {coPlayDetails.coPlayReflections.highlights.map(
                        (h, i) => (
                          <li key={i} className="text-gray-700">
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
        <div className="bg-white border border-gray-300 rounded p-4 text-center">
          <p className="text-sm text-gray-600">
            Waiting for co-player to join...
          </p>
        </div>
      )}
    </div>
  );
}
