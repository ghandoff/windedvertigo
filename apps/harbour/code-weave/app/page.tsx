import RecursionTree from "../components/recursion-tree";

export default function CodeWeavePage() {
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

      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">code.weave</h1>
      <p className="text-lg text-[var(--color-text-on-dark-muted)] mb-4 max-w-xl">a function that calls itself calls itself calls itself...</p>
      <p className="text-sm text-[var(--color-text-on-dark-muted)] mb-10 max-w-xl">
        watch <strong className="text-[var(--wv-champagne)]">factorial(5)</strong> unfold, one step at a time.
      </p>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-10">
        <RecursionTree />
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">what you&apos;ll explore</h2>
        <ul className="space-y-2 text-[var(--color-text-on-dark-muted)]">
          <li>recursion</li>
          <li>abstraction</li>
          <li>state machines</li>
          <li>declarative vs imperative thinking</li>
        </ul>
      </section>
    </main>
  );
}
