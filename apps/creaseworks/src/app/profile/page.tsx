/**
 * /profile — unified account hub.
 *
 * Consolidates packs, team, and analytics under one page with tabs.
 * Reduces nav from 7 items to 4 (5 with admin).
 *
 * Tabs:
 *   - my packs (default) — pack catalog + purchase
 *   - my team — org management + domain verification
 *   - analytics — run stats dashboard
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

export const dynamic = "force-dynamic";

const TABS = ["packs", "team", "analytics"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  packs: "my packs",
  team: "my team",
  analytics: "analytics",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    verify?: string;
    domain?: string;
    reason?: string;
  }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;

  const activeTab: Tab = TABS.includes(params.tab as Tab)
    ? (params.tab as Tab)
    : "packs";

  /* ---- tier label -------------------------------------------------- */
  const tierLabel = session.isAdmin
    ? "admin"
    : session.isInternal
      ? "collective"
      : session.orgId
        ? "entitled"
        : "sampler";

  /* ---- packs data (always fetch — it's lightweight) ---------------- */
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

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-16 max-w-5xl mx-auto">
      {/* ---- profile header ---------------------------------------- */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1">
          profile
        </h1>
        <div className="flex items-center gap-3 text-sm text-cadet/50">
          <span>{session.email}</span>
          {session.orgName && (
            <>
              <span className="text-cadet/20">·</span>
              <span>{session.orgName}</span>
            </>
          )}
          <span
            className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full"
            style={{
              backgroundColor:
                tierLabel === "admin"
                  ? "rgba(177, 80, 67, 0.12)"
                  : tierLabel === "collective"
                    ? "rgba(203, 120, 88, 0.12)"
                    : "rgba(39, 50, 72, 0.08)",
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

      {/* ---- tab bar ------------------------------------------------ */}
      <div
        className="flex gap-6 mb-8 border-b"
        style={{ borderColor: "rgba(39, 50, 72, 0.1)" }}
      >
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/profile?tab=${tab}`}
            className="pb-2 text-sm font-medium transition-colors -mb-px"
            style={{
              color:
                activeTab === tab ? "var(--wv-cadet)" : "rgba(39, 50, 72, 0.4)",
              borderBottom:
                activeTab === tab
                  ? "2px solid var(--wv-sienna)"
                  : "2px solid transparent",
            }}
          >
            {TAB_LABELS[tab]}
          </Link>
        ))}
      </div>

      {/* ---- tab content ------------------------------------------- */}
      {activeTab === "packs" && (
        <PacksTab packs={packs} isCollective={isCollective} />
      )}
      {activeTab === "team" && (
        <TeamTab
          session={session}
          members={members}
          domains={domains}
          hasOrg={hasOrg}
          verifyStatus={params.verify}
          verifyDomain={params.domain}
          verifyReason={params.reason}
        />
      )}
      {activeTab === "analytics" && <AnalyticsTab />}
    </main>
  );
}

/* ================================================================== */
/*  Tab content components                                             */
/* ================================================================== */

function PacksTab({
  packs,
  isCollective,
}: {
  packs: any[];
  isCollective: boolean;
}) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-semibold tracking-tight">packs</h2>
        {isCollective && (
          <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-champagne/20 text-champagne">
            collective view
          </span>
        )}
      </div>
      <p className="text-cadet/60 text-sm mb-6">
        each pack is a bundle of playdates. you get the full step-by-step guide,
        materials list, and a find again prompt for every playdate inside. buy
        once, keep forever.
      </p>

      {packs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-cadet/40 text-sm">
            no packs available yet. check back soon.
          </p>
          <Link
            href="/sampler"
            className="mt-4 inline-block text-sm text-redwood hover:text-sienna transition-colors"
          >
            browse free playdates &rarr;
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
  );
}

function TeamTab({
  session,
  members,
  domains,
  hasOrg,
  verifyStatus,
  verifyDomain,
  verifyReason,
}: {
  session: {
    orgId: string | null;
    orgName: string | null;
    orgRole: string | null;
    email: string;
    userId: string;
  };
  members: any[];
  domains: any[];
  hasOrg: boolean;
  verifyStatus?: string;
  verifyDomain?: string;
  verifyReason?: string;
}) {
  if (!hasOrg) {
    return (
      <section className="text-center py-16">
        <p className="text-cadet/40 text-sm">
          you&apos;re not part of an organisation yet.
        </p>
        <p className="text-cadet/30 text-xs mt-2">
          when your org admin verifies a domain, signing in with a matching
          email will auto-join you.
        </p>
      </section>
    );
  }

  return (
    <section>
      {/* verification callback banner */}
      {verifyStatus === "success" && verifyDomain && (
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
            <strong>@{verifyDomain}</strong> has been verified. anyone who signs
            in with an @{verifyDomain} email will now auto-join your
            organisation.
          </p>
        </div>
      )}
      {verifyStatus === "error" && (
        <div
          className="rounded-xl border px-4 py-3 mb-6"
          style={{
            borderColor: "rgba(177, 80, 67, 0.2)",
            backgroundColor: "rgba(177, 80, 67, 0.05)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--wv-redwood)" }}>
            {verifyReason === "missing-token"
              ? "verification link is missing — please use the link from your email."
              : verifyReason === "invalid-token"
                ? "this verification link has expired or was already used. try sending a new one below."
                : "something went wrong with domain verification. please try again."}
          </p>
        </div>
      )}

      <h2 className="text-xl font-semibold tracking-tight mb-1">
        {session.orgName || "your organisation"}
      </h2>
      <p className="text-sm text-cadet/50 mb-8">
        {members.length} {members.length === 1 ? "member" : "members"}
        {session.orgRole === "admin" && " \u2014 you are an org admin"}
      </p>

      {/* domain verification — org admins only */}
      {session.orgRole === "admin" && (
        <div className="mb-12">
          <h3
            className="text-lg font-semibold tracking-tight mb-1"
            style={{ color: "var(--wv-cadet)" }}
          >
            verified domains
          </h3>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
          >
            verify your organisation&apos;s email domain so colleagues auto-join
            when they sign in.
          </p>
          <DomainVerifier
            initialDomains={domains}
            userEmail={session.email}
          />
        </div>
      )}

      {/* team members */}
      <div>
        {session.orgRole === "admin" && (
          <h3
            className="text-lg font-semibold tracking-tight mb-4"
            style={{ color: "var(--wv-cadet)" }}
          >
            team members
          </h3>
        )}
        <TeamManager
          initialMembers={members}
          currentUserId={session.userId}
          isOrgAdmin={session.orgRole === "admin"}
        />
      </div>
    </section>
  );
}

function AnalyticsTab() {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight mb-1">analytics</h2>
      <p className="text-sm text-cadet/50 mb-6">
        aggregate statistics across your runs — patterns used, evidence
        captured, and trends over time.
      </p>
      <AnalyticsDashboard />
    </section>
  );
}
