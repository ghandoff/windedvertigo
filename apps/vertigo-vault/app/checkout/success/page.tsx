import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "purchase confirmed — vertigo.vault",
  description:
    "your vault pack purchase is confirmed. you now have full access.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ pack?: string; session_id?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { pack } = await searchParams;
  const packName = pack || "your vault pack";
  const packDetailHref = pack?.toLowerCase().includes("practitioner")
    ? "/practitioner"
    : "/explorer";

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div
        className="w-full max-w-md p-8 rounded-2xl shadow-lg text-center"
        style={{ backgroundColor: "var(--vault-card-bg)" }}
      >
        {/* success icon */}
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: "rgba(107,142,107,0.15)" }}
        >
          <span className="text-2xl">✓</span>
        </div>

        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--vault-text)" }}
        >
          welcome to {packName}!
        </h1>

        <p
          className="text-sm mb-8 leading-relaxed"
          style={{ color: "var(--vault-text-muted)" }}
        >
          your purchase is confirmed. you now have full access to all activities
          included in this pack.
        </p>

        <Link
          href="/"
          className="inline-block w-full rounded-lg px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--vault-accent)" }}
        >
          browse activities
        </Link>

        <div className="mt-6">
          <Link
            href={packDetailHref}
            className="text-xs underline transition-opacity hover:opacity-80"
            style={{ color: "var(--vault-text-muted)" }}
          >
            view your pack details
          </Link>
        </div>
      </div>
    </main>
  );
}
