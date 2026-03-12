import Link from "next/link";
import { typeColor } from "@/lib/ui-constants";

export interface VaultActivity {
  id: string;
  slug: string;
  name: string;
  headline: string | null;
  headline_html: string | null;
  duration: string | null;
  format: string[];
  type: string[];
  skills_developed: string[];
  tags: string[];
  tier: string;
  age_range: string | null;
  group_size: string | null;
  cover_url: string | null;
}

interface VaultActivityCardProps {
  activity: VaultActivity;
  /** Whether the user has access beyond teaser (shows "full guide" badge). */
  isEntitled?: boolean;
}

export function VaultActivityCard({ activity, isEntitled }: VaultActivityCardProps) {
  const primaryType = activity.type[0] ?? null;
  const accent = typeColor(primaryType);

  return (
    <Link
      href={`/${activity.slug}`}
      className="group relative block rounded-xl overflow-hidden border transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: "var(--vault-card-bg)",
        borderColor: "var(--vault-border)",
      }}
    >
      {/* cover image */}
      {activity.cover_url && (
        <div className="w-full h-[140px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activity.cover_url}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      )}

      {/* type colour bar */}
      <div className="h-[4px]" style={{ backgroundColor: accent }} />

      {/* body */}
      <div className="px-5 py-4 flex flex-col gap-2">
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
            <span style={{ color: "var(--vault-text-muted)" }}>
              {activity.duration}
            </span>
          )}
        </div>

        {/* name */}
        <h2
          className="text-base font-semibold leading-snug"
          style={{ color: "var(--vault-text)" }}
        >
          {activity.name}
        </h2>

        {/* headline */}
        {activity.headline && (
          <p
            className="text-sm leading-relaxed line-clamp-2"
            style={{ color: "var(--vault-text-muted)" }}
          >
            {activity.headline}
          </p>
        )}

        {/* meta row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
          {/* tier badge */}
          {activity.tier === "prme" && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--vault-text-muted)" }}
            >
              free
            </span>
          )}
          {activity.tier === "explorer" && !isEntitled && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium"
              style={{ backgroundColor: "rgba(175,79,65,0.15)", color: "#d4836f" }}
            >
              explorer
            </span>
          )}
          {activity.tier === "practitioner" && !isEntitled && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium"
              style={{ backgroundColor: "rgba(155,67,67,0.15)", color: "#c47373" }}
            >
              practitioner
            </span>
          )}

          {/* format tags */}
          {activity.format.map((f) => (
            <span
              key={f}
              className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider"
              style={{ borderColor: "var(--vault-border)", color: "var(--vault-text-muted)" }}
            >
              {f}
            </span>
          ))}

          {/* age range */}
          {activity.age_range && (
            <span className="text-[10px]" style={{ color: "rgba(232,237,243,0.35)" }}>
              ages {activity.age_range}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
