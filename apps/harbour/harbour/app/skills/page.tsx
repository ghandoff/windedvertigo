import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { DepthChart } from "@/components/depth-chart";
import { ScrollReveal } from "@/components/scroll-reveal";
import { fetchSkills } from "@/lib/notion";

/** ISR: revalidate every hour so Notion edits appear without a redeploy. */
export const revalidate = 3600;

export const metadata = {
  title: "depth.chart — the harbour",
  description:
    "21 social, behavioral, and cognitive skills for navigating complexity, creativity, and connection — charting the skills beneath the surface.",
};

export default async function SkillsPage() {
  const skills = await fetchSkills();

  return (
    <>
      <Header />

      <main id="main">
        {/* ── Hero ────────────────────────────────────────────── */}
        <section
          aria-label="hero"
          className="min-h-[55vh] flex flex-col items-center justify-center text-center px-6 pt-24 pb-12"
        >
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-6">
              the harbour / depth.chart
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-[var(--color-text-on-dark)] leading-[1.1] tracking-tight mb-6">
              depth.chart
            </h1>
            <p className="text-lg sm:text-xl text-[var(--color-text-on-dark-muted)] leading-relaxed max-w-xl mx-auto">
              21 skills across two domains — social & behavioral and
              cognitive — that research shows are essential for navigating
              complexity, uncertainty, and transformation.
            </p>
          </div>
        </section>

        {/* ── Skills grid ─────────────────────────────────────── */}
        <section
          aria-label="skills"
          className="max-w-6xl mx-auto px-6 pb-24"
        >
          <DepthChart skills={skills} />
        </section>

        {/* ── Attribution ──────────────────────────────────────── */}
        <ScrollReveal>
          <div className="text-center py-12 px-6 max-w-xl mx-auto space-y-3">
            <p className="text-xs text-[var(--color-text-on-dark-muted)] leading-relaxed">
              this framework draws on the holistic skills identified by{" "}
              <a
                href="https://www.unprme.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-text-on-dark-muted)] underline hover:text-[var(--wv-champagne)] transition-colors"
              >
                PRME
              </a>{" "}
              and the{" "}
              <a
                href="https://learningthroughplay.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-text-on-dark-muted)] underline hover:text-[var(--wv-champagne)] transition-colors"
              >
                LEGO Foundation
              </a>
              . content is available under{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-text-on-dark-muted)] underline hover:text-[var(--wv-champagne)] transition-colors"
              >
                CC BY 4.0
              </a>
              .
            </p>
            <a
              href="/harbour"
              className="inline-block text-sm text-[var(--color-text-on-dark-muted)] hover:text-[var(--wv-champagne)] transition-colors no-underline"
            >
              ← back to the harbour
            </a>
          </div>
        </ScrollReveal>
      </main>

      <Footer />
    </>
  );
}
