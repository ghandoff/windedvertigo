import Link from "next/link";
import { fetchScenarios } from "@/lib/notion";

export const revalidate = 3600; // regenerate hourly via ISR

/**
 * tidal.pool landing page — scenario picker + sandbox entry.
 * Scenarios are fetched from Notion; falls back gracefully if
 * the database isn't configured yet.
 */

export default async function TidalPoolHome() {
  const scenarios = await fetchScenarios();

  return (
    <main id="main" className="flex-1 min-h-0 flex flex-col overflow-y-auto">
      {/* Header */}
      <header className="wv-header">
        <a href="/harbour" className="wv-header-brand">
          ← the harbour
        </a>
        <nav className="wv-header-nav hidden sm:flex">
          <Link href="/sandbox" className="wv-header-nav-link" data-accent>
            sandbox
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-6">
            the harbour / tidal.pool
          </p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight mb-6">
            tidal.pool
          </h1>
          <p className="text-lg sm:text-xl text-[var(--color-text-on-dark-muted)] leading-relaxed max-w-xl mx-auto mb-10">
            a systems thinking sandbox. drop elements into the pool, draw
            connections between them, and watch how everything affects
            everything else.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sandbox"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--wv-redwood)] text-[var(--color-text-on-dark)] font-semibold hover:brightness-110 transition-all no-underline"
            >
              open sandbox
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Scenarios */}
      {scenarios.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 pb-16 w-full">
          <h2 className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-6 text-center">
            scenarios
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((s) => (
              <Link
                key={s.slug}
                href={`/scenario/${s.slug}`}
                className="p-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all no-underline group"
              >
                <span className="text-xs font-semibold text-[var(--wv-sienna)] uppercase tracking-wider">
                  {s.difficulty}
                </span>
                <h3 className="text-lg font-bold mt-2 mb-2 group-hover:text-[var(--color-accent-on-dark)] transition-colors">
                  {s.name}
                </h3>
                <p className="text-sm text-[var(--color-text-on-dark-muted)] leading-relaxed">
                  {s.description}
                </p>
                {s.skillSlugs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {s.skillSlugs.map((skill) => (
                      <span
                        key={skill}
                        className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-[var(--color-text-on-dark-muted)]"
                      >
                        {skill.replace(/-/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: "1",
              title: "drop",
              body: "drag elements from the palette into your pool — rainfall, population, education, anything.",
            },
            {
              step: "2",
              title: "connect",
              body: "shift+click to draw connections. does more rain mean more crops? does pollution reduce wellbeing?",
            },
            {
              step: "3",
              title: "observe",
              body: "press play and watch the system evolve. see feedback loops emerge and ripple effects spread.",
            },
            {
              step: "4",
              title: "tinker",
              body: "pause, adjust a variable, and replay. compare outcomes. what happens if you double the investment?",
            },
          ].map(({ step, title, body }) => (
            <div
              key={step}
              className="p-5 rounded-xl border border-white/10 bg-white/5"
            >
              <span className="text-xs font-bold text-[var(--wv-sienna)]">
                {step}
              </span>
              <h3 className="text-lg font-bold mt-2 mb-2">{title}</h3>
              <p className="text-sm text-[var(--color-text-on-dark-muted)] leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="wv-footer">
        <div className="wv-footer-inner">
          <p className="wv-footer-copyright">
            © {new Date().getFullYear()} winded.vertigo llc
          </p>
        </div>
      </footer>
    </main>
  );
}
