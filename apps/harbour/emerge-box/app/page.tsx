import LifeCanvas from "../components/life-canvas";

export default function EmergeBoxPage() {
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

      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">emerge.box</h1>
      <p className="text-lg text-[var(--color-text-on-dark-muted)] mb-10 max-w-xl">three rules. infinite possibilities.</p>

      <LifeCanvas />

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">what you&apos;ll explore</h2>
        <ul className="space-y-2 text-[var(--color-text-on-dark-muted)]">
          <li>emergence — how complex behaviour arises from simple interactions</li>
          <li>cellular automata — the computational universes hiding in grids</li>
          <li>complexity from simplicity — why more rules don&apos;t mean more interesting worlds</li>
          <li>the relationship between rules and behaviour — why prediction fails even when you know every rule</li>
        </ul>
      </section>
    </main>
  );
}
