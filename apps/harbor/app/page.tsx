import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { GameShowcase, GAMES } from "@/components/game-showcase";
import { CredibilityZone } from "@/components/credibility-zone";
import { ScrollReveal } from "@/components/scroll-reveal";
import credibilityData from "@/data/credibility.json";

export default function HarborPage() {
  return (
    <>
      <Header />

      <main id="main">
        {/* ── Hero ────────────────────────────────────────────── */}
        <section aria-label="hero" className="min-h-[90vh] flex flex-col items-center justify-center text-center px-6 pt-20 relative overflow-hidden">
          {/* Subtle gradient orb behind text */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-15 blur-3xl pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, var(--wv-redwood) 0%, transparent 70%)",
            }}
          />

          <div className="relative z-10 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-6">
              {credibilityData.hero?.tagline ?? "winded.vertigo presents"}
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-[var(--color-text-on-dark)] leading-[1.1] tracking-tight mb-6">
              {credibilityData.hero?.title ?? "the harbor"}
            </h1>
            <p className="text-lg sm:text-xl text-[var(--color-text-on-dark-muted)] leading-relaxed max-w-xl mx-auto mb-10">
              {credibilityData.hero?.subtitle ?? "playful tools for connection, creativity, and growth."}
            </p>

            {/* Scroll hint */}
            <div className="flex flex-col items-center gap-2 text-[var(--color-text-on-dark-muted)]" aria-hidden="true">
              <span className="text-xs uppercase tracking-widest">
                scroll to explore
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

        {/* ── Quick shelf — mini nav for games ────────────────── */}
        <section id="games" aria-label="games" className="py-6 border-y border-white/5">
          <div className="max-w-4xl mx-auto px-6">
            <ScrollReveal>
              <div className="scroll-shelf justify-start sm:justify-center">
                {GAMES.map((game) => (
                  <a
                    key={game.slug}
                    href={`#${game.slug}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-sm text-[var(--color-text-on-dark)] no-underline whitespace-nowrap"
                  >
                    <span aria-hidden="true">{game.icon}</span> {game.name}
                  </a>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Game showcases — one at a time, alternating ──────── */}
        <GameShowcase />

        {/* ── Credibility zone ─────────────────────────────────── */}
        <CredibilityZone />

        {/* ── Closing CTA ──────────────────────────────────────── */}
        <section aria-label="get started" className="py-20 sm:py-28 text-center px-6">
          <ScrollReveal>
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-on-dark)] mb-4">
                {credibilityData.cta?.heading ?? "ready to play?"}
              </h2>
              <p className="text-[var(--color-text-on-dark-muted)] text-lg mb-8">
                {credibilityData.cta?.body ?? "pick a tool and start exploring."}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                {GAMES.map((game, i) => (
                  <a
                    key={game.slug}
                    href={game.href}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-[var(--color-text-on-dark)] text-sm font-semibold transition-colors no-underline ${
                      i === 0
                        ? "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]"
                        : "bg-white/10 hover:bg-white/15"
                    }`}
                  >
                    {game.icon} explore {game.name}
                  </a>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <Footer />
    </>
  );
}
