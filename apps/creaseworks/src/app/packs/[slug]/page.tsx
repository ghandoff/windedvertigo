import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { requireAuth, getSession } from "@/lib/auth-helpers";
import {
  getPackBySlug,
  getPackBySlugCollective,
  getPackPlaydates,
  getPackPlaydatesEntitled,
  getPackPlaydatesCollective,
} from "@/lib/queries/packs";
import {
  resolveVaultTier,
  getVaultActivitiesForPackPage,
  getVaultActivityCount,
} from "@/lib/queries/vault";
import { checkEntitlement } from "@/lib/queries/entitlements";
import { logAccess } from "@/lib/queries/audit";
import PurchaseButton from "@/components/ui/purchase-button";
import PlaydatePeek from "@/components/playdate-peek";
import SafeHtml from "@/components/ui/safe-html";
import { VaultActivityCard } from "@/components/ui/vault-activity-card";
import type { VaultActivity } from "@/components/ui/vault-activity-card";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

/* ── vault pack slugs ────────────────────────────────────── */

const VAULT_SLUGS = new Set(["vault-explorer", "vault-practitioner"]);

function isVaultPack(slug: string) {
  return VAULT_SLUGS.has(slug);
}

/* ── main page ───────────────────────────────────────────── */

export default async function PackDetailPage({ params }: Props) {
  const { slug } = await params;

  // vault packs use a separate rendering path (no auth required)
  if (isVaultPack(slug)) {
    return renderVaultPackPage(slug);
  }

  return renderPlaydatePackPage(slug);
}

/* ── vault pack renderer ────────────────────────────────── */

async function renderVaultPackPage(slug: string) {
  const session = await getSession();

  const pack = session?.isInternal
    ? await getPackBySlugCollective(slug)
    : await getPackBySlug(slug);

  if (!pack) return notFound();

  const accessTier = await resolveVaultTier(
    session?.orgId ?? null,
    session?.userId ?? null,
    session?.isInternal ?? false,
  );

  const isEntitled = accessTier !== "teaser";
  const isCollective = session?.isInternal && !session?.isAdmin;

  const activityCount = await getVaultActivityCount();
  const activities = await getVaultActivitiesForPackPage();

  // Determine which tier activities this pack unlocks
  const packTier = slug === "vault-practitioner" ? "practitioner" : "explorer";
  const otherPackSlug =
    packTier === "explorer" ? "vault-practitioner" : "vault-explorer";

  return (
    <main className="min-h-screen px-6 py-16 max-w-4xl mx-auto">
      <Link
        href="/vault"
        className="text-sm text-cadet/50 hover:text-cadet mb-6 inline-block"
      >
        &larr; back to vault
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

      {(pack.description || pack.description_html) && (
        <SafeHtml
          html={pack.description_html}
          fallback={pack.description}
          className="text-lg text-cadet/60 mb-4"
        />
      )}

      {/* activity count + price */}
      <div className="flex items-center gap-4 mb-8 text-sm text-cadet/50">
        <span>{activityCount} activities</span>
        {pack.price_cents && (
          <span className="font-medium text-cadet/70">
            ${(pack.price_cents / 100).toFixed(2)}
          </span>
        )}
      </div>

      {/* body content (from Notion) */}
      {pack.body_html && (
        <SafeHtml
          html={pack.body_html}
          fallback={null}
          className="prose prose-sm max-w-none text-cadet/70 mb-10 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-cadet/80 [&_h1]:mb-3 [&_h1]:mt-6 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-3"
          as="div"
        />
      )}

      {/* purchase CTA for non-entitled users */}
      {!isEntitled && (
        <section className="rounded-xl border border-sienna/20 bg-gradient-to-b from-champagne/20 to-champagne/5 p-6 mb-10">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-lg leading-none mt-0.5">🔓</span>
            <div>
              <h2 className="text-sm font-semibold text-cadet/80 mb-1">
                unlock the {packTier === "practitioner" ? "full" : "expanded"}{" "}
                vault
              </h2>
              <p className="text-sm text-cadet/60 mb-4">
                {packTier === "explorer"
                  ? "get access to step-by-step instructions, materials checklists, and age/group guidance for every activity."
                  : "get everything in explorer, plus facilitator notes, video walkthroughs, and preparation guides for every activity."}
              </p>
              {session && session.orgId && pack.price_cents && pack.visible ? (
                <PurchaseButton
                  packCacheId={pack.id}
                  priceCents={pack.price_cents}
                  currency={pack.currency || "USD"}
                />
              ) : session ? (
                <p className="text-sm text-cadet/50">
                  to get access, contact{" "}
                  <a
                    href="mailto:garrett@windedvertigo.com"
                    className="text-redwood hover:text-sienna underline"
                  >
                    garrett@windedvertigo.com
                  </a>
                </p>
              ) : (
                <p className="text-sm text-cadet/50">
                  <Link
                    href="/login"
                    className="text-redwood hover:text-sienna underline"
                  >
                    sign in
                  </Link>{" "}
                  to purchase this pack.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* upsell from explorer to practitioner */}
      {accessTier === "entitled" && packTier === "explorer" && (
        <section className="rounded-xl border border-sienna/20 bg-gradient-to-b from-sienna/5 to-sienna/2 p-6 mb-10">
          <div className="flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">🎓</span>
            <div>
              <h2 className="text-sm font-semibold text-cadet/80 mb-1">
                go deeper with practitioner
              </h2>
              <p className="text-sm text-cadet/60 mb-3">
                add facilitator notes, video walkthroughs, and advanced
                preparation guides for every activity.
              </p>
              <Link
                href={`/packs/${otherPackSlug}`}
                className="inline-block rounded-lg bg-sienna px-5 py-2.5 text-sm text-white font-medium hover:bg-redwood transition-colors"
              >
                see practitioner pack
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* vault activity grid */}
      <section>
        <h2 className="text-sm font-semibold text-cadet/80 mb-4">
          activities in the vault
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((a: VaultActivity) => (
            <VaultActivityCard
              key={a.id}
              activity={a}
              isEntitled={isEntitled}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

/* ── playdate pack renderer (existing logic) ───────────── */

interface PlaydateTeaser {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  status: string;
  primary_function: string | null;
  has_find_again?: boolean;
  age_range: string | null;
  energy_level: string | null;
}

interface PlaydateFull extends PlaydateTeaser {
  find_again_mode: string | null;
}

interface PlaydateCollective extends PlaydateFull {
  design_rationale: string | null;
  developmental_notes: string | null;
  author_notes: string | null;
}

async function renderPlaydatePackPage(slug: string) {
  const session = await requireAuth();

  // collective members can see all packs (including drafts/non-visible)
  const pack = session.isInternal
    ? await getPackBySlugCollective(slug)
    : await getPackBySlug(slug);

  if (!pack) return notFound();

  // collective → auto-entitled to everything
  // otherwise → check per-pack entitlement
  const isCollective = session.isInternal && !session.isAdmin;
  const isEntitled =
    session.isInternal || (await checkEntitlement(session.orgId, pack.id, session.userId));

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

        {(pack.description || pack.description_html) && (
          <SafeHtml
            html={pack.description_html}
            fallback={pack.description}
            className="text-lg text-cadet/60 mb-8"
          />
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

      {(pack.description || pack.description_html) && (
        <SafeHtml
          html={pack.description_html}
          fallback={pack.description}
          className="text-lg text-cadet/60 mb-6"
        />
      )}

      <p className="text-sm text-cadet/50 mb-8">
        {pack.playdate_count} playdate{Number(pack.playdate_count) !== 1 ? "s" : ""} included
      </p>

      {/* playdate teasers */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-cadet/80 mb-4">
          what&apos;s inside
        </h2>
        <ul className="space-y-2">
          {playdates.map((p: PlaydateTeaser) => (
            <PlaydatePeek
              key={p.id}
              title={p.title}
              headline={p.headline}
              primaryFunction={p.primary_function}
              hasFindAgain={p.has_find_again ?? false}
              ageRange={p.age_range}
              energyLevel={p.energy_level}
            />
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
