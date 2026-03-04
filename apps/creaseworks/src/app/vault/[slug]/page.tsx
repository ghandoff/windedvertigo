import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import {
  resolveVaultTier,
  getVaultActivityBySlug,
  getRelatedActivities,
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

/** Type colour map — same as vault-activity-card.tsx */
const TYPE_COLORS: Record<string, string> = {
  Energizer: "#AF4F41",
  "Getting to know each other": "#6b8e6b",
  "Playful reflections": "#8b6fb0",
  "RME Related": "#4a7fb5",
};

export default async function VaultActivityPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();

  const accessTier = await resolveVaultTier(
    session?.orgId ?? null,
    session?.userId ?? null,
    session?.isInternal ?? false,
  );

  const activity = await getVaultActivityBySlug(slug, accessTier);
  if (!activity) return notFound();

  // Dev guard
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
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cadet/20 bg-cadet/5 px-3 py-1 text-xs text-cadet/60">
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
            alt=""
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
      <h1 className="text-3xl font-semibold tracking-tight mb-2 text-cadet">
        {activity.name}
      </h1>

      {activity.headline_html ? (
        <SafeHtml
          html={activity.headline_html}
          fallback={activity.headline}
          className="text-lg text-cadet/60 mb-6"
        />
      ) : activity.headline ? (
        <p className="text-lg text-cadet/60 mb-6">{activity.headline}</p>
      ) : null}

      {/* at a glance */}
      <section className="rounded-xl border border-cadet/10 bg-champagne/30 p-6 mb-8">
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
            <GlanceItem label="duration">
              {activity.duration}
            </GlanceItem>
          )}
          {activity.age_range && (
            <GlanceItem label="ages">
              {activity.age_range}
            </GlanceItem>
          )}
          {activity.group_size && (
            <GlanceItem label="group size">
              {activity.group_size}
            </GlanceItem>
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
                  className="rounded-full bg-champagne px-3 py-1 text-xs font-medium text-cadet/70"
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
            className="text-sm text-cadet/80 leading-relaxed"
            as="div"
          />
        </section>
      )}

      {/* facilitator notes (practitioner+) */}
      {hasFacilitatorNotes && (
        <section className="rounded-xl border border-sienna/20 bg-sienna/5 p-6 mb-8">
          <h2 className="text-sm font-semibold text-sienna/80 mb-3">
            facilitator notes
          </h2>
          <SafeHtml
            html={activity.facilitator_notes_html}
            fallback={activity.facilitator_notes}
            className="text-sm text-cadet/70 leading-relaxed"
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
      {accessTier === "entitled" &&
        (activity.facilitator_notes || activity.video_url) && (
          <section className="rounded-xl border border-sienna/20 bg-gradient-to-b from-sienna/5 to-sienna/2 p-6 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">🎓</span>
              <div>
                <h2 className="text-sm font-semibold text-cadet/80 mb-1">
                  practitioner upgrade
                </h2>
                <p className="text-sm text-cadet/60 mb-3">
                  this activity includes facilitator notes
                  {activity.video_url ? " and a video walkthrough" : ""}.
                  upgrade to the practitioner pack for expert-level guidance.
                </p>
                <Link
                  href="/packs/vault-practitioner"
                  className="inline-block rounded-lg bg-sienna px-5 py-2.5 text-sm text-white font-medium hover:bg-redwood transition-colors"
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
        <section className="mt-12 rounded-xl border border-cadet/10 bg-cadet/3 p-4 text-xs text-cadet/40">
          <h2 className="font-semibold text-cadet/50 mb-2">sync metadata</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>notion id</dt>
            <dd className="font-mono">{activity.notion_id}</dd>
            <dt>last edited</dt>
            <dd>{activity.notion_last_edited}</dd>
            <dt>synced at</dt>
            <dd>{activity.synced_at}</dd>
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
        <p className="text-cadet/45 text-xs font-medium">{label}</p>
        <div className="text-cadet/80">{children}</div>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  switch (tier) {
    case "prme":
      return (
        <span className="rounded-full bg-cadet/10 px-2.5 py-0.5 text-xs font-medium text-cadet/60">
          free (PRME)
        </span>
      );
    case "explorer":
      return (
        <span className="rounded-full bg-sienna/15 px-2.5 py-0.5 text-xs font-medium text-sienna">
          explorer pack
        </span>
      );
    case "practitioner":
      return (
        <span className="rounded-full bg-redwood/10 px-2.5 py-0.5 text-xs font-medium text-redwood">
          practitioner pack
        </span>
      );
    default:
      return (
        <span className="rounded-full bg-cadet/8 px-2.5 py-0.5 text-xs text-cadet/50">
          {tier}
        </span>
      );
  }
}

function LockedContentTeaser({ activityTier }: { activityTier: string }) {
  const isFreeTier = activityTier === "prme";

  return (
    <section className="rounded-xl border border-sienna/20 bg-gradient-to-b from-champagne/20 to-champagne/5 p-6 mb-8">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-lg leading-none mt-0.5">🔒</span>
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

      <div className="ml-8 space-y-2 text-sm text-cadet/50 mb-5">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sienna/40" />
          <span>step-by-step activity instructions</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cadet/30" />
          <span>materials needed checklist</span>
        </div>
        {(activityTier === "practitioner" || isFreeTier) && (
          <>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-redwood/40" />
              <span>facilitator notes and tips</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-redwood/60" />
              <span>video walkthrough</span>
            </div>
          </>
        )}
      </div>

      <Link
        href={
          activityTier === "practitioner"
            ? "/packs/vault-practitioner"
            : "/packs/vault-explorer"
        }
        className="inline-block rounded-lg bg-redwood px-5 py-2.5 text-sm text-white font-medium hover:bg-sienna transition-colors"
      >
        {isFreeTier
          ? "explore vault packs"
          : `get the ${activityTier} pack`}
      </Link>
    </section>
  );
}
