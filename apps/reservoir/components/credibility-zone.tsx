import credibilityData from "@/data/credibility.json";
import { ScrollReveal } from "./scroll-reveal";

interface Credential {
  icon: string;
  label: string;
  detail: string;
}

interface Principle {
  heading: string;
  body: string;
}

const CREDENTIALS: Credential[] = credibilityData.credentials;
const PRINCIPLES: Principle[] = credibilityData.principles;

export function CredibilityZone() {
  return (
    <section
      id="why"
      aria-label="why these tools"
      className="py-20 sm:py-32 bg-gradient-to-b from-[var(--wv-cadet)] via-[var(--color-surface-raised)] to-[var(--wv-cadet)]"
    >
      <div className="max-w-5xl mx-auto px-6">
        {/* Section heading */}
        <ScrollReveal>
          <div className="text-center mb-16 sm:mb-20">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-on-dark)] mb-4">
              {credibilityData.sectionLabel}
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text-on-dark)] leading-tight max-w-2xl mx-auto">
              {credibilityData.sectionHeading}
            </h2>
          </div>
        </ScrollReveal>

        {/* Credential pills — horizontal scroll on mobile */}
        <ScrollReveal className="mb-16 sm:mb-20">
          <div className="scroll-shelf justify-start sm:justify-center px-2">
            {CREDENTIALS.map((cred) => (
              <div
                key={cred.label}
                className="credential-pill"
                role="group"
                aria-label={`${cred.label}: ${cred.detail}`}
              >
                <span className="text-lg" aria-hidden="true">
                  {cred.icon}
                </span>
                <span>{cred.label}</span>
                <span className="sr-only"> — {cred.detail}</span>
              </div>
            ))}
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

        {/* Closing statement */}
        {credibilityData.bio && (
          <ScrollReveal className="mt-20 sm:mt-24">
            <div className="text-center max-w-xl mx-auto">
              <p className="text-sm text-[var(--color-text-on-dark-muted)] leading-relaxed mb-6">
                {credibilityData.bio.text}
              </p>
              {credibilityData.bio.link && (
                <a
                  href={credibilityData.bio.link}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent-on-dark)] hover:opacity-80 transition-opacity no-underline"
                >
                  learn more about winded.vertigo
                  <span aria-hidden="true">&rarr;</span>
                </a>
              )}
            </div>
          </ScrollReveal>
        )}
      </div>
    </section>
  );
}
