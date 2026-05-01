import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import { resolveVaultTier, getVaultActivityCount } from "@/lib/queries/vault";

export const dynamic = "force-dynamic";

const BASE_URL = "https://windedvertigo.com/harbour/vertigo-vault";

export const metadata: Metadata = {
  title: "team access — vertigo.vault",
  description:
    "get vault access for your whole team. one purchase covers everyone in your organisation — explorer or practitioner.",
  alternates: { canonical: `${BASE_URL}/teams` },
  openGraph: {
    type: "website",
    title: "team access — vertigo.vault",
    description:
      "get vault access for your whole team. one purchase covers everyone in your organisation.",
    url: `${BASE_URL}/teams`,
    siteName: "winded.vertigo",
  },
};

export default async function TeamsPage() {
  const session = await getSession();

  const accessTier = await resolveVaultTier(
    session?.orgId ?? null,
    session?.userId ?? null,
    session?.isInternal ?? false,
  );

  const totalActivities = await getVaultActivityCount();
  const hasOrg = !!session?.orgId;
  const isEntitled = accessTier !== "teaser";
  const isPractitioner =
    accessTier === "practitioner" || accessTier === "internal";

  return (
    <main className="min-h-screen px-6 py-16 max-w-2xl mx-auto">
      <Link
        href="/"
        className="text-sm mb-8 inline-block transition-opacity hover:opacity-80"
        style={{ color: "var(--vault-text-muted)" }}
      >
        &larr; back to vault
      </Link>

      {/* hero */}
      <div className="mb-10">
        <div
          className="h-[4px] rounded-full mb-4 w-12"
          style={{ backgroundColor: "#4a7fb5" }}
        />
        <h1
          className="text-3xl font-bold tracking-tight mb-3"
          style={{ color: "var(--vault-text)" }}
        >
          team access
        </h1>
        <p className="text-lg" style={{ color: "var(--vault-text-muted)" }}>
          one purchase, whole-team access. everyone in your organisation gets
          the same pack — no per-seat fees.
        </p>
      </div>

      {/* how it works */}
      <section className="mb-10">
        <h2
          className="text-sm font-semibold mb-4"
          style={{ color: "rgba(232,237,243,0.8)" }}
        >
          how it works
        </h2>
        <div className="space-y-4">
          <StepItem number={1} title="create or join an organisation">
            sign in and set up your team in the harbour. invite colleagues by
            email — they&apos;ll be added to your organisation automatically.
          </StepItem>
          <StepItem number={2} title="choose a pack">
            pick the explorer or practitioner pack. one purchase grants access
            to every current and future member of your organisation.
          </StepItem>
          <StepItem number={3} title="your team is in">
            everyone in the organisation can browse, filter, and use the full
            activity library. no per-seat charges, no invite codes.
          </StepItem>
        </div>
      </section>

      {/* pricing comparison */}
      <section className="mb-10">
        <h2
          className="text-sm font-semibold mb-4"
          style={{ color: "rgba(232,237,243,0.8)" }}
        >
          team pricing
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* explorer */}
          <div
            className="rounded-xl border p-5"
            style={{
              borderColor: "var(--vault-border)",
              backgroundColor: "var(--vault-card-bg)",
            }}
          >
            <p
              className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: "#8bab8b" }}
            >
              explorer pack
            </p>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span
                className="text-2xl font-bold"
                style={{ color: "var(--vault-text)" }}
              >
                $9.99
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--vault-text-muted)" }}
              >
                / team
              </span>
            </div>
            <ul
              className="space-y-1.5 text-sm mb-4"
              style={{ color: "var(--vault-text-muted)" }}
            >
              <li>{totalActivities} activities with step-by-step guides</li>
              <li>materials checklists</li>
              <li>group size &amp; age filters</li>
            </ul>
            {isEntitled ? (
              <div
                className="rounded-lg px-4 py-2 text-xs font-medium text-center"
                style={{
                  backgroundColor: "rgba(107,142,107,0.15)",
                  color: "#8bab8b",
                }}
              >
                ✓ your team has access
              </div>
            ) : (
              <Link
                href="/explorer"
                className="block rounded-lg px-4 py-2 text-sm font-medium text-white text-center transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#6b8e6b" }}
              >
                get explorer pack
              </Link>
            )}
          </div>

          {/* practitioner */}
          <div
            className="rounded-xl border p-5"
            style={{
              borderColor: "rgba(175,79,65,0.25)",
              backgroundColor: "var(--vault-card-bg)",
            }}
          >
            <p
              className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: "var(--vault-accent)" }}
            >
              practitioner pack
            </p>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span
                className="text-2xl font-bold"
                style={{ color: "var(--vault-text)" }}
              >
                $19.99
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--vault-text-muted)" }}
              >
                / team
              </span>
            </div>
            <ul
              className="space-y-1.5 text-sm mb-4"
              style={{ color: "var(--vault-text-muted)" }}
            >
              <li>everything in explorer, plus:</li>
              <li className="font-medium" style={{ color: "var(--vault-text)" }}>
                play catalyst prompts
              </li>
              <li className="font-medium" style={{ color: "var(--vault-text)" }}>
                video walkthroughs
              </li>
            </ul>
            {isPractitioner ? (
              <div
                className="rounded-lg px-4 py-2 text-xs font-medium text-center"
                style={{
                  backgroundColor: "rgba(175,79,65,0.15)",
                  color: "#d4836f",
                }}
              >
                ✓ your team has access
              </div>
            ) : (
              <Link
                href="/practitioner"
                className="block rounded-lg px-4 py-2 text-sm font-medium text-white text-center transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--vault-accent)" }}
              >
                get practitioner pack
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* org status callout */}
      {!session && (
        <section
          className="rounded-xl border p-5 mb-8"
          style={{
            borderColor: "var(--vault-border)",
            backgroundColor: "rgba(74,127,181,0.06)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--vault-text-muted)" }}>
            <span style={{ color: "var(--vault-text)" }}>
              sign in to get started.
            </span>{" "}
            create or join an organisation, then purchase a pack to grant access
            to your whole team.
          </p>
          <Link
            href="/login?callbackUrl=/teams"
            className="inline-block mt-3 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: "rgba(74,127,181,0.25)",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            sign in &rarr;
          </Link>
        </section>
      )}

      {session && !hasOrg && (
        <section
          className="rounded-xl border p-5 mb-8"
          style={{
            borderColor: "var(--vault-border)",
            backgroundColor: "rgba(74,127,181,0.06)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--vault-text-muted)" }}>
            <span style={{ color: "var(--vault-text)" }}>
              you&apos;re not in an organisation yet.
            </span>{" "}
            create one in the harbour to enable team purchases. once set up, any
            pack you buy will cover everyone in your org.
          </p>
          <a
            href="/harbour/creaseworks/org"
            className="inline-block mt-3 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: "rgba(74,127,181,0.25)",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            set up organisation &rarr;
          </a>
        </section>
      )}

      {session && hasOrg && (
        <section
          className="rounded-xl border p-5 mb-8"
          style={{
            borderColor: "rgba(74,127,181,0.2)",
            backgroundColor: "rgba(74,127,181,0.06)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-base leading-none">🏢</span>
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--vault-text)" }}
              >
                {session.orgName}
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--vault-text-muted)" }}
              >
                any pack purchase you make will grant access to everyone in this
                organisation.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="mb-10">
        <h2
          className="text-sm font-semibold mb-4"
          style={{ color: "rgba(232,237,243,0.8)" }}
        >
          frequently asked
        </h2>
        <div className="space-y-4">
          <FaqItem question="how many team members can I add?">
            there&apos;s no per-seat limit. everyone in your organisation gets
            access at no extra cost.
          </FaqItem>
          <FaqItem question="what happens when new members join?">
            they get access immediately. no need to re-purchase or send invite
            codes.
          </FaqItem>
          <FaqItem question="can I upgrade from explorer to practitioner later?">
            yes — purchase the practitioner pack at any time. your team will get
            access to play catalyst coaching prompts and video walkthroughs right away.
          </FaqItem>
          <FaqItem question="what if I don't have an organisation?">
            individual purchases work too. visit the{" "}
            <Link href="/explorer" className="underline">
              explorer
            </Link>{" "}
            or{" "}
            <Link href="/practitioner" className="underline">
              practitioner
            </Link>{" "}
            pack pages to buy for yourself.
          </FaqItem>
        </div>
      </section>

      {/* footer */}
      <footer
        className="mt-16 pt-6 border-t text-center"
        style={{ borderColor: "var(--vault-border)" }}
      >
        <p className="text-xs" style={{ color: "var(--vault-text-muted)" }}>
          purchases are handled securely through{" "}
          <a
            href="https://stripe.com"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stripe
          </a>
          . your team&apos;s access is granted instantly after payment.
        </p>
      </footer>
    </main>
  );
}

/* ── helper components ──────────────────────────────────────────── */

function StepItem({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
        style={{
          backgroundColor: "rgba(74,127,181,0.15)",
          color: "#7aaddb",
        }}
      >
        {number}
      </span>
      <div>
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--vault-text)" }}
        >
          {title}
        </h3>
        <p className="text-sm" style={{ color: "var(--vault-text-muted)" }}>
          {children}
        </p>
      </div>
    </div>
  );
}

function FaqItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: "var(--vault-border)",
        backgroundColor: "var(--vault-card-bg)",
      }}
    >
      <h3
        className="text-sm font-semibold mb-1"
        style={{ color: "var(--vault-text)" }}
      >
        {question}
      </h3>
      <p className="text-sm" style={{ color: "var(--vault-text-muted)" }}>
        {children}
      </p>
    </div>
  );
}
