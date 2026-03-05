import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
import SafeHtml from "@/components/ui/safe-html";
import { VaultActivityCard } from "@/components/ui/vault-activity-card";
import type { VaultActivity as VaultCardActivity } from "@/components/ui/vault-activity-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const activity = await getVaultActivityMeta(slug);

  if (!activity) {
    return { title: "activity not found" };
  }

  const title = `${activity.name} — activity vault`;
  const description =
    activity.headline
      ?? `${activity.type?.[0] ?? "Activity"} · ${activity.duration ?? ""} · activity vault`.trim();

  return {
    title,
    description,
    ...(activity.cover_url
      ? { openGraph: { images: [{ url: activity.cover_url, width: 1200, height: 630, alt: activity.name }] } }
      : {}),
  };
}

/** Type colour map — matches vault-activity-card.tsx */
const TYPE_COLORS: Record<string, string> = {
  Energizer: "#AF4F41",
  "Getting to know each other": "#6b8e6b",
  "Playful reflections": "#8b6fb0",
  "RME Related": "#4a7fb5",
};

export default async function VaultActivityDetailPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();

  const accessTier = await resolveVaultTier(
    session?.orgId ?? null,
    session?.userId ?? null,
    session?.isInternal ?? false,
  );

  const activity = await getVaultActivityBySlug(slug, accessTier);

  if (!activity) {
    // Check if the activity exists at a higher tier
    const contentTier = await getActivityContentTier(slug);
    if (contentTier) {
      // Activity exists but user doesn't have access — show teaser with upsell
      return notFound();
    }
    return notFound();
  }

  // Dev guard — catch column leaks early
  assertNoLeakedFields(
    [activity] as Record<string, unknown>[],
    `vault_${accessTier}` as "vault_teaser" | "vault_entitled" | "vault_practitioner" | "vault_internal",
  );

  const related = await getRelatedActivities(activity.id);

  const primaryType = activity.type?.[0] ?? null;
  const accent = TYPE_COLORS[primaryType ?? ""] ?? "#6b7b8d";

  const hasBody = accessTier !== "teaser" && activity.body_html;
  const hasFacilitatorNotes =
    (accessTier === "practitioner" || accessTier === "internal") &&
    activity.facilitator_notes_html;
  const hasVideo =
    (accessTier === "practitioner" || accessTier === "internal") &&
    activity.video_url;

  return (
    <main className="min-h-screen px-6 py-16 max-w-3xl mx-auto">
      <Link
        href="/vault"
        className="text-sm text-cadet/50 hover:text-cadet mb-6 inline-block"
      >
        &larr; back to vault
      </Link>

      {/* internal tier indicator */}
      {accessTier === "internal" && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cadet/10 bg-white px-3 py-1 text-xs text-cadet/50">
          <span className="inline-block w-2 h-2 rounded-full bg-sienna" />
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
      <h1 className="text-3xl font-semibold tracking-tight text-cadet mb-2">
        {activity.name}
      </h1>

      {activity.headline_html ? (
        <SafeHtml
          html={activity.headline_html}
          fallback={activity.headline}
          className="text-lg text-cadet/60 mb-6"
          as="p"
        />
      ) : activity.headline ? (
        <p className="text-lg text-cadet/60 mb-6">{activity.headline}</p>
      ) : null}

      {/* at a glance */}
      <section className="rounded-xl border border-cadet/10 bg-champagne/20 p-6 mb-8">
        <h2 className="text-sm font-semibold text-cadet/80 mb-4">
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

      {/* materials needed (entitled+) */}
      {accessTier !== "teaser" &&
        activity.materials_needed?.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-cadet/80 mb-3">
              materials needed
            </h2>
            <ul className="flex flex-wrap gap-2">
              {activity.materials_needed.map((m: string) => (
                <li
                  key={m}
                  className="rounded-full bg-cadet/5 px-3 py-1 text-xs font-medium text-cadet/60"
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
          <h2 className="text-sm font-semibold text-cadet/80 mb-3">
            activity guide
          </h2>
          <SafeHtml
            html={activity.body_html}
            fallback={null}
            className="text-sm leading-relaxed text-cadet/80"
            as="div"
          />
        </section>
      )}

      {/* facilitator notes (practitioner+) */}
      {hasFacilitatorNotes && (
        <section
          className="rounded-xl border p-6 mb-8"
          style={{
            borderColor: "rgba(203,120,88,0.3)",
            backgroundColor: "rgba(203,120,88,0.04)",
          }}
        >
          <h2 className="text-sm font-semibold text-sienna/80 mb-3">
            facilitator notes
          </h2>
          <SafeHtml
            html={activity.facilitator_notes_html}
            fallback={activity.facilitator_notes}
            className="text-sm leading-relaxed text-cadet/80"
            as="div"
          />
        </section>
      )}

      {/* video walkthrough (practitioner+) */}
      {hasVideo && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-cadet/80 mb-3">
            video walkthrough
          </h2>
          <div className="aspect-video rounded-xl overflow-hidden bg-cadet/5">
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

      {/* locked content teaser — only for teaser tier */}
      {accessTier === "teaser" && (
        <LockedContentTeaser activityTier={activity.tier} />
      )}

      {/* entitled but not practitioner — upsell to practitioner */}
      {accessTier === "entitled" && (
        <section
          className="rounded-xl border p-6 mb-8"
          style={{
            borderColor: "rgba(203,120,88,0.3)",
            background: "linear-gradient(to bottom, rgba(203,120,88,0.06), rgba(203,120,88,0.02))",
          }}
        >
          <div className="flex items-start gap-3">
            <div>
              <h2 className="text-sm font-semibold text-cadet/80 mb-1">
                practitioner upgrade
              </h2>
              <p className="text-sm text-cadet/60 mb-3">
                upgrade to the practitioner pack for facilitator notes,
                video walkthroughs, and expert-level guidance on every
                activity.
              </p>
              <Link
                href="/packs"
                className="inline-block rounded-lg bg-redwood px-5 py-2.5 text-sm text-white font-medium hover:bg-sienna transition-colors"
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
          <h2 className="text-sm font-semibold text-cadet/80 mb-4">
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
        <section className="mt-12 rounded-xl border border-cadet/10 bg-white p-4 text-xs text-cadet/50">
          <h2 className="font-semibold mb-2 text-cadet/40">
            sync metadata
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>notion id</dt>
            <dd className="font-mono">{activity.notion_id}</dd>
            <dt>last edited</dt>
            <dd>
              {activity.notion_last_edited instanceof Date
                ? activity.notion_last_edited.toISOString()
                : String(activity.notion_last_edited ?? "\u2014")}
            </dd>
            <dt>synced at</dt>
            <dd>
              {activity.synced_at instanceof Date
                ? activity.synced_at.toISOString()
                : String(activity.synced_at ?? "\u2014")}
            </dd>
          </dl>
        </section>
      )}
    </main>
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
        <p className="text-xs font-medium text-cadet/45">{label}</p>
        <div className="text-cadet/80">{children}</div>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  switch (tier) {
    case "prme":
      return (
        <span className="rounded-full bg-cadet/5 px-2.5 py-0.5 text-xs font-medium text-cadet/50">
          free (PRME)
        </span>
      );
    case "explorer":
      return (
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: "rgba(175,79,65,0.12)", color: "#AF4F41" }}
        >
          explorer pack
        </span>
      );
    case "practitioner":
      return (
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ backgroundColor: "rgba(155,67,67,0.12)", color: "#9b4343" }}
        >
          practitioner pack
        </span>
      );
    default:
      return (
        <span className="rounded-full bg-cadet/5 px-2.5 py-0.5 text-xs text-cadet/50">
          {tier}
        </span>
      );
  }
}

function LockedContentTeaser({ activityTier }: { activityTier: string }) {
  const isFreeTier = activityTier === "prme";

  return (
    <section
      className="rounded-xl border p-6 mb-8"
      style={{
        borderColor: "rgba(175,79,65,0.2)",
        background: "linear-gradient(to bottom, rgba(228,196,137,0.12), rgba(228,196,137,0.04))",
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-cadet/80 mb-1">
            {isFreeTier ? "full activity guide" : "unlock this activity"}
          </h2>
          <p className="text-sm text-cadet/60">
            {isFreeTier
              ? "the full guide includes step-by-step instructions, materials list, and facilitator tips."
              : `this is an ${activityTier}-tier activity. get the ${activityTier} pack to unlock the full guide, materials, and more.`}
          </p>
        </div>
      </div>

      <div className="ml-0 space-y-2 text-sm text-cadet/50 mb-5">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-redwood/40" />
          <span>step-by-step activity instructions</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sienna/40" />
          <span>materials needed checklist</span>
        </div>
        {(activityTier === "practitioner" || isFreeTier) && (
          <>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-redwood/60" />
              <span>facilitator notes and tips</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cadet/30" />
              <span>video walkthrough</span>
            </div>
          </>
        )}
      </div>

      <Link
        href="/packs"
        className="inline-block rounded-lg bg-redwood px-5 py-2.5 text-sm text-white font-medium hover:bg-sienna transition-colors"
      >
        {isFreeTier ? "explore vault packs" : `get the ${activityTier} pack`}
      </Link>
    </section>
  );
}
