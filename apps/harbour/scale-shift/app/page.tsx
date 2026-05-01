import ScaleExplorer from "../components/scale-explorer";

export default function ScaleShiftPage() {
  return (
    <main id="main" className="flex-1 min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <div className="mb-2">
        <a
          href="/harbour"
          className="text-sm text-[var(--color-text-on-dark-muted)] hover:text-[var(--wv-champagne)] transition-colors"
        >
          &larr; back to the harbour
        </a>
      </div>

      <span className="inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wider uppercase rounded-full bg-[var(--wv-sienna)]/20 text-[var(--wv-sienna)] border border-[var(--wv-sienna)]/30">
        prototype
      </span>

      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
        scale.shift
      </h1>
      <p className="text-lg text-[var(--color-text-on-dark-muted)] mb-10 max-w-xl">
        zoom in until atoms. zoom out until galaxies. you&apos;re in between.
      </p>

      <ScaleExplorer />

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">what you&apos;ll explore</h2>
        <ul className="space-y-2 text-[var(--color-text-on-dark-muted)]">
          <li>&#x2022; scale and proportion &mdash; why size changes everything about how things behave</li>
          <li>&#x2022; emergence at different levels &mdash; how new rules appear when you zoom out</li>
          <li>&#x2022; the relationship between micro and macro &mdash; atoms don&apos;t know they&apos;re part of a galaxy</li>
        </ul>
      </section>
    </main>
  );
}
