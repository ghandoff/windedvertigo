/**
 * Checkout success page — shown after Stripe payment completes.
 *
 * The entitlement is granted asynchronously via webhook,
 * which typically fires before or shortly after this page loads.
 *
 * Post-MVP — Stripe integration.
 */

import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ pack?: string; session_id?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { pack } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(177, 80, 67, 0.1)" }}
        >
          <span className="text-2xl">✓</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight mb-3">
          your pack is ready
        </h1>

        <p className="text-sm text-cadet/60 mb-6">
          {pack
            ? `you now have full access to ${pack}. every pattern, every find again prompt — it's all yours.`
            : "your purchase is complete. you now have full access to the pack and all its patterns."}
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/packs"
            className="rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 inline-block"
            style={{ backgroundColor: "#b15043" }}
          >
            go to your packs
          </Link>

          <Link
            href="/"
            className="text-sm text-cadet/50 hover:text-cadet transition-colors"
          >
            back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
