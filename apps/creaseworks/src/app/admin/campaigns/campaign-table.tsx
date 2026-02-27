"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Campaign {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  active: boolean;
  playdate_count?: number;
}

export default function CampaignTable({
  campaigns,
}: {
  campaigns: Campaign[];
}) {
  return (
    <div className="space-y-3">
      {campaigns.map((c) => (
        <CampaignRow key={c.id} campaign={c} />
      ))}
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleActive() {
    setToggling(true);
    try {
      await fetch("/api/admin/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: campaign.id, active: !campaign.active }),
      });
      router.refresh();
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`delete campaign "${campaign.slug}"? this cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await fetch("/api/admin/campaigns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: campaign.id }),
      });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={`rounded-xl border px-5 py-4 transition-colors ${
        campaign.active
          ? "border-cadet/10 bg-white"
          : "border-cadet/5 bg-cadet/3 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/campaign/${campaign.slug}`}
              className="font-semibold text-sm text-cadet hover:text-redwood transition-colors truncate"
            >
              {campaign.title}
            </Link>
            <span className="text-[10px] font-mono text-cadet/40 shrink-0">
              /{campaign.slug}
            </span>
            {!campaign.active && (
              <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-cadet/10 text-cadet/50">
                inactive
              </span>
            )}
          </div>
          {campaign.description && (
            <p className="text-xs text-cadet/50 line-clamp-2">
              {campaign.description}
            </p>
          )}
          <p className="text-[10px] text-cadet/30 mt-1">
            {campaign.playdate_count ?? 0} playdate
            {(campaign.playdate_count ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleActive}
            disabled={toggling}
            className="text-xs text-cadet/40 hover:text-cadet transition-colors disabled:opacity-40"
          >
            {toggling
              ? "..."
              : campaign.active
                ? "deactivate"
                : "activate"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-redwood/60 hover:text-redwood transition-colors disabled:opacity-40"
          >
            {deleting ? "..." : "delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
