"use client";

/**
 * Purchase button — initiates Stripe Checkout for a pack.
 *
 * POSTs to /api/checkout to create a Stripe session,
 * then redirects to Stripe's hosted checkout page.
 *
 * Post-MVP — Stripe integration.
 */

import { useState } from "react";

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

export default function PurchaseButton({
  packCacheId,
  priceCents,
  currency,
}: {
  packCacheId: string;
  priceCents: number;
  currency: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packCacheId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "failed to start checkout");
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handlePurchase}
        disabled={loading}
        className="rounded-lg px-6 py-3 text-sm font-medium text-white disabled:opacity-50 transition-all hover:opacity-90"
        style={{ backgroundColor: "#b15043" }}
      >
        {loading
          ? "redirecting to checkout…"
          : `get this pack — ${formatPrice(priceCents, currency)}`}
      </button>
      {error && (
        <p
          className="mt-2 text-sm"
          style={{ color: "#b15043" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
