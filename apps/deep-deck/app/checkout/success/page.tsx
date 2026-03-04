"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccess } from "@/lib/use-access";

type VerifyState = "verifying" | "verified" | "error";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { grant, hasFullDeck } = useAccess();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<VerifyState>(
    hasFullDeck ? "verified" : "verifying",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (hasFullDeck || !sessionId) return;

    let cancelled = false;

    async function verify() {
      try {
        const res = await fetch("/api/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        if (cancelled) return;

        const data = await res.json();

        if (data.verified) {
          grant("full", sessionId!);
          setStatus("verified");
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Payment could not be verified");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg("Network error. Please refresh the page to try again.");
        }
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [sessionId, grant, hasFullDeck]);

  if (status === "verifying") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--dd-cadet)]/10 flex items-center justify-center mb-6 animate-pulse">
          <span className="text-2xl font-bold text-[var(--dd-cadet)]/40">
            DD
          </span>
        </div>
        <p className="text-[var(--dd-cadet)]/60">Verifying your purchase...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--dd-cadet)] mb-2">
          Verification Failed
        </h1>
        <p className="text-[var(--dd-cadet)]/60 mb-6 max-w-md">{errorMsg}</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 rounded-xl text-sm font-semibold bg-[var(--dd-cadet)] text-white hover:bg-[var(--dd-cadet)]/90 transition-colors"
        >
          Back to deep.deck
        </button>
      </div>
    );
  }

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
