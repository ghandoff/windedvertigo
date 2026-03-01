"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-url";

interface CoPlayJoinFormProps {
  inviteCode: string;
  onSuccess?: () => void;
}

export function CoPlayJoinForm({
  inviteCode,
  onSuccess,
}: CoPlayJoinFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = useCallback(async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(apiUrl("/api/co-play/join"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      // Success — redirect to reflections form
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/co-play/${inviteCode}/reflections`);
      }
    } catch (err) {
      console.error("Failed to join co-play:", err);
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setIsSubmitting(false);
    }
  }, [inviteCode, router, onSuccess]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      <button
        onClick={handleJoin}
        disabled={isSubmitting}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {isSubmitting ? "Joining..." : "Join Co-Play Session"}
      </button>
    </div>
  );
}

