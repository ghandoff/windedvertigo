import OpportunitySlider from "../components/opportunity-slider";

export default function MarketMindPage() {
  return (
    <main id="main" className="flex-1 min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <div className="mb-2">
        <a href="/harbour" className="text-sm text-[var(--color-text-on-dark-muted)] hover:text-[var(--wv-champagne)] transition-colors">
          &larr; back to the harbour
        </a>
      </div>

      <span className="inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wider uppercase rounded-full bg-[var(--wv-sienna)]/20 text-[var(--wv-sienna)] border border-[var(--wv-sienna)]/30">
        prototype
      </span>

      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">market.mind</h1>
      <p className="text-lg text-[var(--color-text-on-dark-muted)] mb-4 max-w-xl">every yes is a thousand nos.</p>
      <p className="text-sm text-[var(--color-text-on-dark-muted)] mb-10 max-w-xl">
        you have <strong className="text-[var(--wv-champagne)]">100 hours</strong> this month. how will you spend them?
      </p>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-10">
        <OpportunitySlider />
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">what you&apos;ll explore</h2>
        <ul className="space-y-2 text-[var(--color-text-on-dark-muted)]">
          <li>opportunity cost</li>
          <li>marginal thinking</li>
          <li>comparative advantage</li>
          <li>sunk cost fallacy</li>
        </ul>
      </section>
    </main>
  );
}
