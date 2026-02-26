"use client";

/**
 * Gallery share toggle component.
 *
 * Small button/toggle for users to opt-in/out of sharing evidence
 * to the community gallery. Uses the /api/gallery/share endpoint.
 *
 * Props:
 *   evidenceId — ID of the evidence item
 *   initialShared — initial shared state (optional, defaults to false)
 *   onStatusChange — callback when share status changes (optional)
 */

import { useState } from "react";

interface GalleryShareToggleProps {
  evidenceId: string;
  initialShared?: boolean;
  onStatusChange?: (shared: boolean) => void;
}

export default function GalleryShareToggle({
  evidenceId,
  initialShared = false,
  onStatusChange,
}: GalleryShareToggleProps) {
  const [shared, setShared] = useState(initialShared);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/gallery/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidenceId,
          shared: !shared,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to update gallery share:", error);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setShared(data.shared);
      onStatusChange?.(data.shared);
    } catch (error) {
      console.error("Gallery share error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
      style={{
        backgroundColor: shared ? "rgba(140, 110, 80, 0.1)" : "rgba(39, 50, 72, 0.05)",
        color: shared ? "var(--wv-sienna)" : "var(--wv-cadet)",
        border: `1px solid ${shared ? "rgba(140, 110, 80, 0.2)" : "rgba(39, 50, 72, 0.1)"}`,
        opacity: loading ? 0.7 : 1,
      }}
      aria-pressed={shared}
    >
      <span>{shared ? "shared" : "share"}</span>
      {shared && <span className="text-xs">✓</span>}
    </button>
  );
}
