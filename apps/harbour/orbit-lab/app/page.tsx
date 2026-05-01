import OrbitCanvas from "../components/orbit-canvas";

export default function OrbitLabPage() {
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
        orbit.lab
      </h1>
      <p className="text-lg text-[var(--color-text-on-dark-muted)] mb-10 max-w-xl">
        you don&apos;t understand orbits until you&apos;ve failed to reach one.
      </p>

      <OrbitCanvas />

      <section className="mt-12">
        <h2 className="text-xl font-semibold mb-4">what you&apos;ll explore</h2>
        <ul className="space-y-2 text-[var(--color-text-on-dark-muted)]">
          <li>&#x2022; orbital mechanics &mdash; why falling is the same as orbiting</li>
          <li>&#x2022; conservation of momentum &mdash; what keeps things moving when nothing pushes</li>
          <li>&#x2022; gravity as geometry &mdash; curved space, not invisible forces</li>
          <li>&#x2022; delta-v budgeting &mdash; the cost of changing where you&apos;re going</li>
        </ul>
      </section>
    </main>
  );
}
