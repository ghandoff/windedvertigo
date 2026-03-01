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

import type { Metadata } from "next";
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
import ProfileDashboard from "@/components/profile-dashboard";
import ProfileYourPacks from "@/components/profile-your-packs";
import ProfileWhatsNext from "@/components/profile-whats-next";
import ProfileJourney from "@/components/profile-journey";
import { getOrgPacksWithProgress } from "@/lib/queries/entitlements";
import { getRecommendedPacks } from "@/lib/queries/packs";
import { getUserCredits } from "@/lib/queries/credits";

export const metadata: Metadata = {
  title: "profile",
  description: "your play journal — packs, progress, and creative journey.",
};
import ProfileManageToggle from "./manage-toggle";
import NotificationPrefs from "./notification-prefs";
import PlayContextSwitcher from "./play-context-switcher";
import SyncTrigger from "@/app/admin/sync/sync-trigger";

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
  try {
    await recomputeUserProgress(session.userId);
  } catch {
    // non-critical — progress recompute can fail without blocking the page
  }
  const [summary, recentRuns, profileStats] = await Promise.all([
    getUserProgressSummary(session.userId).catch(() => ({
      total_tried: 0,
      total_found: 0,
      total_folded: 0,
      total_found_again: 0,
    })),
    getRunsForUser(session, 3, 0).catch(() => []),
    getProfileStats(session.userId),
  ]);
  const hasActivity = summary.total_tried > 0;

  /* ---- play contexts ------------------------------------------------ */
  let playContexts: Array<{
    name: string;
    age_groups: string[];
    contexts: string[];
    energy: string;
    created_at: string;
  }> = [];
  let activeContextName: string | null = null;
  try {
    const ctxResult = await sql.query(
      `SELECT play_contexts, active_context_name FROM users WHERE id = $1`,
      [session.userId],
    );
    playContexts = (ctxResult.rows[0]?.play_contexts ?? []) as typeof playContexts;
    activeContextName = ctxResult.rows[0]?.active_context_name ?? null;
  } catch {
    // columns may not exist if migration 021 hasn't been applied
  }

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

  /* ---- pack progress + recommendations + credits --------------------- */
  const [ownedPacks, recommendedPacks, creditBalance] = await Promise.all([
    hasOrg
      ? getOrgPacksWithProgress(session.orgId!, session.userId).catch(() => [])
      : Promise.resolve([]),
    getRecommendedPacks(session.orgId, session.userId).catch(() => []),
    getUserCredits(session.userId).catch(() => 0),
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
        <section className="mb-10 rounded-xl border border-sienna/15 bg-sienna/[0.03] px-5 py-8 text-center max-w-md mx-auto">
          {/* brand-aligned illustration: seedling / growth */}
          <svg
            viewBox="0 0 80 60"
            width={80}
            height={60}
            className="mx-auto mb-4"
            aria-hidden="true"
          >
            <path d="M40 55V32" stroke="var(--wv-sienna)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <path d="M40 32c-8-12-20-10-22-4s8 12 22 4z" fill="none" stroke="var(--wv-sienna)" strokeWidth="1.3" opacity="0.4" />
            <path d="M40 32c8-12 20-10 22-4s-8 12-22 4z" fill="none" stroke="var(--wv-sienna)" strokeWidth="1.3" opacity="0.4" />
            <circle cx="40" cy="26" r="3" fill="var(--wv-champagne)" stroke="var(--wv-sienna)" strokeWidth="0.8" opacity="0.6" />
            <path d="M30 55h20" stroke="var(--wv-sienna)" strokeWidth="1" strokeLinecap="round" opacity="0.25" />
          </svg>
          <p
            className="text-base font-medium mb-1"
            style={{ color: "var(--wv-sienna)" }}
          >
            your play journey starts here
          </p>
          <p className="text-sm text-cadet/50 mb-4">
            explore a playdate from the sampler and see where curiosity takes you.
          </p>
          <Link
            href="/sampler"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-md"
            style={{
              backgroundColor: "var(--wv-sienna)",
              color: "var(--wv-white)",
            }}
          >
            <span>browse the sampler</span>
            <span aria-hidden>→</span>
          </Link>
        </section>
      )}

      {/* ---- profile dashboard ---------------------------------------- */}
      <ProfileDashboard stats={profileStats} />

      {/* ---- your packs — owned packs with progress ------------------- */}
      <ProfileYourPacks packs={ownedPacks} />

      {/* ---- what's next — recommended unowned packs ------------------- */}
      <ProfileWhatsNext packs={recommendedPacks} />

      {/* ---- your journey — milestone path + progress ---------------- */}
      <ProfileJourney
        totalRuns={profileStats.totalRuns}
        totalEvidence={profileStats.totalEvidence}
        longestStreak={profileStats.longestStreak}
        badgeCounts={profileStats.badgeCounts}
        ownedPacks={ownedPacks}
        creditBalance={creditBalance}
      />

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

              {/* sync section — admin & collective only */}
              {(session.isAdmin || session.isInternal) && (
                <section>
                  <h3 className="text-lg font-semibold tracking-tight mb-1">
                    content sync
                  </h3>
                  <p className="text-sm text-cadet/40 mb-4">
                    pull the latest playdates, packs, and cover images from
                    notion. this usually runs automatically — use this if you
                    just made changes.
                  </p>
                  <SyncTrigger />
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
