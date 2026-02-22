import Link from "next/link";
import type { Metadata } from "next";

/**
 * Landing page for creaseworks.
 *
 * Static page (no DB queries) — renders at build time.
 * Dark theme matching windedvertigo.com design language:
 *   - cadet (#273248) background, white text, #1e2738 card surfaces
 *   - redwood accent, champagne hover, lowercase everything
 *   - layout and integration style matches vertigo-vault
 *
 * Session 11: replaced placeholder with marketing landing page.
 * Session 12: redesigned to match windedvertigo.com dark theme and
 *   vertigo-vault integration pattern.
 */

export const metadata: Metadata = {
  title: "creaseworks — co-design patterns for people who make things together",
  description:
    "a library of facilitation patterns — tested scripts, materials lists, and guided prompts that help you run creative workshops with confidence.",
  alternates: { canonical: "https://creaseworks.windedvertigo.com" },
};

export default function Home() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--wv-cadet)" }}>
      {/* -- hero ------------------------------------------------- */}
      <section className="px-6 py-28 sm:py-36 text-center" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p
          className="text-xs font-semibold tracking-widest uppercase mb-6"
          style={{ color: "var(--wv-redwood)", letterSpacing: "0.1em" }}
        >
          a winded.vertigo project
        </p>

        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight"
          style={{ color: "var(--wv-white)", maxWidth: 800, margin: "0 auto 24px" }}
        >
          co-design patterns for people who make things together
        </h1>

        <p
          className="text-lg sm:text-xl mb-12 leading-relaxed"
          style={{ color: "var(--color-text-on-dark-muted)", maxWidth: 600, margin: "0 auto 48px" }}
        >
          a library of facilitation patterns — tested scripts, materials lists,
          and guided prompts that help you run creative workshops with confidence.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/sampler"
            className="inline-block rounded-lg px-8 py-3.5 font-medium transition-colors"
            style={{ backgroundColor: "var(--wv-redwood)", color: "var(--wv-white)" }}
          >
            browse the sampler
          </Link>
          <Link
            href="/packs"
            className="inline-block rounded-lg px-8 py-3.5 font-medium transition-colors"
            style={{
              border: "1.5px solid rgba(255,255,255,0.25)",
              color: "var(--color-text-on-dark)",
              backgroundColor: "transparent",
            }}
          >
            view packs
          </Link>
        </div>
      </section>

      {/* -- what you get ----------------------------------------- */}
      <section className="px-6 py-20 sm:py-24" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p
          className="text-xs font-semibold tracking-widest uppercase text-center mb-3"
          style={{ color: "var(--wv-redwood)", letterSpacing: "0.08em" }}
        >
          what you get
        </p>
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-4 text-center"
          style={{ color: "var(--wv-white)" }}
        >
          what&rsquo;s inside every pattern
        </h2>
        <p
          className="text-center mb-12"
          style={{ color: "var(--color-text-on-dark-muted)", maxWidth: 560, margin: "0 auto 48px" }}
        >
          each pattern is a complete facilitation kit — not just an idea, but
          everything you need to run it.
        </p>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<ScriptIcon />}
            title="find, fold, unfold"
            description="a three-part facilitation script you can run in under two hours. each step has clear instructions, timing, and facilitator notes."
          />
          <FeatureCard
            icon={<MaterialsIcon />}
            title="materials guidance"
            description="exactly what you need on the table — forms, surfaces, connectors, mark-makers — with substitution suggestions when you're working with what you've got."
          />
          <FeatureCard
            icon={<TransferIcon />}
            title="find again"
            description="the step after the workshop. a guided prompt that helps participants spot the same creative move in a completely different context."
          />
          <FeatureCard
            icon={<PdfIcon />}
            title="watermarked PDFs"
            description="download any pattern as a branded PDF card for your facilitation kit. watermarked with your organisation's name and the download date."
          />
        </div>
      </section>

      {/* -- how it works ----------------------------------------- */}
      <section className="px-6 py-20 sm:py-24" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p
          className="text-xs font-semibold tracking-widest uppercase text-center mb-3"
          style={{ color: "var(--wv-redwood)", letterSpacing: "0.08em" }}
        >
          getting started
        </p>
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-12 text-center"
          style={{ color: "var(--wv-white)" }}
        >
          how it works
        </h2>

        <div className="space-y-8" style={{ maxWidth: 640, margin: "0 auto" }}>
          <Step
            number="1"
            title="browse or match"
            description="explore the free sampler to see pattern teasers, or use the matcher to find patterns that fit your materials and context."
          />
          <Step
            number="2"
            title="get a pack"
            description="packs are curated collections of patterns. purchase once and your whole organisation gets perpetual access."
          />
          <Step
            number="3"
            title="run the pattern"
            description="follow the find-fold-unfold script, log your run, capture evidence, and use find again to transfer the learning."
          />
        </div>
      </section>

      {/* -- who it's for ----------------------------------------- */}
      <section className="px-6 py-20 sm:py-24" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p
          className="text-xs font-semibold tracking-widest uppercase text-center mb-3"
          style={{ color: "var(--wv-redwood)", letterSpacing: "0.08em" }}
        >
          who it&rsquo;s for
        </p>
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-12 text-center"
          style={{ color: "var(--wv-white)" }}
        >
          built for facilitators, educators, and design teams
        </h2>

        <div className="grid gap-5 sm:grid-cols-3" style={{ maxWidth: 900, margin: "0 auto" }}>
          <AudienceCard
            title="facilitators"
            description="run creative sessions with tested scripts and materials lists. no more improvising from scratch."
          />
          <AudienceCard
            title="educators"
            description="bring co-design into classrooms with ready-made activities that work for any resource level."
          />
          <AudienceCard
            title="design teams"
            description="give your whole team a shared language for creative facilitation that scales across projects."
          />
        </div>
      </section>

      {/* -- CTA -------------------------------------------------- */}
      <section className="px-6 py-20 sm:py-24 text-center" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-4"
          style={{ color: "var(--wv-white)" }}
        >
          start with the sampler
        </h2>
        <p
          className="mb-8 leading-relaxed"
          style={{ color: "var(--color-text-on-dark-muted)", maxWidth: 500, margin: "0 auto 32px" }}
        >
          the sampler is free. browse pattern teasers, try the matcher, and
          see how creaseworks works before you buy.
        </p>
        <Link
          href="/sampler"
          className="inline-block rounded-lg px-8 py-3.5 font-medium transition-colors"
          style={{ backgroundColor: "var(--wv-redwood)", color: "var(--wv-white)" }}
        >
          explore the sampler
        </Link>
      </section>

    </main>
  );
}

/* -- sub-components (co-located) ----------------------------------- */

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-xl p-6 transition-all"
      style={{ backgroundColor: "var(--color-surface-raised)" }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
        style={{ backgroundColor: "rgba(175,79,65,0.15)", color: "var(--wv-sienna)" }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-bold mb-2" style={{ color: "var(--wv-white)" }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-on-dark-muted)" }}>
        {description}
      </p>
    </div>
  );
}

function AudienceCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-xl p-6 text-center"
      style={{ backgroundColor: "var(--color-surface-raised)" }}
    >
      <h3 className="text-base font-bold mb-2" style={{ color: "var(--wv-white)" }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-on-dark-muted)" }}>
        {description}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-5 items-start">
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ backgroundColor: "var(--wv-redwood)", color: "var(--wv-white)" }}
      >
        {number}
      </div>
      <div className="pt-1">
        <h3 className="text-base font-bold mb-1" style={{ color: "var(--wv-white)" }}>
          {title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-on-dark-muted)" }}>
          {description}
        </p>
      </div>
    </div>
  );
}

/* -- inline SVG icons (brand-matched to w.v colour system) --------- */

function ScriptIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 3h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 7h8M6 10h6M6 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MaterialsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 16l-3-3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 13H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 2h7l5 5v10a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 2v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7 12h6M7 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
