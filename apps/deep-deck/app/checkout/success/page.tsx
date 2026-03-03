"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccess } from "@/lib/use-access";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { grant, hasFullDeck } = useAccess();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (sessionId) {
      grant("full", sessionId);
    }
  }, [sessionId, grant]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="w-20 h-20 rounded-full bg-[var(--dd-redwood)] flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-[var(--dd-cadet)] mb-2">
        Welcome to the Full Deck
      </h1>
      <p className="text-[var(--dd-cadet)]/60 mb-2 max-w-md">
        128 cards across all 4 age bands, 32 wild card modifiers, and every
        future card pack &mdash; all unlocked.
      </p>
      <p className="text-sm text-[var(--dd-cadet)]/40 mb-8">
        Thank you for supporting deep.deck
      </p>

      <button
        onClick={() => router.push("/play/pick")}
        className="px-8 py-3 rounded-xl text-sm font-semibold bg-[var(--dd-redwood)] text-white hover:bg-[var(--dd-redwood)]/90 transition-colors"
      >
        Start Playing
      </button>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[var(--dd-cadet)]/50">Verifying purchase...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
