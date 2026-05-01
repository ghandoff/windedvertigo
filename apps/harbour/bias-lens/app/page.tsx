import BiasGame from "../components/bias-game";

export default function BiasLensPage() {
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
        bias.lens
      </h1>
      <p className="text-lg text-[var(--color-text-on-dark-muted)] mb-10 max-w-xl">
        you can&apos;t see your own blind spots. or can you?
      </p>

      <BiasGame />
    </main>
  );
}
