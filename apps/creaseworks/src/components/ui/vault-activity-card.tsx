import Link from "next/link";

/**
 * Accent colours keyed by vault activity type.
 * Matches the windedvertigo palette for visual consistency.
 */
const TYPE_COLORS: Record<string, string> = {
  Energizer: "#AF4F41",
  "Getting to know each other": "#6b8e6b",
  "Playful reflections": "#8b6fb0",
  "RME Related": "#4a7fb5",
};

function typeColor(type: string | undefined): string {
  return TYPE_COLORS[type ?? ""] ?? "#6b7b8d";
}

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
  /** Whether the user has access beyond teaser (hides upsell badges). */
  isEntitled?: boolean;
}

export function VaultActivityCard({ activity, isEntitled }: VaultActivityCardProps) {
  const primaryType = activity.type[0] ?? null;
  const accent = typeColor(primaryType);

  return (
    <Link
      href={`/vault/${activity.slug}`}
      className="group relative block rounded-xl overflow-hidden border border-cadet/10 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
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
            <span className="text-cadet/50">{activity.duration}</span>
          )}
        </div>

        {/* name */}
        <h2 className="text-base font-semibold leading-snug text-cadet">
          {activity.name}
        </h2>

        {/* headline */}
        {activity.headline && (
          <p className="text-sm leading-relaxed text-cadet/60 line-clamp-2">
            {activity.headline}
          </p>
        )}

        {/* meta row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
          {/* tier badge — only shown to unentitled users as upsell */}
          {activity.tier === "prme" && (
            <span className="rounded-full bg-cadet/5 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium text-cadet/50">
              free
            </span>
          )}
          {activity.tier === "explorer" && !isEntitled && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium"
              style={{ backgroundColor: "rgba(175,79,65,0.12)", color: "#AF4F41" }}
            >
              explorer
            </span>
          )}
          {activity.tier === "practitioner" && !isEntitled && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium"
              style={{ backgroundColor: "rgba(155,67,67,0.12)", color: "#9b4343" }}
            >
              practitioner
            </span>
          )}

          {/* format tags */}
          {activity.format.map((f) => (
            <span
              key={f}
              className="rounded-full border border-cadet/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cadet/40"
            >
              {f}
            </span>
          ))}

          {/* age range */}
          {activity.age_range && (
            <span className="text-[10px] text-cadet/30">
              ages {activity.age_range}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
