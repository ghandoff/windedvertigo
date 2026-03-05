import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import { resolveVaultTier, getVaultActivityCount } from "@/lib/queries/vault";
import PurchaseButton from "@/components/ui/purchase-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "explorer pack — vertigo.vault",
  description: "unlock the full vault with step-by-step activity guides, materials lists, and more.",
};

export default async function ExplorerPackPage() {
  const session = await getSession();

  const accessTier = await resolveVaultTier(
    session?.orgId ?? null,
    session?.userId ?? null,
    session?.isInternal ?? false,
  );

  const totalActivities = await getVaultActivityCount();
  const isAlreadyEntitled = accessTier !== "teaser";

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
          style={{ backgroundColor: "#6b8e6b" }}
        />
        <h1
          className="text-3xl font-bold tracking-tight mb-3"
          style={{ color: "var(--vault-text)" }}
        >
          explorer pack
        </h1>
        <p className="text-lg" style={{ color: "var(--vault-text-muted)" }}>
          unlock the full activity library with step-by-step guides for every
          activity in the vault.
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
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-4xl font-bold" style={{ color: "var(--vault-text)" }}>
            $9.99
          </span>
          <span className="text-sm" style={{ color: "var(--vault-text-muted)" }}>
            one-time purchase
          </span>
        </div>

        {isAlreadyEntitled ? (
          <div
            className="rounded-lg px-5 py-3 text-sm font-medium text-center"
            style={{ backgroundColor: "rgba(107,142,107,0.15)", color: "#8bab8b" }}
          >
            ✓ you already have access to this pack
          </div>
        ) : (
          <PurchaseButton
            packId="vault-explorer"
            label="get the explorer pack"
            className="w-full rounded-lg px-5 py-3 text-sm font-medium text-white"
            style={{ backgroundColor: "#6b8e6b" }}
          />
        )}
      </div>

      {/* what's included */}
      <section className="mb-10">
        <h2
          className="text-sm font-semibold mb-4"
          style={{ color: "rgba(232,237,243,0.8)" }}
        >
          what&apos;s included
        </h2>
        <div className="space-y-3">
          <FeatureItem emoji="📚" title={`${totalActivities} activities`}>
            energizers, reflections, getting-to-know-each-other games, and more — with
            new activities added regularly.
          </FeatureItem>
          <FeatureItem emoji="📝" title="step-by-step guides">
            clear instructions for every activity so you can run them with confidence,
            even on your first try.
          </FeatureItem>
          <FeatureItem emoji="🧰" title="materials checklist">
            know exactly what you need before the session — no more scrambling for supplies.
          </FeatureItem>
          <FeatureItem emoji="👥" title="group size &amp; age recommendations">
            find the perfect activity for your group with duration, size, and age filters.
          </FeatureItem>
          <FeatureItem emoji="🏷️" title="skills &amp; format tags">
            find activities that build specific competencies or fit your session format.
          </FeatureItem>
        </div>
      </section>

      {/* upsell to practitioner */}
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
              want more?
            </h2>
            <p className="text-sm mb-3" style={{ color: "var(--vault-text-muted)" }}>
              the practitioner pack adds facilitator notes and video walkthroughs —
              everything in the explorer pack, plus expert-level guidance.
            </p>
            <Link
              href="/practitioner"
              className="text-sm font-medium underline transition-opacity hover:opacity-80"
              style={{ color: "var(--vault-accent)" }}
            >
              see practitioner pack →
            </Link>
          </div>
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
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-base leading-none mt-0.5">{emoji}</span>
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
