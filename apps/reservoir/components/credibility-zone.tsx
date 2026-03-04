import { ScrollReveal } from "./scroll-reveal";

const CREDENTIALS = [
  {
    icon: "\uD83E\uDDE0",
    label: "developmental psychology",
    detail: "grounded in how children actually develop",
  },
  {
    icon: "\uD83C\uDFAF",
    label: "learning design",
    detail: "evidence-based, play-forward pedagogy",
  },
  {
    icon: "\uD83C\uDF0D",
    label: "global context",
    detail: "tested across cultures and communities",
  },
  {
    icon: "\uD83D\uDD2C",
    label: "stealth assessment",
    detail: "documenting learning as it happens",
  },
];

const PRINCIPLES = [
  {
    heading: "designed for development, not just engagement",
    body: "every tool in the reservoir is built on developmental science. we don\u2019t just make things fun \u2014 we design experiences that meet children exactly where they are and invite them to grow. age-appropriate challenge, emotional safety, and progressive depth are baked into every interaction.",
  },
  {
    heading: "play is the mechanism, not the reward",
    body: "we don\u2019t bolt play onto learning as a treat. play is how humans make sense of the world \u2014 it\u2019s the engine of connection, creativity, and resilience. our tools use play as the primary medium for growth, drawing on five years of research at the LEGO foundation and decades of facilitation practice.",
  },
  {
    heading: "evidence checks intuition",
    body: "good design starts with curiosity and gets validated by evidence. we weave real-time documentation and reflection into every experience, so educators and parents can see what\u2019s actually happening \u2014 not just what we hoped would happen.",
  },
];

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
              why these tools
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text-on-dark)] leading-tight max-w-2xl mx-auto">
              built by people who study how humans grow
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
        <ScrollReveal className="mt-20 sm:mt-24">
          <div className="text-center max-w-xl mx-auto">
            <p className="text-sm text-[var(--color-text-on-dark-muted)] leading-relaxed mb-6">
              winded.vertigo is a learning design collective founded by garrett
              jaeger, phd &mdash; former evidence specialist at the LEGO
              foundation, educator, and developmental psychologist. we craft
              experiences where children inspire adults, ideas lead logistics,
              and evidence checks intuition.
            </p>
            <a
              href="https://windedvertigo.com/what/"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent-on-dark)] hover:opacity-80 transition-opacity no-underline"
            >
              learn more about winded.vertigo
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
