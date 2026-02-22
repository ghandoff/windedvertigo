/**
 * /team — organisation management page.
 *
 * Shows team members and (for org admins) domain verification.
 * Session 12: added self-service domain verification section and
 *   verification callback banner (from email link redirect).
 */

import { requireAuth } from "@/lib/auth-helpers";
import {
  getOrgMembers,
  getOrgVerifiedDomains,
} from "@/lib/queries/organisations";
import { redirect } from "next/navigation";
import TeamManager from "./team-manager";
import DomainVerifier from "./domain-verifier";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string; domain?: string; reason?: string }>;
}) {
  const session = await requireAuth();

  if (!session.orgId) {
    redirect("/");
  }

  const params = await searchParams;

  const [members, domains] = await Promise.all([
    getOrgMembers(session.orgId),
    session.orgRole === "admin"
      ? getOrgVerifiedDomains(session.orgId)
      : Promise.resolve([]),
  ]);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-16 max-w-4xl mx-auto">
      {/* verification callback banner */}
      {params.verify === "success" && params.domain && (
        <div
          className="rounded-xl border px-4 py-3 mb-6"
          style={{
            borderColor: "rgba(42, 157, 80, 0.2)",
            backgroundColor: "rgba(42, 157, 80, 0.05)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--color-success-vivid)" }}>
            <strong>@{params.domain}</strong> has been verified. anyone who
            signs in with an @{params.domain} email will now auto-join your
            organisation.
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
          <p className="text-sm" style={{ color: "var(--wv-redwood)" }}>
            {params.reason === "missing-token"
              ? "verification link is missing — please use the link from your email."
              : params.reason === "invalid-token"
                ? "this verification link has expired or was already used. try sending a new one below."
                : "something went wrong with domain verification. please try again."}
          </p>
        </div>
      )}

      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">
        {session.orgName || "your organisation"}
      </h1>
      <p className="text-sm text-cadet/50 mb-8">
        {members.length} {members.length === 1 ? "member" : "members"}
        {session.orgRole === "admin" && " \u2014 you are an org admin"}
      </p>

      {/* domain verification — org admins only */}
      {session.orgRole === "admin" && (
        <section className="mb-12">
          <h2
            className="text-lg font-semibold tracking-tight mb-1"
            style={{ color: "var(--wv-cadet)" }}
          >
            verified domains
          </h2>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--wv-cadet)", opacity: 0.5 }}
          >
            verify your organisation&apos;s email domain so colleagues
            auto-join when they sign in.
          </p>
          <DomainVerifier
            initialDomains={domains}
            userEmail={session.email}
          />
        </section>
      )}

      {/* team members */}
      <section>
        {session.orgRole === "admin" && (
          <h2
            className="text-lg font-semibold tracking-tight mb-4"
            style={{ color: "var(--wv-cadet)" }}
          >
            team members
          </h2>
        )}
        <TeamManager
          initialMembers={members}
          currentUserId={session.userId}
          isOrgAdmin={session.orgRole === "admin"}
        />
      </section>
    </main>
  );
}
