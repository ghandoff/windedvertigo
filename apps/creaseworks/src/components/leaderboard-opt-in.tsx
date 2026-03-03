"use client";

/**
 * Leaderboard opt-in toggle component
 *
 * Shows current opt-in status with ability to toggle.
 * When opting in, allows setting a custom display name.
 *
 * Phase D — rewritten with debounced name saves, router.refresh(),
 * Tailwind styling, and distinct error/success messages.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-url";

interface LeaderboardOptInProps {
  initialOptedIn: boolean;
  initialDisplayName: string | null;
}

export default function LeaderboardOptIn({
  initialOptedIn,
  initialDisplayName,
}: LeaderboardOptInProps) {
  const router = useRouter();
  const [optedIn, setOptedIn] = useState(initialOptedIn);
  const [displayName, setDisplayName] = useState(initialDisplayName || "");
  const [showNameInput, setShowNameInput] = useState(initialOptedIn);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-clear success messages after 3 seconds
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  /* ── opt-in / opt-out toggle ── */
  const handleToggle = useCallback(
    async (newOptedInState: boolean) => {
      setError(null);
      setSuccessMessage(null);
      setIsLoading(true);

      try {
        const response = await fetch(apiUrl("/api/leaderboard/opt-in"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opted_in: newOptedInState,
            display_name: newOptedInState ? displayName || null : null,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "failed to update leaderboard status");
          return;
        }

        const data = await response.json();
        setOptedIn(data.opted_in);
        if (data.opted_in) {
          setShowNameInput(true);
          setSuccessMessage("you've joined the leaderboard!");
        } else {
          setShowNameInput(false);
          setSuccessMessage("you've left the leaderboard");
        }

        // Refresh the server-rendered leaderboard table
        router.refresh();
      } catch {
        setError("network error — please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [displayName, router],
  );

  /* ── debounced display name save ── */
  const saveDisplayName = useCallback(
    async (name: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(apiUrl("/api/leaderboard/opt-in"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opted_in: true,
            display_name: name.trim(),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "failed to update display name");
          return;
        }

        setSuccessMessage("display name updated!");
        router.refresh();
      } catch {
        setError("network error — please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [router],
  );

  const handleDisplayNameChange = useCallback(
    (newName: string) => {
      setDisplayName(newName);
      setError(null);
      setSuccessMessage(null);

      // Clear existing debounce timer
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Don't save empty or unchanged names
      if (!newName.trim() || newName.trim() === initialDisplayName) return;

      // Debounce: wait 600ms after the user stops typing before saving
      debounceRef.current = setTimeout(() => {
        saveDisplayName(newName);
      }, 600);
    },
    [initialDisplayName, saveDisplayName],
  );

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="rounded-xl border border-cadet/12 bg-white/50 p-5 mb-6">
      <div
        className={`flex justify-between items-center${showNameInput ? " mb-4" : ""}`}
      >
        <div>
          <h3 className="text-base font-semibold text-cadet mb-0.5">
            community leaderboard
          </h3>
          <p className="text-sm text-cadet/60">
            {optedIn
              ? "you're on the leaderboard"
              : "join the community leaderboard"}
          </p>
        </div>

        <button
          onClick={() => handleToggle(!optedIn)}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${
            optedIn
              ? "bg-redwood hover:opacity-90"
              : "bg-sienna hover:opacity-90"
          }`}
        >
          {optedIn ? "leave" : "join"}
        </button>
      </div>

      {showNameInput && (
        <div className="mt-4">
          <label
            htmlFor="display-name"
            className="block text-sm font-medium text-cadet mb-1.5"
          >
            display name (optional)
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            disabled={isLoading}
            placeholder="first name"
            maxLength={50}
            className="w-full px-3 py-2 rounded-lg border border-champagne text-sm font-[inherit] outline-none transition-opacity disabled:opacity-50 focus:border-sienna/40 focus:ring-1 focus:ring-sienna/20"
          />
          <p className="text-xs text-cadet/50 mt-1.5">
            if blank, we'll use your first name
          </p>
        </div>
      )}

      {/* status messages — visually distinct */}
      <div aria-live="polite" aria-atomic="true">
        {error && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-redwood/10 border border-redwood/20 text-redwood text-xs font-medium">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-sienna/10 border border-sienna/20 text-sienna text-xs font-medium">
            ✓ {successMessage}
          </div>
        )}
      </div>
    </div>
  );
}
