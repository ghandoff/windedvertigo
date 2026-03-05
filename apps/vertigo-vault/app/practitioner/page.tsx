import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import { resolveVaultTier, getVaultActivityCount } from "@/lib/queries/vault";
import PurchaseButton from "@/components/ui/purchase-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "practitioner pack — vertigo.vault",
  description: "everything in the explorer pack plus facilitator notes, video walkthroughs, and expert guidance.",
};

export default async function PractitionerPackPage() {
  const session = await getSession();

  const accessTier = await resolveVaultTier(
    session?.orgId ?? null,
    session?.userId ?? null,
    session?.isInternal ?? false,
  );

  const totalActivities = await getVaultActivityCount();
  const isAlreadyPractitioner =
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
          style={{ backgroundColor: "var(--vault-accent)" }}
        />
        <h1
          className="text-3xl font-bold tracking-tight mb-3"
          style={{ color: "var(--vault-text)" }}
        >
          practitioner pack
        </h1>
        <p className="text-lg" style={{ color: "var(--vault-text-muted)" }}>
          everything in the explorer pack, plus facilitator notes and video
          walkthroughs for expert-level facilitation.
        </p>
      </div>

      {/* price */}
      <div
        className="rounded-xl border p-6 mb-8"
        style={{
          borderColor: "var(--vault-border)",
          backgroundColor: "var(--vault-card-bg)",
        }}
      >
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-4xl font-bold" style={{ color: "var(--vault-text)" }}>
            $19.99
          </span>
          <span className="text-sm" style={{ color: "var(--vault-text-muted)" }}>
            one-time purchase
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--vault-text-muted)" }}>
          includes everything in the explorer pack ($9.99 value)
        </p>

        {isAlreadyPractitioner ? (
          <div
            className="rounded-lg px-5 py-3 text-sm font-medium text-center"
            style={{ backgroundColor: "rgba(175,79,65,0.15)", color: "#d4836f" }}
          >
            ✓ you already have access to this pack
          </div>
        ) : (
          <PurchaseButton
            packId="vault-practitioner"
            label="get the practitioner pack"
            className="w-full rounded-lg px-5 py-3 text-sm font-medium text-white"
            style={{ backgroundColor: "var(--vault-accent)" }}
          />
        )}
      </div>

      {/* what's included */}
      <section className="mb-10">
        <h2
          className="text-sm font-semibold mb-4"
          style={{ color: "rgba(232,237,243,0.8)" }}
        >
          everything in the explorer pack, plus:
        </h2>
        <div className="space-y-3">
          <FeatureItem emoji="🎯" title="facilitator notes" highlight>
            expert tips for timing, group dynamics, common pitfalls, and how to
            adapt each activity to your specific context.
          </FeatureItem>
          <FeatureItem emoji="🎬" title="video walkthroughs" highlight>
            watch each activity being facilitated to see pacing, energy, and
            transitions in action.
          </FeatureItem>
        </div>

        <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--vault-border)" }}>
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: "var(--vault-text-muted)" }}
          >
            also includes
          </h3>
          <div className="space-y-3">
            <FeatureItem emoji="📚" title={`${totalActivities} activities`}>
              the full library of energizers, reflections, and group activities.
            </FeatureItem>
            <FeatureItem emoji="📝" title="step-by-step guides">
              clear instructions for every activity.
            </FeatureItem>
            <FeatureItem emoji="🧰" title="materials checklist">
              know exactly what you need before each session.
            </FeatureItem>
            <FeatureItem emoji="👥" title="group size &amp; age recommendations">
              find the perfect activity for your group.
            </FeatureItem>
          </div>
        </div>
      </section>

      {/* comparison */}
      <section className="mb-10">
        <h2
          className="text-sm font-semibold mb-4"
          style={{ color: "rgba(232,237,243,0.8)" }}
        >
          compare packs
        </h2>
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--vault-border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--vault-card-bg)" }}>
                <th className="text-left py-3 px-4 font-medium" style={{ color: "var(--vault-text-muted)" }}>
                  feature
                </th>
                <th className="text-center py-3 px-4 font-medium" style={{ color: "#8bab8b" }}>
                  explorer
                </th>
                <th className="text-center py-3 px-4 font-medium" style={{ color: "var(--vault-accent)" }}>
                  practitioner
                </th>
              </tr>
            </thead>
            <tbody>
              <ComparisonRow feature="full activity library" explorer practitioner />
              <ComparisonRow feature="step-by-step guides" explorer practitioner />
              <ComparisonRow feature="materials checklist" explorer practitioner />
              <ComparisonRow feature="filters & search" explorer practitioner />
              <ComparisonRow feature="facilitator notes" practitioner />
              <ComparisonRow feature="video walkthroughs" practitioner />
            </tbody>
          </table>
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
          . your access is granted instantly after payment.
        </p>
      </footer>
    </main>
  );
}

function FeatureItem({
  emoji,
  title,
  children,
  highlight,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 ${highlight ? "rounded-lg p-3 -mx-3" : ""}`}
      style={highlight ? { backgroundColor: "rgba(175,79,65,0.06)" } : undefined}
    >
      <span className="text-base leading-none mt-0.5">{emoji}</span>
      <div>
        <h3
          className="text-sm font-semibold"
          style={{ color: highlight ? "var(--vault-accent)" : "var(--vault-text)" }}
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

function ComparisonRow({
  feature,
  explorer,
  practitioner,
}: {
  feature: string;
  explorer?: boolean;
  practitioner?: boolean;
}) {
  return (
    <tr style={{ borderTop: "1px solid var(--vault-border)" }}>
      <td className="py-2.5 px-4" style={{ color: "var(--vault-text-muted)" }}>
        {feature}
      </td>
      <td className="text-center py-2.5 px-4">
        {explorer ? (
          <span style={{ color: "#8bab8b" }}>✓</span>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.1)" }}>—</span>
        )}
      </td>
      <td className="text-center py-2.5 px-4">
        {practitioner ? (
          <span style={{ color: "var(--vault-accent)" }}>✓</span>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.1)" }}>—</span>
        )}
      </td>
    </tr>
  );
}
