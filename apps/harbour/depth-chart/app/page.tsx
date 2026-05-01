import Link from "next/link";
import BloomStaircase from "@/components/bloom-staircase";
import StatCounters from "@/components/stat-counters";
import HowItWorks from "@/components/how-it-works";
import DemoPreview from "@/components/demo-preview";
import BloomsGrid from "@/components/blooms-grid";
import TryItBox from "@/components/try-it-box";

export default function DepthChartHome() {
  return (
    <main id="main" className="flex flex-col">
      {/* hero */}
      <section
        aria-label="hero"
        className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-12"
      >
        <div className="max-w-2xl space-y-6">
          <p className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)]">
            winded.vertigo / depth.chart
          </p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-[var(--color-text-on-dark)] leading-[1.1] tracking-tight">
            depth.chart
          </h1>
          <p className="text-lg sm:text-xl text-[var(--color-text-on-dark-muted)] leading-relaxed max-w-xl mx-auto">
            generate methodologically sound formative assessment tasks from
            lesson plans and syllabi — grounded in constructive alignment,
            evaluative judgment theory, and psychometric rigor.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/upload"
              className="inline-block bg-[var(--wv-champagne)] text-[var(--wv-cadet)] font-semibold py-3 px-8 rounded-lg hover:opacity-90 transition-opacity no-underline"
            >
              upload a lesson plan →
            </Link>
            <Link
              href="/plan/history"
              className="inline-block text-sm text-[var(--color-text-on-dark-muted)] hover:text-[var(--wv-champagne)] transition-colors no-underline"
            >
              view plan history
            </Link>
          </div>
        </div>
      </section>

      {/* bloom's staircase visualization */}
      <section aria-label="bloom's staircase" className="px-6 pb-12 relative">
        <BloomStaircase />
      </section>

      {/* stat counters */}
      <section aria-label="stats" className="px-6 pb-16">
        <StatCounters />
      </section>

      {/* credibility strip */}
      <div className="text-center px-6 pb-16">
        <p className="text-[11px] text-[var(--color-text-on-dark-muted)] max-w-2xl mx-auto leading-relaxed">
          grounded in peer-reviewed frameworks:&ensp;
          <span className="text-[var(--color-text-on-dark)] font-medium">constructive alignment</span> (Biggs &amp; Tang, 2011)
          &ensp;·&ensp;
          <span className="text-[var(--color-text-on-dark)] font-medium">evaluative judgment</span> (Tai et al., 2018)
          &ensp;·&ensp;
          <span className="text-[var(--color-text-on-dark)] font-medium">six authenticity criteria</span> (Baquero-Vargas &amp; Pérez-Salas, 2023)
        </p>
      </div>

      {/* how it works — animated timeline */}
      <section
        aria-label="how it works"
        className="bg-white/[0.02] border-y border-white/5 py-20 px-6"
      >
        <h2 className="text-sm font-semibold tracking-[0.2em] text-[var(--color-text-on-dark-muted)] mb-10 text-center">
          how it works
        </h2>
        <HowItWorks />
      </section>

      {/* live demo preview */}
      <section
        aria-label="live demo"
        className="py-20 px-6"
      >
        <h2 className="text-sm font-semibold tracking-[0.2em] text-[var(--color-text-on-dark-muted)] mb-3 text-center">
          see what you get
        </h2>
        <p className="text-xs text-[var(--color-text-on-dark-muted)] text-center mb-10 max-w-md mx-auto">
          click below to see how a single learning objective transforms into a
          complete assessment package
        </p>
        <DemoPreview />
      </section>

      {/* Bloom's taxonomy reference */}
      <section
        aria-label="bloom's taxonomy"
        className="bg-white/[0.02] border-y border-white/5 py-20 px-6"
      >
        <div className="max-w-4xl mx-auto w-full">
          <h2 className="text-sm font-semibold tracking-[0.2em] text-[var(--color-text-on-dark-muted)] mb-8 text-center">
            cognitive levels
          </h2>
          <BloomsGrid />
        </div>
      </section>

      {/* try it now */}
      <section aria-label="try it now" className="py-20 px-6">
        <h2 className="text-sm font-semibold tracking-[0.2em] text-[var(--color-text-on-dark-muted)] mb-8 text-center">
          try it now
        </h2>
        <TryItBox />
      </section>

      {/* footer */}
      <footer className="text-center py-8 px-6 text-xs text-[var(--color-text-on-dark-muted)] border-t border-white/5">
        <p className="opacity-50">
          a winded.vertigo project
        </p>
      </footer>
    </main>
  );
}
