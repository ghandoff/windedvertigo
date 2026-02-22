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
    <main className="min-h-screen" style={{ backgroundColor: "#273248" }}>
      {/* -- hero ------------------------------------------------- */}
      <section className="px-6 py-28 sm:py-36 text-center" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p
          className="text-xs font-semibold tracking-widest uppercase mb-6"
          style={{ color: "#AF4F41", letterSpacing: "0.1em" }}
        >
          a winded.vertigo project
        </p>

        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight"
          style={{ color: "#ffffff", maxWidth: 800, margin: "0 auto 24px" }}
        >
          co-design patterns for people who make things together
        </h1>

        <p
          className="text-lg sm:text-xl mb-12 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.7)", maxWidth: 600, margin: "0 auto 48px" }}
        >
          a library of facilitation patterns — tested scripts, materials lists,
          and guided prompts that help you run creative workshops with confidence.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/sampler"
            className="inline-block rounded-lg px-8 py-3.5 font-medium transition-colors"
            style={{ backgroundColor: "#AF4F41", color: "#ffffff" }}
          >
            browse the sampler
          </Link>
          <Link
            href="/packs"
            className="inline-block rounded-lg px-8 py-3.5 font-medium transition-colors"
            style={{
              border: "1.5px solid rgba(255,255,255,0.25)",
              color: "rgba(255,255,255,0.8)",
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
          style={{ color: "#AF4F41", letterSpacing: "0.08em" }}
        >
          what you get
        </p>
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-4 text-center"
          style={{ color: "#ffffff" }}
        >
          what&rsquo;s inside every pattern
        </h2>
        <p
          className="text-center mb-12"
          style={{ color: "rgba(255,255,255,0.6)", maxWidth: 560, margin: "0 auto 48px" }}
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
          style={{ color: "#AF4F41", letterSpacing: "0.08em" }}
        >
          getting started
        </p>
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-12 text-center"
          style={{ color: "#ffffff" }}
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
          style={{ color: "#AF4F41", letterSpacing: "0.08em" }}
        >
          who it&rsquo;s for
        </p>
        <h2
          className="text-2xl sm:text-3xl font-bold tracking-tight mb-12 text-center"
          style={{ color: "#ffffff" }}
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
          style={{ color: "#ffffff" }}
        >
          start with the sampler
        </h2>
        <p
          className="mb-8 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.6)", maxWidth: 500, margin: "0 auto 32px" }}
        >
          the sampler is free. browse pattern teasers, try the matcher, and
          see how creaseworks works before you buy.
        </p>
        <Link
          href="/sampler"
          className="inline-block rounded-lg px-8 py-3.5 font-medium transition-colors"
          style={{ backgroundColor: "#AF4F41", color: "#ffffff" }}
        >
          explore the sampler
        </Link>
      </section>

      {/* -- footer ----------------------------------------------- */}
      <footer
        className="px-6 py-6"
        style={{ maxWidth: "100%", borderTop: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div
          className="flex flex-col sm:flex-row justify-between items-center gap-4"
          style={{ maxWidth: 1100, margin: "0 auto", padding: "0 30px" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)", marginBottom: 0 }}>
            &copy; copyright winded.vertigo, 2024&ndash;{new Date().getFullYear()}. all rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <a
              href="https://windedvertigo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: "rgba(255,255,255,0.7)" }}
              aria-label="winded.vertigo"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </a>
            <a
              href="https://www.instagram.com/winded.vertigo/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: "rgba(255,255,255,0.7)" }}
              aria-label="Instagram"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/company/winded-vertigo/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: "rgba(255,255,255,0.7)" }}
              aria-label="LinkedIn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>
            <a
              href="https://windedvertigo.substack.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: "rgba(255,255,255,0.7)" }}
              aria-label="Substack"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
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
      style={{ backgroundColor: "#1e2738" }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
        style={{ backgroundColor: "rgba(175,79,65,0.15)", color: "#cb7858" }}
      >
        {icon}
      </div>
      <h3 className="text-sm font-bold mb-2" style={{ color: "#ffffff" }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
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
      style={{ backgroundColor: "#1e2738" }}
    >
      <h3 className="text-base font-bold mb-2" style={{ color: "#ffffff" }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
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
        style={{ backgroundColor: "#AF4F41", color: "#ffffff" }}
      >
        {number}
      </div>
      <div className="pt-1">
        <h3 className="text-base font-bold mb-1" style={{ color: "#ffffff" }}>
          {title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
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
