/**
 * Pack upsell section for the playbook page.
 * Shows 1–2 visible packs the user hasn't purchased,
 * framed around discovery rather than hard-sell.
 */

import Link from "next/link";

interface UpsellPack {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  playdate_count: number | string;
}

export default function PackUpsellSection({
  packs,
}: {
  packs: UpsellPack[];
}) {
  if (packs.length === 0) return null;

  // Show at most 2 packs
  const shown = packs.slice(0, 2);

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-cadet/60 mb-3">
        keep exploring
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((pack) => (
          <Link
            key={pack.id}
            href={`/packs/${pack.slug}`}
            className="block rounded-xl border border-sienna/15 bg-gradient-to-br from-champagne/10 to-white px-5 py-4 hover:shadow-md hover:border-sienna/30 transition-all"
          >
            <h3 className="text-base font-semibold text-cadet mb-1">
              {pack.title}
            </h3>
            {pack.description && (
              <p className="text-xs text-cadet/50 mb-2 line-clamp-2">
                {pack.description}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cadet/40">
                {pack.playdate_count} playdate{Number(pack.playdate_count) !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-sienna font-medium">
                see what&apos;s inside &rarr;
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
