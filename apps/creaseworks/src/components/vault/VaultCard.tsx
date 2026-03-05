import Link from "next/link";
import Image from "next/image";

export interface VaultActivity {
  id: number;
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
  /* entitled+ fields — absent at teaser tier */
  body_html?: string | null;
  content_md?: string | null;
  materials_needed?: string[];
  facilitator_notes?: string | null;
  video_url?: string | null;
}

interface VaultCardProps {
  activity: VaultActivity;
  /** The viewer's resolved access tier — used to decide if tier badge is shown */
  viewerTier: string;
}

/* ── type-based colour accents ── */
const TYPE_COLOURS: Record<string, { border: string; bg: string; label: string }> = {
  "energizer":                 { border: "rgba(177, 80, 67, 0.35)", bg: "rgba(177, 80, 67, 0.04)",  label: "text-redwood" },
  "getting to know each other": { border: "rgba(125, 148, 120, 0.4)", bg: "rgba(125, 148, 120, 0.04)", label: "text-[#6b8c63]" },
  "team building":             { border: "rgba(39, 50, 72, 0.25)",  bg: "rgba(39, 50, 72, 0.03)",   label: "text-cadet/70" },
  "reflection":                { border: "rgba(228, 196, 137, 0.5)", bg: "rgba(228, 196, 137, 0.06)", label: "text-[#b89440]" },
  "creative expression":       { border: "rgba(203, 120, 88, 0.35)", bg: "rgba(203, 120, 88, 0.04)", label: "text-sienna" },
};
const DEFAULT_COLOUR = { border: "rgba(39, 50, 72, 0.15)", bg: "rgba(39, 50, 72, 0.02)", label: "text-cadet/50" };

function typeColour(types: string[]) {
  const first = types[0]?.toLowerCase();
  return (first && TYPE_COLOURS[first]) ?? DEFAULT_COLOUR;
}

/* ── tier badge ── */
const TIER_BADGE: Record<string, { text: string; className: string }> = {
  prme:         { text: "free",         className: "bg-[#6b8c63]/10 text-[#6b8c63]" },
  explorer:     { text: "explorer",     className: "bg-sienna/10 text-sienna" },
  practitioner: { text: "practitioner", className: "bg-redwood/10 text-redwood" },
};

/** Show tier badge only when the viewer hasn't unlocked this content tier */
function shouldShowBadge(activityTier: string, viewerTier: string): boolean {
  const tierOrder = ["teaser", "prme", "entitled", "practitioner", "internal"];
  const activityLevel = tierOrder.indexOf(activityTier === "explorer" ? "entitled" : activityTier);
  const viewerLevel = tierOrder.indexOf(viewerTier);
  return viewerLevel < activityLevel;
}

export default function VaultCard({ activity, viewerTier }: VaultCardProps) {
  const colour = typeColour(activity.type);
  const badge = TIER_BADGE[activity.tier];
  const showBadge = badge && shouldShowBadge(activity.tier, viewerTier);

  return (
    <Link
      href={`/vault/${activity.slug}`}
      className="group relative block rounded-xl border border-cadet/10 bg-white hover:shadow-md hover:border-sienna/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: colour.border,
        backgroundColor: colour.bg,
      }}
    >
      {/* cover image */}
      {activity.cover_url && (
        <div className="relative h-[100px] overflow-hidden rounded-t-xl">
          <Image
            src={activity.cover_url}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      )}

      <div className="p-4">
        {/* tier badge + duration pill row */}
        <div className="flex items-center gap-2 mb-2">
          {showBadge && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold ${badge.className}`}>
              {badge.text}
            </span>
          )}
          {activity.duration && (
            <span className="inline-flex items-center rounded-full bg-cadet/6 px-2 py-0.5 text-2xs font-medium text-cadet/50">
              {activity.duration}
            </span>
          )}
        </div>

        {/* name */}
        <h3 className="text-base font-semibold tracking-tight mb-1 line-clamp-2">
          {activity.name}
        </h3>

        {/* headline */}
        {activity.headline && (
          <p className="text-sm text-cadet/60 mb-3 line-clamp-2">
            {activity.headline}
          </p>
        )}

        {/* type + tags row */}
        <div className="flex flex-wrap gap-1.5">
          {activity.type.map((t) => (
            <span
              key={t}
              className={`inline-block rounded-full bg-cadet/5 px-2 py-0.5 text-2xs font-medium ${colour.label}`}
            >
              {t}
            </span>
          ))}
          {activity.skills_developed.slice(0, 3).map((s) => (
            <span
              key={s}
              className="inline-block rounded-full bg-cadet/5 px-2 py-0.5 text-2xs font-medium text-cadet/40"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
