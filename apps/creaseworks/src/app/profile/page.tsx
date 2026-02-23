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
import { requireAuth } from "@/lib/auth-helpers";
import { getVisiblePacks, getAllPacks } from "@/lib/queries/packs";
import {
  getOrgMembers,
  getOrgVerifiedDomains,
} from "@/lib/queries/organisations";
import PackCard from "@/components/ui/pack-card";
import TeamManager from "@/app/team/team-manager";
import DomainVerifier from "@/app/team/domain-verifier";
import AnalyticsDashboard from "@/app/analytics/analytics-dashboard";
import TierCard, { TIERS } from "@/components/ui/tier-card";
import type { TierState } from "@/components/ui/tier-card";
import ProfileManageToggle from "./manage-toggle";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    manage?: string;
    verify?: string;
    domain?: string;
    reason?: string;
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

  /* ---- packs data -------------------------------------------------- */
  const isCollective = session.isInternal;
  const packs = isCollective ? await getAllPacks() : await getVisiblePacks();

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

  /* should we show the manage toggle at all? */
  const canManage = hasOrg || session.isInternal;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-16 max-w-4xl mx-auto">
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

      {/* ---- your journey — tier cards ----------------------------- */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold tracking-tight mb-1">your journey</h2>
        <p className="text-sm text-cadet/40 mb-5">
          where you are and where you could go.
        </p>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => {
            let state: TierState;
            if (tierLabel === "admin" || tierLabel === "collective") {
              /* admin + collective see everything — collective is "current" */
              state = tier.key === "collective" ? "current" : "current";
            } else if (tierLabel === "entitled") {
              /* entitled users own at least one pack — mark sampler + explorer
                 as unlocked, practitioner as current, collective as available */
              if (tier.key === "sampler" || tier.key === "explorer") {
                state = "current";
              } else if (tier.key === "practitioner") {
                state = "current";
              } else {
                state = "available";
              }
            } else {
              /* sampler — free tier */
              if (tier.key === "sampler") {
                state = "current";
              } else {
                state = "available";
              }
            }
            return (
              <TierCard key={tier.key} tier={tier} state={state} />
            );
          })}
        </div>
      </section>

      {/* ---- my packs — treasure box section ----------------------- */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-lg font-semibold tracking-tight">my packs</h2>
          {isCollective && (
            <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-champagne/20 text-champagne">
              collective view
            </span>
          )}
        </div>
        <p className="text-sm text-cadet/40 mb-5">
          playdates you&apos;ve collected. buy once, keep forever.
        </p>

        {packs.length === 0 ? (
          <div
            className="rounded-2xl border-2 border-dashed py-12 text-center"
            style={{ borderColor: "rgba(39, 50, 72, 0.08)" }}
          >
            <p className="text-cadet/30 text-sm mb-3">
              no packs yet — your collection starts here.
            </p>
            <Link
              href="/sampler"
              className="text-sm font-medium transition-colors"
              style={{ color: "var(--wv-redwood)" }}
            >
              explore free playdates &rarr;
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {packs.map((pack: any) => (
              <div key={pack.id} className="relative">
                {isCollective && pack.visible === false && (
                  <span className="absolute top-3 right-3 z-10 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-cadet/40 text-white/70">
                    hidden
                  </span>
                )}
                {isCollective && pack.status !== "ready" && (
                  <span className="absolute top-3 left-3 z-10 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-600/80 text-white">
                    draft
                  </span>
                )}
                <PackCard pack={pack} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- manage toggle (grownup stuff) ------------------------- */}
      {canManage && (
        <>
          <ProfileManageToggle isOpen={showManage} />

          {showManage && (
            <div className="mt-6 space-y-12">
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
                          : params.reason === "invalid-token"
                            ? "this verification link has expired or was already used. try sending a new one below."
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
                  patterns used, evidence captured, and trends over time.
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
