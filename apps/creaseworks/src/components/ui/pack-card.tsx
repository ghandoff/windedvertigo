import Link from "next/link";

interface PackCardProps {
  pack: {
    slug: string;
    title: string;
    description: string | null;
    playdate_count: number;
    price_cents: number | null;
    currency: string;
  };
}

export default function PackCard({ pack }: PackCardProps) {
  return (
    <Link
      href={`/packs/${pack.slug}`}
      className="block rounded-xl border border-cadet/10 bg-champagne/30 p-5 hover:shadow-md hover:border-sienna/40 transition-all"
    >
      <h2 className="text-lg font-semibold tracking-tight mb-1">
        {pack.title}
      </h2>

      {pack.description && (
        <p className="text-sm text-cadet/60 mb-3 line-clamp-2">
          {pack.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-cadet/50">
        <span>
          {pack.playdate_count} playdate{Number(pack.playdate_count) !== 1 ? "s" : ""}
        </span>

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
