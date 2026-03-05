"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface PurchaseButtonProps {
  packId: string;
  label: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function PurchaseButton({
  packId,
  label,
  className = "",
  style,
}: PurchaseButtonProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase() {
    // Require sign-in first
    if (status !== "authenticated" || !session) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "checkout failed");
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handlePurchase}
        disabled={loading}
        className={`transition-opacity disabled:opacity-50 ${className}`}
        style={style}
      >
        {loading ? "redirecting to checkout..." : label}
      </button>
      {error && (
        <p className="text-xs mt-2" style={{ color: "#d4836f" }}>
          {error}
        </p>
      )}
    </div>
  );
}
