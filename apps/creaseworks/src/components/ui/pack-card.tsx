import Link from "next/link";

interface PackCardProps {
  pack: {
    slug: string;
    title: string;
    description: string | null;
    playdate_count: number;
    price_cents: number | null;
    currency: string;
    family_count?: number;
  };
}

/* ── colour accents per pack slug hash ──
 * Gives each pack a distinct left-border tint from the brand palette,
 * matching the playdate-card visual pattern for consistency.
 */
const PACK_ACCENTS = [
  { border: "rgba(203, 120, 88, 0.35)", bg: "rgba(203, 120, 88, 0.04)" },   /* sienna */
  { border: "rgba(177, 80, 67, 0.3)",  bg: "rgba(177, 80, 67, 0.03)" },     /* redwood */
  { border: "rgba(39, 50, 72, 0.2)",   bg: "rgba(39, 50, 72, 0.03)" },      /* cadet */
  { border: "rgba(228, 196, 137, 0.5)", bg: "rgba(228, 196, 137, 0.06)" },  /* champagne */
];

function packAccent(slug: string) {
  const hash = [...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  return PACK_ACCENTS[Math.abs(hash) % PACK_ACCENTS.length];
}

export default function PackCard({ pack }: PackCardProps) {
  const accent = packAccent(pack.slug);

  return (
    <Link
      href={`/packs/${pack.slug}`}
      className="group relative block rounded-xl border border-cadet/10 bg-white p-5 hover:shadow-md hover:border-sienna/40 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: accent.border,
        backgroundColor: accent.bg,
      }}
    >
      {/* playdate count pill — top right */}
      <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-cadet/6 px-2 py-0.5 text-[10px] font-semibold text-cadet/50">
        {pack.playdate_count} playdate{Number(pack.playdate_count) !== 1 ? "s" : ""}
      </span>

      <h2 className="text-lg font-semibold tracking-tight mb-1 pr-20">
        {pack.title}
      </h2>

      {pack.description && (
        <p className="text-sm text-cadet/60 mb-3 line-clamp-2">
          {pack.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-cadet/50">
        {pack.family_count != null && pack.family_count > 0 && (
          <span className="text-cadet/40">
            {pack.family_count} {pack.family_count === 1 ? "family" : "families"} exploring
          </span>
        )}

        {pack.price_cents != null && (
          <span className="inline-block rounded-full bg-redwood/10 text-redwood px-2 py-0.5 font-medium">
            {pack.currency === "USD" ? "$" : pack.currency}
            {(pack.price_cents / 100).toFixed(2)}
          </span>
        )}
      </div>
    </Link>
  );
}
