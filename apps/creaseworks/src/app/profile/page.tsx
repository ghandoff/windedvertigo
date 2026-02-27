/**
 * /profile — hybrid treasure box + manage mode.
 *
 * Default view is warm and visual — your name, your packs as a
 * visual collection, sign-out. Feels like opening a play journal.
 *
 * A subtle "manage" toggle reveals the grownup stuff: team
 * management, analytics, and domain verification. Only shows
 * for users who have an org or are collective/admin.
 *
 * Designed for shared devices where both grownups and kids navigate.
 */

import Link from "next/link";
import { sql } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getOrgMembers,
  getOrgVerifiedDomains,
} from "@/lib/queries/organisations";
import {
  getUserProgressSummary,
  recomputeUserProgress,
} from "@/lib/queries/collections";
import { getRunsForUser, type RunRow } from "@/lib/queries/runs";
import { getProfileStats } from "@/lib/queries/profile-stats";
import TeamManager from "@/app/team/team-manager";
import DomainVerifier from "@/app/team/domain-verifier";
import AnalyticsDashboard from "@/app/analytics/analytics-dashboard";
import TierCard, { TIERS, getTierState } from "@/components/ui/tier-card";
import ProfileDashboard from "@/components/profile-dashboard";
import ProfileYourPacks from "@/components/profile-your-packs";
import ProfileWhatsNext from "@/components/profile-whats-next";
import { getOrgPacksWithProgress } from "@/lib/queries/entitlements";
import { getRecommendedPacks } from "@/lib/queries/packs";
import ProfileManageToggle from "./manage-toggle";
import NotificationPrefs from "./notification-prefs";
import PlayContextSwitcher from "./play-context-switcher";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    manage?: string;
    verify?: string;
    domain?: string;
    reason?: string;
    unsubscribed?: string;
  }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;

  const showManage = params.manage === "true";

  /* ---- tier + display name ---------------------------------------- */
  const tierLabel = session.isAdmin
    ? "admin"
    : session.isInternal
      ? "collective"
      : session.orgId
        ? "entitled"
        : "sampler";

  const displayName = session.email.split("@")[0].replace(/[._]/g, " ");

  const initials = (session.email.charAt(0) ?? "?").toUpperCase();

  /* ---- play stats -------------------------------------------------- */
  await recomputeUserProgress(session.userId);
  const [summary, recentRuns, profileStats] = await Promise.all([
    getUserProgressSummary(session.userId),
    getRunsForUser(session, 3, 0),
    getProfileStats(session.userId),
  ]);
  const hasActivity = summary.total_tried > 0;

  /* ---- play contexts ------------------------------------------------ */
  const ctxResult = await sql.query(
    `SELECT play_contexts, active_context_name FROM users WHERE id = $1`,
    [session.userId],
  );
  const playContexts = (ctxResult.rows[0]?.play_contexts ?? []) as Array<{
    name: string;
    age_groups: string[];
    contexts: string[];
    energy: string;
    created_at: string;
  }>;
  const activeContextName: string | null =
    ctxResult.rows[0]?.active_context_name ?? null;

  /* ---- team data (only if user has an org) ------------------------- */
  const hasOrg = !!session.orgId;
  const [members, domains] = hasOrg
    ? await Promise.all([
        getOrgMembers(session.orgId!),
        session.orgRole === "admin"
          ? getOrgVerifiedDomains(session.orgId!)
          : Promise.resolve([]),
      ])
    : [[], []];

  /* ---- pack progress + recommendations ------------------------------ */
  const [ownedPacks, recommendedPacks] = await Promise.all([
    hasOrg
      ? getOrgPacksWithProgress(session.orgId!, session.userId)
      : Promise.resolve([]),
    getRecommendedPacks(session.orgId, session.userId),
  ]);

  /* show manage toggle for everyone (notification prefs are universal) */
  const canManage = true;

  return (
    <main className="min-h-screen px-4 pt-8 pb-24 sm:px-6 sm:pt-16 sm:pb-16 max-w-4xl mx-auto">
      {/* ---- unsubscribe confirmation banner ----------------------- */}
      {params.unsubscribed === "true" && (
        <div
          className="rounded-xl border px-4 py-3 mb-6"
          style={{
            borderColor: "rgba(39, 50, 72, 0.15)",
            backgroundColor: "rgba(39, 50, 72, 0.03)",
          }}
        >
          <p
            className="text-sm"
            style={{ color: "var(--wv-cadet)", opacity: 0.7 }}
          >
            you&apos;ve been unsubscribed from the weekly digest. you can
            re-enable it anytime in the manage section below.
          </p>
        </div>
      )}
      {params.unsubscribed === "error" && (
        <div
          className="rounded-xl border px-4 py-3 mb-6"
          style={{
            borderColor: "rgba(177, 80, 67, 0.2)",
            backgroundColor: "rgba(177, 80, 67, 0.05)",
          }}
        >
          <p
            className="text-sm"
            style={{ color: "var(--wv-redwood)" }}
          >
            something went wrong with unsubscribing. the link may have
            expired — try toggling the digest off in the manage section below.
          </p>
        </div>
      )}

      {/* ---- profile header — warm + personal ---------------------- */}
      <div className="flex items-center gap-4 mb-10">
        {/* avatar circle */}
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full text-lg font-bold"
          style={{
            width: 56,
            height: 56,
            backgroundColor: "var(--wv-sienna)",
            color: "var(--wv-white)",
          }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight truncate">
            {displayName}
          </h1>
          <div className="flex items-center gap-2 text-sm text-cadet/40 mt-0.5">
            {session.orgName && <span>{session.orgName}</span>}
            {session.orgName && (
              <span className="text-cadet/15">&middot;</span>
            )}
            <span
              className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-px rounded-full"
              style={{
                backgroundColor:
                  tierLabel === "admin"
                    ? "rgba(177, 80, 67, 0.12)"
                    : tierLabel === "collective"
                      ? "rgba(203, 120, 88, 0.12)"
                      : "rgba(39, 50, 72, 0.06)",
                color:
                  tierLabel === "admin"
                    ? "var(--wv-redwood)"
                    : tierLabel === "collective"
                      ? "var(--wv-sienna)"
                      : "var(--wv-cadet)",
              }}
            >
              {tierLabel}
            </span>
          </div>
        </div>
      </div>

      {/* ---- your play stats ---------------------------------------- */}
      {hasActivity ? (
        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-3">your play</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            <StatPill label={`${summary.total_tried} tried`} />
            {summary.total_found > 0 && (
              <StatPill label={`${summary.total_found} found`} accent="champagne" />
            )}
            {summary.total_folded > 0 && (
              <StatPill label={`${summary.total_folded} folded`} accent="sienna" />
            )}
            {summary.total_found_again > 0 && (
              <StatPill label={`${summary.total_found_again} found again`} accent="redwood" />
            )}
          </div>
          {recentRuns.length > 0 && (
            <div className="space-y-1.5">
              {recentRuns.map((run: RunRow) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between text-sm rounded-lg border border-cadet/5 px-4 py-2.5"
                >
                  <span className="text-cadet font-medium truncate">
                    {run.playdate_title ?? run.title}
                  </span>
                  {run.run_date && (
                    <span className="text-cadet/35 text-xs whitespace-nowrap ml-3">
                      {new Date(run.run_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              ))}
              <Link
                href="/playbook"
                className="text-xs text-sienna/70 hover:text-sienna transition-colors inline-block mt-1"
              >
                see all in playbook &rarr;
              </Link>
            </div>
          )}
        </section>
      ) : (
        <section className="mb-10 rounded-xl border border-cadet/10 px-5 py-4">
          <p className="text-2xl mb-2" aria-hidden>🌱</p>
          <p className="text-sm text-cadet/60">
            your play journey starts here!{" "}
            <Link
              href="/sampler"
              className="text-redwood hover:text-sienna transition-colors"
            >
              browse the sampler
            </Link>{" "}
            to get started.
          </p>
        </section>
      )}

      {/* ---- profile dashboard ---------------------------------------- */}
      <ProfileDashboard stats={profileStats} />

      {/* ---- your packs — owned packs with progress ------------------- */}
      <ProfileYourPacks packs={ownedPacks} />

      {/* ---- what's next — recommended unowned packs ------------------- */}
      <ProfileWhatsNext packs={recommendedPacks} />

      {/* ---- your journey — tier cards ----------------------------- */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold tracking-tight mb-1">your journey</h2>
        <p className="text-sm text-cadet/40 mb-5">
          where you are and where you could go. tap any tier to explore.
        </p>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <TierCard
              key={tier.key}
              tier={tier}
              state={getTierState(tier.key, tierLabel)}
            />
          ))}
        </div>
      </section>

      {/* ---- manage toggle (grownup stuff) ------------------------- */}
      {canManage && (
        <>
          <ProfileManageToggle isOpen={showManage} />

          {showManage && (
            <div className="mt-6 space-y-12">
              {/* notifications section */}
              <section>
                <h3 className="text-lg font-semibold tracking-tight mb-1">
                  notifications
                </h3>
                <p className="text-sm text-cadet/40 mb-4">
                  control what creaseworks sends to your inbox.
                </p>
                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: "rgba(39, 50, 72, 0.1)", backgroundColor: "var(--wv-white)" }}
                >
                  <NotificationPrefs />
                </div>
              </section>

              {/* play contexts section */}
              <section>
                <h3 className="text-lg font-semibold tracking-tight mb-1">
                  play contexts
                </h3>
                <p className="text-sm text-cadet/40 mb-4">
                  save different play settings for home, school, travel — and switch between them.
                </p>
                {playContexts.length > 0 ? (
                  <PlayContextSwitcher
                    contexts={playContexts}
                    activeContextName={activeContextName}
                  />
                ) : (
                  <a
                    href="/onboarding?edit=true"
                    className="block rounded-xl border-2 border-dashed border-cadet/10 px-5 py-4 text-center text-sm text-cadet/40 hover:border-sienna/30 hover:text-sienna/60 transition-colors"
                  >
                    + create your first play context
                  </a>
                )}
              </section>

              {/* team section */}
              {hasOrg && (
                <section>
                  {/* verification callback banners */}
                  {params.verify === "success" && params.domain && (
                    <div
                      className="rounded-xl border px-4 py-3 mb-6"
                      style={{
                        borderColor: "rgba(42, 157, 80, 0.2)",
                        backgroundColor: "rgba(42, 157, 80, 0.05)",
                      }}
                    >
                      <p
                        className="text-sm"
                        style={{ color: "var(--color-success-vivid)" }}
                      >
                        <strong>@{params.domain}</strong> has been verified.
                        anyone who signs in with an @{params.domain} email will
                        now auto-join your organisation.
                      </p>
                    </div>
                  )}
                  {params.verify === "error" && (
                    <div
                      className="rounded-xl border px-4 py-3 mb-6"
                      style={{
                        borderColor: "rgba(177, 80, 67, 0.2)",
                        backgroundColor: "rgba(177, 80, 67, 0.05)",
                      }}
                    >
                      <p
                        className="text-sm"
                        style={{ color: "var(--wv-redwood)" }}
                      >
                        {params.reason === "missing-token"
                          ? "verification link is missing — please use the link from your email."
                          : params.reason === "expired-token"
                            ? "this verification link has expired. click \u201cresend email\u201d below to get a fresh one."
                            : params.reason === "invalid-token"
                              ? "this verification link is invalid or was already used. try sending a new one below."
                              : "something went wrong with domain verification. please try again."}
                      </p>
                    </div>
                  )}

                  <h3 className="text-lg font-semibold tracking-tight mb-1">
                    {session.orgName || "your organisation"}
                  </h3>
                  <p className="text-sm text-cadet/40 mb-6">
                    {members.length}{" "}
                    {members.length === 1 ? "member" : "members"}
                    {session.orgRole === "admin" &&
                      " \u2014 you are an org admin"}
                  </p>

                  {session.orgRole === "admin" && (
                    <div className="mb-8">
                      <h4
                        className="text-sm font-semibold tracking-tight mb-1"
                        style={{ color: "var(--wv-cadet)" }}
                      >
                        verified domains
                      </h4>
                      <p className="text-xs text-cadet/40 mb-3">
                        verify your email domain so colleagues auto-join when
                        they sign in.
                      </p>
                      <DomainVerifier
                        initialDomains={domains}
                        userEmail={session.email}
                      />
                    </div>
                  )}

                  <TeamManager
                    initialMembers={members}
                    currentUserId={session.userId}
                    isOrgAdmin={session.orgRole === "admin"}
                  />
                </section>
              )}

              {/* analytics section */}
              <section>
                <h3 className="text-lg font-semibold tracking-tight mb-1">
                  analytics
                </h3>
                <p className="text-sm text-cadet/40 mb-6">
                  playdates used, evidence captured, and trends over time.
                </p>
                <AnalyticsDashboard />
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}

/* ── helper ── */

function StatPill({
  label,
  accent,
}: {
  label: string;
  accent?: "champagne" | "sienna" | "redwood";
}) {
  const colors = {
    champagne: "bg-champagne/20 text-cadet/60",
    sienna: "bg-sienna/10 text-sienna/70",
    redwood: "bg-redwood/10 text-redwood/70",
  };
  const cls = accent ? colors[accent] : "bg-cadet/5 text-cadet/50";
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
