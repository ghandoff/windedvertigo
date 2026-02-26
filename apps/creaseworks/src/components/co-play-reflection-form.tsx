"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

interface CoPlayReflectionFormProps {
  runId: string;
}

const DEFAULT_HIGHLIGHTS = [
  "Child was engaged",
  "Learned something new",
  "Would do again",
  "Good for the age",
];

export function CoPlayReflectionForm({
  runId,
}: CoPlayReflectionFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [selectedHighlights, setSelectedHighlights] = useState<Set<string>>(
    new Set(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const toggleHighlight = useCallback((highlight: string) => {
    setSelectedHighlights((prev) => {
      const updated = new Set(prev);
      if (updated.has(highlight)) {
        updated.delete(highlight);
      } else {
        updated.add(highlight);
      }
      return updated;
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validate
      if (rating === 0) {
        setError("Please select a rating");
        return;
      }

      if (notes.trim().length === 0) {
        setError("Please add some notes");
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/runs/${runId}/co-play-reflections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating,
            notes: notes.trim(),
            highlights: Array.from(selectedHighlights),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        setSuccess(true);
        // Redirect back to run detail after short delay
        setTimeout(() => {
          router.push(`/runs/${runId}`);
        }, 1500);
      } catch (err) {
        console.error("Failed to submit reflections:", err);
        setError(err instanceof Error ? err.message : "Failed to submit");
      } finally {
        setIsSubmitting(false);
      }
    },
    [runId, rating, notes, selectedHighlights, router],
  );

  if (success) {
    return (
      <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
        <p className="text-green-700 font-medium mb-2">
          ✓ Reflections submitted!
        </p>
        <p className="text-sm text-green-600">
          Taking you back to the playdate...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Rating */}
      <div>
        <label className="block text-sm font-semibold mb-3">
          How was the playdate?
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`text-3xl transition ${
                rating >= star ? "text-yellow-400" : "text-gray-300"
              }`}
              aria-label={`Rate ${star} stars`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-semibold mb-2">
          Your notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What stood out to you? What did the children enjoy?"
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={5}
        />
        <p className="text-xs text-gray-500 mt-1">
          {notes.length} / 5000 characters
        </p>
      </div>

      {/* Highlights */}
      <div>
        <label className="block text-sm font-semibold mb-3">
          Highlights (select any that apply)
        </label>
        <div className="space-y-2">
          {DEFAULT_HIGHLIGHTS.map((highlight) => (
            <label key={highlight} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedHighlights.has(highlight)}
                onChange={() => toggleHighlight(highlight)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm">{highlight}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {isSubmitting ? "Submitting..." : "Submit Reflections"}
      </button>
    </form>
  );
}
