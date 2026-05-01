import { ScrollReveal } from "./scroll-reveal";
import type { Skill } from "@/lib/notion";

export type { Skill };

const DOMAIN_META: Record<
  string,
  { label: string; color: string; accent: string }
> = {
  "social & behavioral": {
    label: "social & behavioral skills",
    color: "from-[var(--wv-sienna)] to-[var(--wv-redwood)]",
    accent: "bg-[var(--wv-redwood)]",
  },
  cognitive: {
    label: "cognitive skills",
    color: "from-[var(--wv-cadet)] to-[var(--wv-champagne)]",
    accent: "bg-[var(--wv-cadet)]",
  },
};

const FALLBACK_META = {
  label: "other",
  color: "from-[var(--wv-cadet)] to-[var(--wv-sienna)]",
  accent: "bg-[var(--wv-redwood)]",
};

function SkillCard({ skill }: { skill: Skill }) {
  const meta = DOMAIN_META[skill.domain] ?? FALLBACK_META;

  return (
    <ScrollReveal animation="card-stagger" className="flex">
      <article className="flex flex-col w-full rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 transition-colors duration-300">
        {/* Top stripe */}
        <div className={`h-1 w-full bg-gradient-to-r ${meta.color}`} />

        <div className="flex flex-col flex-1 p-6 gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <span className="text-3xl leading-none">{skill.icon}</span>
            <span
              className={`${meta.accent} text-[var(--color-text-on-dark)] text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0`}
            >
              {skill.domain}
            </span>
          </div>

          {/* Name + description */}
          <div className="flex-1">
            <h3 className="text-lg font-bold text-[var(--color-text-on-dark)] mb-2 leading-tight">
              {skill.name}
            </h3>
            <p className="text-sm leading-relaxed text-[var(--color-text-on-dark-muted)]">
              {skill.description}
            </p>
          </div>

          {/* Skillset tags */}
          {skill.skillsets?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {skill.skillsets.map((s) => (
                <span
                  key={s}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-white/15 text-[var(--color-text-on-dark-muted)]"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Practice prompt */}
          {skill.howToPractice && (
            <div className="border-t border-white/10 pt-4">
              <p className="text-xs font-semibold text-[var(--color-text-on-dark-muted)] mb-1.5 tracking-wider">
                try this
              </p>
              <p className="text-sm leading-relaxed text-[var(--color-text-on-dark-muted)] italic">
                {skill.howToPractice}
              </p>
            </div>
          )}
        </div>
      </article>
    </ScrollReveal>
  );
}

export function DepthChart({ skills }: { skills: Skill[] }) {
  // Group skills by domain in natural order of first appearance
  const domains: string[] = [];
  const byDomain: Record<string, Skill[]> = {};

  for (const skill of skills) {
    if (!byDomain[skill.domain]) {
      domains.push(skill.domain);
      byDomain[skill.domain] = [];
    }
    byDomain[skill.domain].push(skill);
  }

  return (
    <div className="space-y-16">
      {domains.map((dom) => {
        const meta = DOMAIN_META[dom] ?? FALLBACK_META;
        return (
          <section key={dom} aria-label={`${dom} skills`}>
            {/* Domain heading */}
            <ScrollReveal>
              <div className="flex items-center gap-4 mb-3">
                <span
                  className={`${meta.accent} w-2 h-8 rounded-full flex-shrink-0`}
                />
                <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-on-dark)]">
                  {meta.label}
                </h2>
              </div>
              <p className="text-sm text-[var(--color-text-on-dark-muted)] mb-8 ml-6">
                {dom === "social & behavioral"
                  ? "how we relate to others, regulate ourselves, and engage with the world"
                  : "how we think, analyze, create, and solve problems"}
              </p>
            </ScrollReveal>

            {/* Skills grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {byDomain[dom].map((skill) => (
                <SkillCard key={skill.slug} skill={skill} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
