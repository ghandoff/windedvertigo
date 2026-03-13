import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import {
  resolveVaultTier,
  getVaultActivityBySlug,
  getVaultActivityMeta,
  getRelatedActivities,
  getActivityContentTier,
} from "@/lib/queries/vault";
import { assertNoLeakedFields } from "@/lib/security/assert-no-leaked-fields";
import { typeColor } from "@/lib/ui-constants";
import SafeHtml from "@/components/ui/safe-html";
import { VaultActivityCard } from "@/components/ui/vault-activity-card";
import type { VaultActivity as VaultCardActivity } from "@/components/ui/vault-activity-card";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

const BASE_URL = "https://windedvertigo.com/harbour/vertigo-vault";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const activity = await getVaultActivityMeta(slug);

  if (!activity) {
    return { title: "activity not found — vertigo.vault" };
  }

  const title = `${activity.name} — vertigo.vault`;
  const description =
    activity.headline
      ?? `${activity.type?.[0] ?? "Activity"} · ${activity.duration ?? ""} · vertigo.vault`.trim();
  const url = `${BASE_URL}/${activity.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: "winded.vertigo",
      ...(activity.cover_url
        ? { images: [{ url: activity.cover_url, width: 1200, height: 630, alt: activity.name }] }
        : {}),
    },
    twitter: {
      card: activity.cover_url ? "summary_large_image" : "summary",
      title,
      description,
      ...(activity.cover_url ? { images: [activity.cover_url] } : {}),
    },
  };
}

export default async function VaultActivityPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();

  const accessTier = await resolveVaultTier(
    session?.orgId ?? null,
    session?.userId ?? null,
    session?.isInternal ?? false,
  );

  const activity = await getVaultActivityBySlug(slug, accessTier);

  if (!activity) {
    // Activity exists but user's tier doesn't include it → redirect to pack page
    const contentTier = await getActivityContentTier(slug);
    if (contentTier === "explorer") redirect("/explorer");
    if (contentTier === "practitioner") redirect("/practitioner");
    return notFound();
  }

  // Dev guard — PRME activities use the expanded prme_free assertion tier
  // since they expose body + catalyst prompts to all users.
  const isPrme = activity.tier === "prme";
  const assertTier =
    isPrme && (accessTier === "teaser" || accessTier === "entitled")
      ? "vault_prme_free"
      : (`vault_${accessTier}` as "vault_teaser" | "vault_entitled" | "vault_practitioner" | "vault_internal");
  assertNoLeakedFields(
    [activity] as Record<string, unknown>[],
    assertTier,
  );

  const related = await getRelatedActivities(activity.id, accessTier);
  // Related activities use teaser columns regardless of tier (card display only)
  assertNoLeakedFields(related as Record<string, unknown>[], "vault_teaser");

  const primaryType = activity.type?.[0] ?? null;
  const accent = typeColor(primaryType);

  // Column selection is now content-tier-aware: if a field was fetched,
  // the data will be present. If not, it'll be undefined/null.
  const hasBody = !!activity.body_html;
  const hasWarmup = !!activity.warmup_prompt_html || !!activity.warmup_prompt;
  const hasConnection = !!activity.connection_prompt_html || !!activity.connection_prompt;
  const hasTransfer = !!activity.transfer_prompt_html || !!activity.transfer_prompt;
  const hasCatalysts = hasWarmup || hasConnection || hasTransfer;
  const hasVideo = !!activity.video_url;

  /**
   * JSON-LD structured data — LearningResource schema for search engines.
   * All values come from our own database (trusted), serialised via
   * JSON.stringify which escapes any special characters.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: activity.name,
    description: activity.headline ?? undefined,
    url: `${BASE_URL}/${slug}`,
    ...(activity.cover_url ? { image: activity.cover_url } : {}),
    provider: {
      "@type": "Organization",
      name: "winded.vertigo",
      url: "https://windedvertigo.com",
    },
    educationalLevel: "professional development",
    learningResourceType: primaryType ?? "Activity",
    ...(activity.duration ? { timeRequired: `PT${activity.duration.replace(/\s*min(utes?)?/i, "M")}` } : {}),
    isAccessibleForFree: activity.tier === "prme",
    inLanguage: "en",
  };

  return (
    <>
    {/* JSON-LD: all values from our DB, serialised safely via JSON.stringify */}
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <a href="#activity-content" className="skip-link">
      Skip to activity content
    </a>
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      {/* mini nav — back link + sign-in for unauthenticated users */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="text-sm hover:opacity-80 inline-block transition-opacity"
          style={{ color: "var(--vault-text-muted)" }}
        >
          &larr; back to vault
        </Link>
        {!session && (
          <Link
            href={`/login?callbackUrl=/${slug}`}
            className="rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: "rgba(175,79,65,0.2)",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            sign in
          </Link>
        )}
      </div>

      {/* internal tier indicator */}
      {accessTier === "internal" && (
        <div
          className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
          style={{
            borderColor: "var(--vault-border)",
            backgroundColor: "rgba(255,255,255,0.03)",
            color: "var(--vault-text-muted)",
          }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--vault-accent)" }}
          />
          internal view
        </div>
      )}

      {/* cover image */}
      {activity.cover_url && (
        <div className="w-full h-[200px] rounded-xl overflow-hidden mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activity.cover_url}
            alt={`Cover image for ${activity.name}`}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* type colour bar */}
      <div
        className="h-[4px] rounded-full mb-4 w-16"
        style={{ backgroundColor: accent }}
      />

      {/* header */}
      <h1
        id="activity-content"
        className="text-3xl font-semibold tracking-tight mb-2"
        style={{ color: "var(--vault-text)" }}
      >
        {activity.name}
      </h1>

      {activity.headline_html ? (
        <SafeHtml
          html={activity.headline_html}
          fallback={activity.headline}
          className="text-lg mb-6"
          as="p"
        />
      ) : activity.headline ? (
        <p className="text-lg mb-6" style={{ color: "var(--vault-text-muted)" }}>
          {activity.headline}
        </p>
      ) : null}

      {/* at a glance */}
      <section
        className="rounded-xl border p-6 mb-8"
        style={{
          borderColor: "var(--vault-border)",
          backgroundColor: "var(--vault-card-bg)",
        }}
      >
        <h2
          className="text-sm font-semibold mb-4"
          style={{ color: "rgba(232,237,243,0.8)" }}
        >
          at a glance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {primaryType && (
            <GlanceItem label="type">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white/90"
                style={{ backgroundColor: accent }}
              >
                {primaryType}
              </span>
            </GlanceItem>
          )}
          {activity.duration && (
            <GlanceItem label="duration">{activity.duration}</GlanceItem>
          )}
          {activity.age_range && (
            <GlanceItem label="ages">{activity.age_range}</GlanceItem>
          )}
          {activity.group_size && (
            <GlanceItem label="group size">{activity.group_size}</GlanceItem>
          )}
          {activity.format?.length > 0 && (
            <GlanceItem label="format">
              {activity.format.join(", ")}
            </GlanceItem>
          )}
          {activity.skills_developed?.length > 0 && (
            <GlanceItem label="skills developed">
              {activity.skills_developed.join(", ")}
            </GlanceItem>
          )}
          {/* content tier badge */}
          <GlanceItem label="tier">
            <TierBadge tier={activity.tier} />
          </GlanceItem>
        </div>
      </section>

      {/* materials needed — shown when column was fetched (PRME free or entitled+) */}
      {activity.materials_needed?.length > 0 && (
          <section className="mb-8">
            <h2
              className="text-sm font-semibold mb-3"
              style={{ color: "rgba(232,237,243,0.8)" }}
            >
              materials needed
            </h2>
            <ul className="flex flex-wrap gap-2">
              {activity.materials_needed.map((m: string) => (
                <li
                  key={m}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: "var(--vault-card-bg)",
                    color: "var(--vault-text-muted)",
                  }}
                >
                  {m}
                </li>
              ))}
            </ul>
          </section>
        )}

      {/* full body content (entitled+) */}
      {hasBody && (
        <section className="mb-8">
          <h2
            className="text-sm font-semibold mb-3"
            style={{ color: "rgba(232,237,243,0.8)" }}
          >
            activity guide
          </h2>
          <SafeHtml
            html={activity.body_html}
            fallback={null}
            className="text-sm leading-relaxed"
            as="div"
          />
        </section>
      )}

      {/* play catalyst tiles (practitioner+) */}
      {hasCatalysts && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {hasWarmup && (
            <CatalystTile
              icon="🔥"
              title="warm up"
              accentColor="rgba(210,130,80,0.8)"
              borderColor="rgba(210,130,80,0.2)"
              bgColor="rgba(210,130,80,0.06)"
              html={activity.warmup_prompt_html}
              fallback={activity.warmup_prompt}
            />
          )}
          {hasConnection && (
            <CatalystTile
              icon="🤝"
              title="connect"
              accentColor="rgba(107,142,107,0.9)"
              borderColor="rgba(107,142,107,0.2)"
              bgColor="rgba(107,142,107,0.06)"
              html={activity.connection_prompt_html}
              fallback={activity.connection_prompt}
            />
          )}
          {hasTransfer && (
            <CatalystTile
              icon="🏠"
              title="take it home"
              accentColor="rgba(130,130,190,0.9)"
              borderColor="rgba(130,130,190,0.2)"
              bgColor="rgba(130,130,190,0.06)"
              html={activity.transfer_prompt_html}
              fallback={activity.transfer_prompt}
            />
          )}
        </div>
      )}

      {/* video walkthrough (practitioner+) */}
      {hasVideo && (
        <section className="mb-8">
          <h2
            className="text-sm font-semibold mb-3"
            style={{ color: "rgba(232,237,243,0.8)" }}
          >
            video walkthrough
          </h2>
          <div
            className="aspect-video rounded-xl overflow-hidden"
            style={{ backgroundColor: "var(--vault-card-bg)" }}
          >
            <iframe
              src={activity.video_url}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`${activity.name} video walkthrough`}
            />
          </div>
        </section>
      )}

      {/* locked content teaser — only for teaser users viewing non-PRME activities */}
      {accessTier === "teaser" && !isPrme && (
        <LockedContentTeaser activityTier={activity.tier} slug={slug} isSignedIn={!!session} />
      )}

      {/* PRME video upsell — teaser/entitled users viewing PRME activities */}
      {isPrme && !hasVideo && (accessTier === "teaser" || accessTier === "entitled") && (
        <PrmeVideoUpsell />
      )}

      {/* sign-in prompt for unauthenticated users on free content */}
      {!session && isPrme && (
        <section
          className="rounded-xl border p-5 mb-8 flex items-center justify-between gap-4 flex-wrap"
          style={{
            borderColor: "var(--vault-border)",
            backgroundColor: "rgba(107,142,107,0.06)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-base leading-none">👤</span>
            <p className="text-sm" style={{ color: "var(--vault-text-muted)" }}>
              <span style={{ color: "var(--vault-text)" }}>sign in</span> to
              save your favourites and unlock 50+ more activities with an
              explorer or practitioner pack.
            </p>
          </div>
          <Link
            href={`/login?callbackUrl=/${slug}`}
            className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: "rgba(107,142,107,0.25)",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            sign in &rarr;
          </Link>
        </section>
      )}

      {/* entitled but not practitioner — upsell to practitioner */}
      {accessTier === "entitled" && (
        <section
          className="rounded-xl border p-6 mb-8"
          style={{
            borderColor: "rgba(175,79,65,0.2)",
            background: "linear-gradient(to bottom, rgba(175,79,65,0.06), rgba(175,79,65,0.02))",
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">🎓</span>
            <div>
              <h2
                className="text-sm font-semibold mb-1"
                style={{ color: "rgba(232,237,243,0.8)" }}
              >
                practitioner upgrade
              </h2>
              <p
                className="text-sm mb-3"
                style={{ color: "var(--vault-text-muted)" }}
              >
                upgrade to the practitioner pack for play catalyst coaching
                prompts, video walkthroughs, and expert-level guidance on
                every activity.
              </p>
              <Link
                href="/practitioner"
                className="inline-block rounded-lg px-5 py-2.5 text-sm text-white font-medium transition-colors"
                style={{ backgroundColor: "var(--vault-accent)" }}
              >
                see practitioner pack
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* related activities */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2
            className="text-sm font-semibold mb-4"
            style={{ color: "rgba(232,237,243,0.8)" }}
          >
            related activities
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((r: VaultCardActivity) => (
              <VaultActivityCard
                key={r.id}
                activity={r}
                isEntitled={accessTier !== "teaser"}
              />
            ))}
          </div>
        </section>
      )}

      {/* internal sync metadata */}
      {accessTier === "internal" && (
        <section
          className="mt-12 rounded-xl border p-4 text-xs"
          style={{
            borderColor: "var(--vault-border)",
            backgroundColor: "rgba(255,255,255,0.02)",
            color: "var(--vault-text-muted)",
          }}
        >
          <h2 className="font-semibold mb-2" style={{ color: "rgba(232,237,243,0.5)" }}>
            sync metadata
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>notion id</dt>
            <dd className="font-mono">{activity.notion_id}</dd>
            <dt>last edited</dt>
            <dd>
              {activity.notion_last_edited instanceof Date
                ? activity.notion_last_edited.toISOString()
                : String(activity.notion_last_edited ?? "—")}
            </dd>
            <dt>synced at</dt>
            <dd>
              {activity.synced_at instanceof Date
                ? activity.synced_at.toISOString()
                : String(activity.synced_at ?? "—")}
            </dd>
          </dl>
        </section>
      )}
    </main>
    </>
  );
}

/* ── helper components ──────────────────────────────────────────── */

function GlanceItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div>
        <p className="text-xs font-medium" style={{ color: "rgba(232,237,243,0.45)" }}>
          {label}
        </p>
        <div style={{ color: "rgba(232,237,243,0.8)" }}>{children}</div>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  switch (tier) {
    case "prme":
      return (
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--vault-text-muted)" }}
        >
          free (PRME)
        </span>
      );
    case "explorer":
      return (
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: "rgba(175,79,65,0.15)", color: "#d4836f" }}
        >
          explorer pack
        </span>
      );
    case "practitioner":
      return (
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: "rgba(155,67,67,0.15)", color: "#c47373" }}
        >
          practitioner pack
        </span>
      );
    default:
      return (
        <span
          className="rounded-full px-2.5 py-0.5 text-xs"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--vault-text-muted)" }}
        >
          {tier}
        </span>
      );
  }
}

function LockedContentTeaser({
  activityTier,
  slug,
  isSignedIn,
}: {
  activityTier: string;
  slug: string;
  isSignedIn: boolean;
}) {
  return (
    <section
      className="rounded-xl border p-6 mb-8"
      style={{
        borderColor: "rgba(175,79,65,0.2)",
        background: "linear-gradient(to bottom, rgba(175,79,65,0.08), rgba(175,79,65,0.02))",
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <span className="text-lg leading-none mt-0.5">🔒</span>
        <div>
          <h2
            className="text-sm font-semibold mb-1"
            style={{ color: "rgba(232,237,243,0.8)" }}
          >
            unlock this activity
          </h2>
          <p className="text-sm" style={{ color: "var(--vault-text-muted)" }}>
            this is an {activityTier}-tier activity. get the {activityTier} pack
            to unlock the full guide, materials, and more.
          </p>
        </div>
      </div>

      <div className="ml-8 space-y-2 text-sm mb-5" style={{ color: "var(--vault-text-muted)" }}>
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "rgba(175,79,65,0.4)" }}
          />
          <span>step-by-step activity instructions</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          />
          <span>materials needed checklist</span>
        </div>
        {activityTier === "practitioner" && (
          <>
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "rgba(155,67,67,0.4)" }}
              />
              <span>play catalyst coaching prompts</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "rgba(155,67,67,0.6)" }}
              />
              <span>video walkthrough</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href={
            activityTier === "practitioner"
              ? "/practitioner"
              : "/explorer"
          }
          className="inline-block rounded-lg px-5 py-2.5 text-sm text-white font-medium transition-colors"
          style={{ backgroundColor: "var(--vault-accent)" }}
        >
          get the {activityTier} pack
        </Link>
        {!isSignedIn && (
          <Link
            href={`/login?callbackUrl=/${slug}`}
            className="text-xs transition-opacity hover:opacity-80"
            style={{ color: "var(--vault-text-muted)" }}
          >
            already have access? <span className="underline">sign in</span>
          </Link>
        )}
      </div>
    </section>
  );
}

/** Play catalyst tile — warm-up, connect, or take-it-home coaching prompt. */
function CatalystTile({
  icon,
  title,
  accentColor,
  borderColor,
  bgColor,
  html,
  fallback,
}: {
  icon: string;
  title: string;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  html: string | null;
  fallback: string | null;
}) {
  return (
    <section
      className="rounded-xl border p-5"
      style={{ borderColor, backgroundColor: bgColor }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base leading-none">{icon}</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
          {title}
        </h3>
      </div>
      <SafeHtml
        html={html}
        fallback={fallback}
        className="text-sm leading-relaxed"
        as="div"
      />
    </section>
  );
}

/** Subtle upsell for PRME activities — content is free, video is the add-on. */
function PrmeVideoUpsell() {
  return (
    <section
      className="rounded-xl border p-5 mb-8 flex items-center justify-between gap-4 flex-wrap"
      style={{
        borderColor: "rgba(155,67,67,0.15)",
        backgroundColor: "rgba(155,67,67,0.04)",
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-base leading-none">🎬</span>
        <p className="text-sm" style={{ color: "var(--vault-text-muted)" }}>
          want a <span style={{ color: "var(--vault-text)" }}>video walkthrough</span> for
          this activity? upgrade to the practitioner pack.
        </p>
      </div>
      <Link
        href="/practitioner"
        className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors"
        style={{
          backgroundColor: "rgba(155,67,67,0.2)",
          color: "rgba(255,255,255,0.85)",
        }}
      >
        practitioner pack &rarr;
      </Link>
    </section>
  );
}
