import { ScrollReveal } from "./scroll-reveal";
import type { CredibilityData } from "@/lib/notion";

interface Principle {
  heading: string;
  body: string;
}

export function CredibilityZone({ data }: { data: CredibilityData }) {
  const credibilityData = data;
  const PRINCIPLES: Principle[] = credibilityData.principles;
  return (
    <>
    <section
      id="finds"
      aria-label="finds"
      className="scroll-mt-24 py-20 sm:py-32 bg-gradient-to-b from-[var(--wv-cadet)] via-[var(--color-surface-raised)] to-[var(--wv-cadet)]"
    >
      <div className="max-w-5xl mx-auto px-6">
        {/* Section heading */}
        <ScrollReveal>
          <div className="text-center mb-16 sm:mb-20">
            <p className="text-xs font-semibold tracking-[0.2em] text-[var(--color-accent-on-dark)] mb-4">
              {credibilityData.sectionLabel}
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text-on-dark)] leading-tight max-w-2xl mx-auto">
              {credibilityData.sectionHeading}
            </h2>
          </div>
        </ScrollReveal>

        {/* Principles — narrative blocks, not a grid */}
        <div className="space-y-16 sm:space-y-20">
          {PRINCIPLES.map((principle, i) => (
            <ScrollReveal key={i}>
              <div className="max-w-2xl mx-auto">
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-[var(--color-accent-on-dark)] text-2xl font-light leading-none mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-semibold text-[var(--color-text-on-dark)] leading-snug">
                    {principle.heading}
                  </h3>
                </div>
                <p className="text-base sm:text-lg leading-relaxed text-[var(--color-text-on-dark-muted)] ml-12">
                  {principle.body}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

      </div>
    </section>

    {/* ── Connection ──────────────────────────────────────── */}
    <section
      id="us"
      aria-label="us"
      className="scroll-mt-24 py-20 sm:py-28 bg-[var(--wv-cadet)]"
    >
      <div className="max-w-5xl mx-auto px-6">
        <ScrollReveal>
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-[0.2em] text-[var(--color-accent-on-dark)] mb-4">
              us
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text-on-dark)] leading-tight max-w-2xl mx-auto">
              {credibilityData.connection?.heading ?? "who holds the harbour"}
            </h2>
          </div>
        </ScrollReveal>
        <ScrollReveal>
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-base sm:text-lg leading-relaxed text-[var(--color-text-on-dark-muted)] mb-8">
              {credibilityData.connection?.body ?? credibilityData.bio?.text}
            </p>
            {(credibilityData.connection?.link ?? credibilityData.bio?.link) && (
              <a
                href={credibilityData.connection?.link ?? credibilityData.bio?.link}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent-on-dark)] hover:opacity-80 transition-opacity no-underline"
              >
                {credibilityData.connection?.linkLabel ?? "more about garrett and winded.vertigo"}
                <span aria-hidden="true">&rarr;</span>
              </a>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
    </>
  );
}
