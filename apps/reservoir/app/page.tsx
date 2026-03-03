import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { GameShowcase } from "@/components/game-showcase";
import { CredibilityZone } from "@/components/credibility-zone";
import { ScrollReveal } from "@/components/scroll-reveal";

export default function ReservoirPage() {
  return (
    <>
      <Header />

      <main id="main">
        {/* ── Hero ────────────────────────────────────────────── */}
        <section className="min-h-[90vh] flex flex-col items-center justify-center text-center px-6 pt-20 relative overflow-hidden">
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
              winded.vertigo presents
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] tracking-tight mb-6">
              the reservoir
            </h1>
            <p className="text-lg sm:text-xl text-[var(--color-text-on-dark-muted)] leading-relaxed max-w-xl mx-auto mb-10">
              playful tools for connection, creativity, and growth &mdash;
              designed by developmental psychologists and learning scientists who
              believe play is how humans make sense of the world.
            </p>

            {/* Scroll hint */}
            <div className="flex flex-col items-center gap-2 text-white/30">
              <span className="text-xs uppercase tracking-widest">
                scroll to explore
              </span>
              <svg
                className="w-5 h-5 animate-bounce"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
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
        <section id="games" className="py-6 border-y border-white/5">
          <div className="max-w-4xl mx-auto px-6">
            <ScrollReveal>
              <div className="scroll-shelf justify-start sm:justify-center">
                <a
                  href="#creaseworks"
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-sm text-white/80 no-underline whitespace-nowrap"
                >
                  <span aria-hidden="true">&#127912;</span> creaseworks
                </a>
                <a
                  href="#vertigo-vault"
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-sm text-white/80 no-underline whitespace-nowrap"
                >
                  <span aria-hidden="true">&#9889;</span> vertigo.vault
                </a>
                <a
                  href="#deep-deck"
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-sm text-white/80 no-underline whitespace-nowrap"
                >
                  <span aria-hidden="true">&#127183;</span> deep.deck
                </a>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Game showcases — one at a time, alternating ──────── */}
        <GameShowcase />

        {/* ── Credibility zone ─────────────────────────────────── */}
        <CredibilityZone />

        {/* ── Closing CTA ──────────────────────────────────────── */}
        <section className="py-20 sm:py-28 text-center px-6">
          <ScrollReveal>
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                ready to play?
              </h2>
              <p className="text-[var(--color-text-on-dark-muted)] text-lg mb-8">
                pick a tool and start exploring. every experience is designed to
                be jumped into &mdash; no setup, no accounts, just play.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="/reservoir/creaseworks"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--color-accent)] text-white text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors no-underline"
                >
                  &#127912; explore creaseworks
                </a>
                <a
                  href="/reservoir/vertigo-vault"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 text-white text-sm font-semibold hover:bg-white/15 transition-colors no-underline"
                >
                  &#9889; browse vertigo.vault
                </a>
                <a
                  href="/reservoir/deep-deck"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 text-white text-sm font-semibold hover:bg-white/15 transition-colors no-underline"
                >
                  &#127183; play deep.deck
                </a>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <Footer />
    </>
  );
}
