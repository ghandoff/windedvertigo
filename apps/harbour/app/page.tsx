import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { GameShowcase, GAMES } from "@/components/game-showcase";
import { CredibilityZone } from "@/components/credibility-zone";
import { ScrollReveal } from "@/components/scroll-reveal";
import credibilityData from "@/data/credibility.json";

export default function HarbourPage() {
  return (
    <>
      <Header />

      <main id="main">
        {/* ── Hero ────────────────────────────────────────────── */}
        <section aria-label="hero" className="min-h-[90vh] flex flex-col items-center justify-center text-center px-6 pt-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-6">
              {credibilityData.hero?.tagline ?? "winded.vertigo presents"}
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-[var(--color-text-on-dark)] leading-[1.1] tracking-tight mb-6">
              {credibilityData.hero?.title ?? "the harbour"}
            </h1>
            <p className="text-lg sm:text-xl text-[var(--color-text-on-dark-muted)] leading-relaxed max-w-xl mx-auto mb-10">
              {credibilityData.hero?.subtitle ?? "playful tools for connection, creativity, and growth."}
            </p>

            {/* Scroll hint */}
            <div className="flex flex-col items-center gap-2 text-[var(--color-text-on-dark-muted)]" aria-hidden="true">
              <span className="text-xs uppercase tracking-widest">
                come in
              </span>
              <svg
                className="w-5 h-5 animate-bounce"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </div>
          </div>
        </section>

        {/* ── play. — games and toys ─────────────────────────── */}
        <div id="play">
          <GameShowcase />
        </div>

        {/* ── Credibility zone ─────────────────────────────────── */}
        <CredibilityZone />

        {/* ── Invitation ───────────────────────────────────────── */}
        <section aria-label="invitation" className="py-20 sm:py-28 text-center px-6">
          <ScrollReveal>
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-on-dark)] mb-4">
                {credibilityData.cta?.heading ?? "ready to play?"}
              </h2>
              <p className="text-[var(--color-text-on-dark-muted)] text-lg">
                {credibilityData.cta?.body ?? "pick a tool and start exploring."}
              </p>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <Footer />
    </>
  );
}
