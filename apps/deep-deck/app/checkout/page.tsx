"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PACKS, formatPrice } from "@/lib/packs";
import { useAccess } from "@/lib/use-access";

export default function CheckoutPage() {
  const router = useRouter();
  const { hasFullDeck } = useAccess();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pack = PACKS.full;

  // Already owns the full deck
  if (hasFullDeck) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--dd-redwood)] flex items-center justify-center mb-6">
          <span className="text-2xl font-bold text-white">DD</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--dd-cadet)] mb-2">
          You already own the Full Deck
        </h1>
        <p className="text-[var(--dd-cadet)]/60 mb-6">
          All 128 cards are unlocked across every age band.
        </p>
        <button
          onClick={() => router.push("/play/pick")}
          className="px-6 py-3 rounded-xl text-sm font-semibold bg-[var(--dd-redwood)] text-white hover:bg-[var(--dd-redwood)]/90 transition-colors"
        >
          Play Now
        </button>
      </div>
    );
  }

  async function handleCheckout() {
    if (!pack.stripePriceId) {
      setError("Stripe is not configured yet. Check back soon!");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: pack.stripePriceId }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md mx-auto w-full">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-[var(--dd-cadet)]/40 hover:text-[var(--dd-cadet)] transition-colors mb-8"
        >
          &larr; Back
        </button>

        <div className="bg-white rounded-2xl border border-[var(--dd-cadet)]/10 p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-[var(--dd-redwood)] flex items-center justify-center">
              <span className="text-lg font-bold text-white">DD</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--dd-cadet)]">
                {pack.name}
              </h1>
              <p className="text-sm text-[var(--dd-cadet)]/60">
                deep.deck
              </p>
            </div>
          </div>

          <ul className="space-y-2 mb-6">
            {pack.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-sm text-[var(--dd-cadet)]/80"
              >
                <svg
                  className="w-4 h-4 mt-0.5 text-[var(--dd-redwood)] shrink-0"
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
                {feature}
              </li>
            ))}
          </ul>

          <div className="border-t border-[var(--dd-cadet)]/10 pt-6">
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-sm text-[var(--dd-cadet)]/60">
                One-time purchase
              </span>
              <span className="text-2xl font-bold text-[var(--dd-redwood)]">
                {formatPrice(pack.priceCents)}
              </span>
            </div>

            {error && (
              <p className="text-sm text-red-600 mb-3">{error}</p>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-[var(--dd-redwood)] text-white hover:bg-[var(--dd-redwood)]/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Redirecting to checkout..." : "Purchase"}
            </button>

            <p className="text-xs text-[var(--dd-cadet)]/40 text-center mt-3">
              Secure checkout powered by Stripe
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
