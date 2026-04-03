/**
 * Scenario page — placeholder for Notion-powered scenarios.
 * Will load preset elements + connections from Notion.
 */

import Link from "next/link";

export default function ScenarioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Scenarios will be fetched from Notion in a future iteration.
  // For now, redirect to sandbox.
  return (
    <main id="main" className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <p className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-6">
        tidal.pool / scenario
      </p>
      <h1 className="text-3xl font-bold mb-4">coming soon</h1>
      <p className="text-[var(--color-text-on-dark-muted)] mb-8">
        scenarios are being built. try the sandbox in the meantime.
      </p>
      <Link
        href="/harbour/tidal-pool/sandbox"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--wv-redwood)] text-[var(--color-text-on-dark)] font-semibold hover:brightness-110 transition-all no-underline"
      >
        open sandbox →
      </Link>
    </main>
  );
}
