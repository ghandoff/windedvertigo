"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/api-url";
import { REDEMPTION_THRESHOLDS } from "@/lib/queries/credits";

interface Pack {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  playdate_count?: number;
}

interface CreditRedemptionProps {
  balance: number;
  unownedPacks: Pack[];
}

type RewardType = keyof typeof REDEMPTION_THRESHOLDS;

const REWARDS: Array<{
  type: RewardType;
  label: string;
  description: string;
  needsPack: boolean;
}> = [
  {
    type: "sampler_pdf",
    label: "free sampler PDF",
    description: "download a curated sampler of playdates",
    needsPack: false,
  },
  {
    type: "single_playdate",
    label: "unlock a pack",
    description: "get full access to a playdate pack",
    needsPack: true,
  },
  {
    type: "full_pack",
    label: "unlock a premium pack",
    description: "get full access to a larger pack collection",
    needsPack: true,
  },
];

export default function CreditRedemption({
  balance,
  unownedPacks,
}: CreditRedemptionProps) {
  const router = useRouter();
  const [selectedReward, setSelectedReward] = useState<RewardType | null>(null);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter to rewards the user can afford
  const affordable = REWARDS.filter(
    (r) => balance >= REDEMPTION_THRESHOLDS[r.type],
  );

  const handleRedeem = useCallback(async () => {
    if (!selectedReward) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/credits/redeem"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rewardType: selectedReward,
          packId: selectedPack || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "redemption failed");
        setSubmitting(false);
        return;
      }

      setSuccess(
        `redeemed ${data.creditsSpent} credits — ${data.newBalance} remaining`,
      );
      setSelectedReward(null);
      setSelectedPack(null);
      setConfirming(false);

      // Refresh the page to update balance everywhere
      setTimeout(() => router.refresh(), 1500);
    } catch {
      setError("something went wrong — try again");
    } finally {
      setSubmitting(false);
    }
  }, [selectedReward, selectedPack, router]);

  // Nothing to show if user can't afford anything
  if (affordable.length === 0) return null;

  // After successful redemption
  if (success) {
    return (
      <div className="mb-6 rounded-xl border border-redwood/20 bg-redwood/5 px-5 py-4">
        <p className="text-sm font-medium text-cadet/70">{success}</p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-sienna/15 bg-sienna/3 px-5 py-4">
      <h3 className="text-xs font-semibold text-cadet/70 mb-3">
        redeem your credits
      </h3>

      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}

      {/* reward picker */}
      {!confirming && (
        <div className="space-y-2">
          {affordable.map((reward) => {
            const cost = REDEMPTION_THRESHOLDS[reward.type];
            const isSelected = selectedReward === reward.type;

            return (
              <button
                key={reward.type}
                onClick={() => {
                  setSelectedReward(reward.type);
                  setSelectedPack(null);
                  if (!reward.needsPack) {
                    setConfirming(true);
                  }
                }}
                className={`w-full text-left rounded-lg border px-4 py-3 transition-all ${
                  isSelected
                    ? "border-sienna/40 bg-sienna/8"
                    : "border-cadet/10 hover:border-sienna/25"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-cadet">
                      {reward.label}
                    </span>
                    <p className="text-[11px] text-cadet/45 mt-0.5">
                      {reward.description}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-sienna/70 whitespace-nowrap ml-3">
                    {cost} credits
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* pack picker — shown when a pack-based reward is selected */}
      {selectedReward &&
        REWARDS.find((r) => r.type === selectedReward)?.needsPack &&
        !confirming && (
          <div className="mt-3">
            <p className="text-xs text-cadet/50 mb-2">choose a pack:</p>
            {unownedPacks.length === 0 ? (
              <p className="text-xs text-cadet/40">
                no packs available to redeem right now.
              </p>
            ) : (
              <div className="space-y-1.5">
                {unownedPacks.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => {
                      setSelectedPack(pack.id);
                      setConfirming(true);
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-all ${
                      selectedPack === pack.id
                        ? "border-sienna/40 bg-sienna/8"
                        : "border-cadet/8 hover:border-sienna/20"
                    }`}
                  >
                    <span className="font-medium text-cadet">{pack.title}</span>
                    {pack.playdate_count != null && (
                      <span className="text-[10px] text-cadet/40 ml-2">
                        {pack.playdate_count} playdates
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      {/* confirmation */}
      {confirming && selectedReward && (
        <div className="mt-3 flex items-center gap-2">
          <p className="text-xs text-cadet/60 flex-1">
            spend {REDEMPTION_THRESHOLDS[selectedReward]} credits
            {selectedPack
              ? ` on "${unownedPacks.find((p) => p.id === selectedPack)?.title}"`
              : ""}
            ?
          </p>
          <button
            onClick={() => {
              setConfirming(false);
              setSelectedReward(null);
              setSelectedPack(null);
            }}
            className="rounded-md px-3 py-1.5 text-xs text-cadet/50 hover:text-cadet/70 transition-colors"
          >
            cancel
          </button>
          <button
            onClick={handleRedeem}
            disabled={submitting}
            className="rounded-md bg-redwood px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? "redeeming…" : "confirm"}
          </button>
        </div>
      )}
    </div>
  );
}
