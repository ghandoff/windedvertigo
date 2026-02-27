"use client";

/**
 * Leaderboard opt-in toggle component
 *
 * Shows current opt-in status with ability to toggle.
 * When opting in, allows setting a custom display name.
 */

import { useCallback, useState } from "react";

interface LeaderboardOptInProps {
  initialOptedIn: boolean;
  initialDisplayName: string | null;
}

export default function LeaderboardOptIn({
  initialOptedIn,
  initialDisplayName,
}: LeaderboardOptInProps) {
  const [optedIn, setOptedIn] = useState(initialOptedIn);
  const [displayName, setDisplayName] = useState(initialDisplayName || "");
  const [showNameInput, setShowNameInput] = useState(initialOptedIn);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleToggle = useCallback(async (newOptedInState: boolean) => {
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/leaderboard/opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opted_in: newOptedInState,
          display_name: newOptedInState ? displayName || null : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to update leaderboard status");
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      setOptedIn(data.opted_in);
      if (data.opted_in) {
        setShowNameInput(true);
        setSuccessMessage("You've joined the leaderboard!");
      } else {
        setShowNameInput(false);
        setSuccessMessage("You've left the leaderboard");
      }
      setIsLoading(false);
    } catch (err) {
      setError("Network error. Please try again.");
      setIsLoading(false);
    }
  }, [displayName]);

  const handleDisplayNameChange = useCallback(async (newName: string) => {
    setDisplayName(newName);
    setError(null);
    setSuccessMessage(null);

    // Don't auto-save empty or unchanged names
    if (!newName.trim() || newName === initialDisplayName) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/leaderboard/opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opted_in: true,
          display_name: newName.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to update display name");
        setIsLoading(false);
        return;
      }

      setSuccessMessage("Display name updated!");
      setIsLoading(false);
    } catch (err) {
      setError("Network error. Please try again.");
      setIsLoading(false);
    }
  }, [initialDisplayName]);

  return (
    <div
      style={{
        border: `1px solid var(--wv-cadet)`,
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "24px",
        backgroundColor: "rgba(255, 255, 255, 0.5)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: showNameInput ? "16px" : "0",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600 }}>
            Community Leaderboard
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "var(--wv-cadet)",
            }}
          >
            {optedIn ? "You're on the leaderboard" : "Join the community leaderboard"}
          </p>
        </div>

        <button
          onClick={() => handleToggle(!optedIn)}
          disabled={isLoading}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: optedIn ? "var(--wv-redwood)" : "var(--wv-sienna)",
            color: "white",
            fontSize: "14px",
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.6 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {optedIn ? "Leave" : "Join"}
        </button>
      </div>

      {showNameInput && (
        <div style={{ marginTop: "16px" }}>
          <label
            htmlFor="display-name"
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: 500,
              marginBottom: "6px",
              color: "var(--wv-cadet)",
            }}
          >
            Display Name (optional)
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            disabled={isLoading}
            placeholder="First name"
            maxLength={50}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "4px",
              border: `1px solid var(--wv-champagne)`,
              fontSize: "14px",
              fontFamily: "inherit",
              boxSizing: "border-box",
              opacity: isLoading ? 0.6 : 1,
            }}
          />
          <p
            style={{
              margin: "6px 0 0 0",
              fontSize: "12px",
              color: "var(--wv-cadet)",
            }}
          >
            If blank, we'll use your first name
          </p>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: "12px",
            padding: "8px 12px",
            borderRadius: "4px",
            backgroundColor: "var(--wv-redwood)",
            color: "white",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            marginTop: "12px",
            padding: "8px 12px",
            borderRadius: "4px",
            backgroundColor: "var(--wv-sienna)",
            color: "white",
            fontSize: "13px",
          }}
        >
          {successMessage}
        </div>
      )}
    </div>
  );
}
