"use client";

import { signOut } from "next-auth/react";
import type { VaultAccessTier } from "@/lib/queries/vault";

const TIER_LABELS: Record<VaultAccessTier, string> = {
  teaser: "free",
  entitled: "explorer pack",
  practitioner: "practitioner pack",
  internal: "internal",
};

const TIER_STYLES: Record<VaultAccessTier, { bg: string; color: string }> = {
  teaser: { bg: "rgba(255,255,255,0.06)", color: "var(--vault-text-muted)" },
  entitled: { bg: "rgba(175,79,65,0.15)", color: "#d4836f" },
  practitioner: { bg: "rgba(155,67,67,0.15)", color: "#c47373" },
  internal: { bg: "rgba(175,79,65,0.15)", color: "var(--vault-accent)" },
};

/**
 * Client component for the signed-in user menu.
 * Shows tier badge, email, and a sign-out button.
 */
export default function UserMenu({
  email,
  tier,
}: {
  email: string;
  tier: VaultAccessTier;
}) {
  const style = TIER_STYLES[tier];

  return (
    <div className="flex items-center gap-3">
      {/* tier badge */}
      <span
        className="rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap"
        style={{ backgroundColor: style.bg, color: style.color }}
      >
        {TIER_LABELS[tier]}
      </span>

      {/* email */}
      <span
        className="text-xs hidden sm:inline"
        style={{ color: "var(--vault-text-muted)" }}
      >
        {email}
      </span>

      {/* sign out */}
      <button
        onClick={() => signOut({ callbackUrl: "/harbour" })}
        className="rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors cursor-pointer"
        style={{
          color: "var(--vault-text-muted)",
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.12)";
          e.currentTarget.style.color = "rgba(255,255,255,0.85)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
          e.currentTarget.style.color = "var(--vault-text-muted)";
        }}
      >
        sign out
      </button>
    </div>
  );
}
