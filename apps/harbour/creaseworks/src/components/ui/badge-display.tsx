/**
 * BadgeDisplay — server component rendering a grid of material mastery badges.
 *
 * Earned badges show full colour with a subtle glow; unearned badges
 * are greyed out with a progress bar toward the threshold.
 */

import type { Badge } from "@/lib/queries/badges";

interface BadgeDisplayProps {
  badges: Badge[];
}

export default function BadgeDisplay({ badges }: BadgeDisplayProps) {
  if (badges.length === 0) return null;

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: "repeat(3, 1fr)",
      }}
    >
      {badges.map((badge) => (
        <div
          key={badge.id}
          className="flex flex-col items-center text-center rounded-xl border px-3 py-4 transition-all"
          style={{
            borderColor: badge.earned
              ? "var(--wv-sienna)"
              : "rgba(39, 50, 72, 0.1)",
            backgroundColor: badge.earned
              ? "rgba(203, 120, 88, 0.06)"
              : "rgba(39, 50, 72, 0.02)",
            boxShadow: badge.earned
              ? "0 0 12px rgba(203, 120, 88, 0.15)"
              : "none",
            opacity: badge.earned ? 1 : 0.55,
          }}
        >
          {/* icon */}
          <span
            className="text-2xl mb-1.5 leading-none"
            style={{
              filter: badge.earned ? "none" : "grayscale(0.8)",
            }}
            aria-hidden="true"
          >
            {badge.icon}
          </span>

          {/* title */}
          <span
            className="text-xs font-semibold leading-tight mb-1"
            style={{
              color: badge.earned ? "var(--wv-sienna)" : "var(--wv-cadet)",
            }}
          >
            {badge.title}
          </span>

          {/* progress bar (unearned only) */}
          {badge.progress && (
            <div className="w-full mt-1.5">
              <div
                className="w-full rounded-full overflow-hidden"
                style={{
                  height: 4,
                  backgroundColor: "rgba(39, 50, 72, 0.08)",
                }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (badge.progress.current / badge.progress.target) * 100)}%`,
                    backgroundColor: "var(--wv-cadet)",
                    opacity: 0.3,
                  }}
                />
              </div>
              <span
                className="text-2xs mt-1 block"
                style={{ color: "var(--wv-cadet)", opacity: 0.4 }}
              >
                {badge.progress.current}/{badge.progress.target}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
