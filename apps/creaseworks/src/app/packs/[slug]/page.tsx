import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getPackBySlug,
  getPackBySlugCollective,
  getPackPlaydates,
  getPackPlaydatesEntitled,
  getPackPlaydatesCollective,
} from "@/lib/queries/packs";
import { checkEntitlement } from "@/lib/queries/entitlements";
import { logAccess } from "@/lib/queries/audit";
import PurchaseButton from "@/components/ui/purchase-button";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

interface PlaydateTeaser {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  status: string;
  primary_function: string | null;
  has_find_again?: boolean;
}

interface PlaydateFull extends PlaydateTeaser {
  find_again_mode: string | null;
}

interface PlaydateCollective extends PlaydateFull {
  design_rationale: string | null;
  developmental_notes: string | null;
  author_notes: string | null;
}

export default async function PackDetailPage({ params }: Props) {
  const session = await requireAuth();
  const { slug } = await params;

  // collective members can see all packs (including drafts/non-visible)
  const pack = session.isInternal
    ? await getPackBySlugCollective(slug)
    : await getPackBySlug(slug);

  if (!pack) return notFound();

  // collective → auto-entitled to everything
  // otherwise → check per-pack entitlement
  const isCollective = session.isInternal && !session.isAdmin;
  const isEntitled =
    session.isInternal || (await checkEntitlement(session.orgId, pack.id));

  if (isEntitled) {
    // log access
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await logAccess(
      session.userId,
      session.orgId,
      null,
      pack.id,
      session.isInternal ? "view_collective" : "view_entitled",
      ip,
      [],
    );

    // collective gets extra fields + draft playdates; entitled gets standard
    const playdates = session.isInternal
      ? await getPackPlaydatesCollective(pack.id)
      : await getPackPlaydatesEntitled(pack.id);

    return (
      <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
        <Link
          href="/packs"
          className="text-sm text-cadet/50 hover:text-cadet mb-6 inline-block"
        >
          &larr; back to packs
        </Link>

        {/* collective indicator */}
        {isCollective && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cadet/20 bg-cadet/5 px-3 py-1 text-xs text-cadet/60">
            <span className="inline-block w-2 h-2 rounded-full bg-sienna" />
            collective view
          </div>
        )}

        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          {pack.title}
        </h1>

        {pack.description && (
          <p className="text-lg text-cadet/60 mb-8">{pack.description}</p>
        )}

        {/* draft status warning */}
        {pack.status !== "ready" && (
          <div className="mb-6 rounded-lg border border-sienna/30 bg-sienna/5 px-4 py-2 text-sm text-sienna">
            this pack is still in draft — not visible to clients yet.
          </div>
        )}

        <section>
          <h2 className="text-sm font-semibold text-cadet/80 mb-4">
            playdates in this pack
          </h2>
          <div className="space-y-3">
            {playdates.map((p: PlaydateFull | PlaydateCollective) => (
              <Link
                key={p.id}
                href={`/packs/${slug}/playdates/${p.slug}`}
                className="block rounded-xl border border-cadet/10 bg-white p-4 hover:shadow-md hover:border-sienna/40 transition-all"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{p.title}</h3>
                  {p.status !== "ready" && (
                    <span className="rounded-full bg-sienna/10 text-sienna px-2 py-0.5 text-xs font-medium">
                      draft
                    </span>
                  )}
                </div>
                {p.headline && (
                  <p className="text-sm text-cadet/60 mt-1">{p.headline}</p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-cadet/50">
                  {p.primary_function && (
                    <span className="rounded-full bg-champagne px-2 py-0.5">
                      {p.primary_function}
                    </span>
                  )}
                  {(p.find_again_mode || p.has_find_again) && (
                    <span className="rounded-full bg-redwood/10 text-redwood px-2 py-0.5">
                      find again
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

  // not entitled — show teaser + CTA
  const playdates = await getPackPlaydates(pack.id);

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
        {pack.playdate_count} playdate{Number(pack.playdate_count) !== 1 ? "s" : ""} included
      </p>

      {/* playdate teasers */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-cadet/80 mb-4">
          what's inside
        </h2>
        <ul className="space-y-2">
          {playdates.map((p: PlaydateTeaser) => (
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
          you tried something. now find it again everywhere.
        </h2>
        <p className="text-sm text-cadet/70 mb-3">
          every playdate ends with something we call <em>find again</em>
          &nbsp;&mdash; a little prompt that helps you notice the same
          idea showing up in totally different places.
        </p>
        <p className="text-sm text-cadet/70 mb-3">
          maybe it&apos;s the same material doing a new job. maybe it&apos;s the
          same shape with a tighter rule. maybe it&apos;s the jump from
          the kitchen table to the walk to school.
        </p>
        <p className="text-sm text-cadet/70 mb-4">
          that&apos;s when one playdate becomes a way of seeing.
          it&apos;s included with every playdate in <strong>{pack.title}</strong>.
        </p>
        {/* purchase or contact CTA */}
        {!session.orgId ? (
          <p className="text-sm text-cadet/50">
            join a team to grab packs.{" "}
            <a
              href="mailto:garrett@windedvertigo.com"
              className="text-redwood hover:text-sienna underline"
            >
              get in touch
            </a>{" "}
            and we&apos;ll help you get started.
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
