import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import { getPackBySlug, getPackPatterns, getPackPatternsEntitled } from "@/lib/queries/packs";
import { checkEntitlement } from "@/lib/queries/entitlements";
import { logAccess } from "@/lib/queries/audit";
import PurchaseButton from "@/components/ui/purchase-button";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PackDetailPage({ params }: Props) {
  const session = await requireAuth();
  const { slug } = await params;
  const pack = await getPackBySlug(slug);

  if (!pack) return notFound();

  const isEntitled = await checkEntitlement(session.orgId, pack.id);

  if (isEntitled) {
    // log entitled access (M1: capture IP via server component headers)
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await logAccess(
      session.userId,
      session.orgId,
      null,
      pack.id,
      "view_entitled",
      ip,
      [],
    );

    const patterns = await getPackPatternsEntitled(pack.id);

    return (
      <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
        <Link
          href="/packs"
          className="text-sm text-cadet/50 hover:text-cadet mb-6 inline-block"
        >
          &larr; back to packs
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          {pack.title}
        </h1>

        {pack.description && (
          <p className="text-lg text-cadet/60 mb-8">{pack.description}</p>
        )}

        <section>
          <h2 className="text-sm font-semibold text-cadet/80 mb-4">
            patterns in this pack
          </h2>
          <div className="space-y-3">
            {patterns.map((p: any) => (
              <Link
                key={p.id}
                href={`/packs/${slug}/patterns/${p.slug}`}
                className="block rounded-xl border border-cadet/10 bg-white p-4 hover:shadow-md hover:border-sienna/40 transition-all"
              >
                <h3 className="font-medium">{p.title}</h3>
                {p.headline && (
                  <p className="text-sm text-cadet/60 mt-1">{p.headline}</p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-cadet/50">
                  {p.primary_function && (
                    <span className="rounded-full bg-champagne px-2 py-0.5">
                      {p.primary_function}
                    </span>
                  )}
                  {p.find_again_mode && (
                    <span className="rounded-full bg-redwood/10 text-redwood px-2 py-0.5">
                      includes find again
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    );
  }

  // not entitled â show teaser + CTA
  const patterns = await getPackPatterns(pack.id);

  return (
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      <Link
        href="/packs"
        className="text-sm text-cadet/50 hover:text-cadet mb-6 inline-block"
      >
        &larr; back to packs
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        {pack.title}
      </h1>

      {pack.description && (
        <p className="text-lg text-cadet/60 mb-6">{pack.description}</p>
      )}

      <p className="text-sm text-cadet/50 mb-8">
        {pack.pattern_count} pattern{Number(pack.pattern_count) !== 1 ? "s" : ""} included
      </p>

      {/* pattern teasers */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-cadet/80 mb-4">
          what's inside
        </h2>
        <ul className="space-y-2">
          {patterns.map((p: any) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-cadet/10 bg-champagne/20 px-4 py-3 text-sm"
            >
              <span>{p.title}</span>
              <div className="flex items-center gap-2 text-xs text-cadet/40">
                {p.primary_function && (
                  <span className="rounded-full bg-champagne px-2 py-0.5">
                    {p.primary_function}
                  </span>
                )}
                {p.has_find_again && (
                  <span className="rounded-full bg-redwood/10 text-redwood px-2 py-0.5">
                    find again
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* find again CTA */}
      <section className="rounded-xl border border-redwood/20 bg-redwood/5 p-6 mb-8">
        <h2 className="text-lg font-semibold text-redwood mb-3">
          you've built something. now find it again.
        </h2>
        <p className="text-sm text-cadet/70 mb-3">
          every creaseworks pattern ends with a step we call <em>find again</em>
          &nbsp;&mdash; a prompt that helps you and your participants spot the
          same move in a completely different context.
        </p>
        <p className="text-sm text-cadet/70 mb-3">
          maybe it's the same material doing a new job. maybe it's the
          same structure under a tighter constraint. maybe it's the leap
          from the workshop table to Tuesday morning.
        </p>
        <p className="text-sm text-cadet/70 mb-4">
          find again is where a single activity becomes a transferable skill.
          it's included with every pattern in <strong>{pack.title}</strong>.
        </p>
        {/* purchase or contact CTA */}
        {!session.orgId ? (
          <p className="text-sm text-cadet/50">
            join an organisation to purchase packs.{" "}
            <a
              href="mailto:garrett@windedvertigo.com"
              className="text-redwood hover:text-sienna underline"
            >
              contact us
            </a>{" "}
            to get started.
          </p>
        ) : pack.price_cents && pack.visible ? (
          <PurchaseButton
            packCacheId={pack.id}
            priceCents={pack.price_cents}
            currency={pack.currency || "USD"}
          />
        ) : (
          <p className="text-sm text-cadet/50">
            to get access, contact{" "}
            <a
              href="mailto:garrett@windedvertigo.com"
              className="text-redwood hover:text-sienna underline"
            >
              garrett@windedvertigo.com
            </a>
          </p>
        )}
      </section>
    </main>
  );
}
