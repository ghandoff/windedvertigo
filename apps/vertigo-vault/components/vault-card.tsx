"use client";

import type { VaultActivity } from "@/lib/types";
import { typeColor } from "@/lib/types";

interface VaultCardProps {
  activity: VaultActivity;
  onClick: () => void;
}

export default function VaultCard({ activity, onClick }: VaultCardProps) {
  const accent = typeColor(activity.type[0]);
  const primaryType = activity.type[0] ?? null;

  return (
    <button
      onClick={onClick}
      className="group text-left w-full rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
      style={{ backgroundColor: "var(--vault-card-bg)" }}
    >
      {/* cover image */}
      {activity.coverImage && (
        <div className="h-40 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activity.coverImage}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}

      {/* type colour bar */}
      <div className="h-[5px]" style={{ backgroundColor: accent }} />

      {/* body */}
      <div className="px-6 py-5 space-y-2.5">
        {/* type badge + duration */}
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
          {primaryType && (
            <span
              className="rounded-full px-2.5 py-0.5 font-medium text-white/90"
              style={{ backgroundColor: accent }}
            >
              {primaryType}
            </span>
          )}
          {activity.duration && (
            <span className="opacity-40">{activity.duration}</span>
          )}
        </div>

        {/* name */}
        <h3 className="text-base font-semibold leading-snug">{activity.name}</h3>

        {/* headline */}
        {activity.headline && (
          <p className="text-sm leading-relaxed opacity-55 line-clamp-2">
            {activity.headline}
          </p>
        )}

        {/* format tags */}
        {activity.format.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {activity.format.map((f) => (
              <span
                key={f}
                className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider opacity-50"
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
