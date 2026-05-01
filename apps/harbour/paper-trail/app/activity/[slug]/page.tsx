import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchActivityBySlug } from "@/lib/notion";

export const revalidate = 3600;

/**
 * Activity detail page — step-by-step instructions with
 * materials list and capture prompts.
 */

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const activity = await fetchActivityBySlug(slug);

  if (!activity) {
    notFound();
  }

  return (
    <main id="main" className="min-h-screen flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto px-6 py-10 sm:py-12 w-full">
        {/* Header */}
        <span className="text-xs font-semibold text-[var(--wv-sienna)] uppercase tracking-wider">
          {activity.difficulty}
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold mt-2 mb-2">
          {activity.title}
        </h1>
        {activity.audience && (
          <p className="text-sm text-[var(--color-text-on-dark-muted)] mb-4">
            for {activity.audience}
          </p>
        )}
        <p className="text-lg text-[var(--color-text-on-dark-muted)] leading-relaxed mb-8">
          {activity.description}
        </p>

        {/* Materials */}
        {activity.materials.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-3">
              materials
            </h2>
            <ul className="list-disc list-inside text-sm text-[var(--color-text-on-dark-muted)] space-y-1">
              {activity.materials.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Steps */}
        {activity.steps.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-4">
              instructions
            </h2>
            <ol className="space-y-4">
              {activity.steps.map((step) => (
                <li key={step.order} className="flex gap-4">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-[var(--wv-sienna)]">
                    {step.order}
                  </span>
                  <div>
                    <p className="text-sm leading-relaxed">
                      {step.instruction}
                    </p>
                    {step.hint && (
                      <p className="text-xs text-[var(--color-text-on-dark-muted)] mt-1 italic">
                        hint: {step.hint}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Capture prompts */}
        {activity.capturePrompts.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-3">
              capture prompts
            </h2>
            <div className="space-y-2">
              {activity.capturePrompts.map((prompt) => (
                <Link
                  key={prompt}
                  href={`/capture?activity=${activity.slug}&prompt=${encodeURIComponent(prompt)}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all no-underline group"
                >
                  <span className="text-[var(--wv-sienna)]">📷</span>
                  <span className="text-sm text-[var(--color-text-on-dark-muted)] group-hover:text-[var(--color-text-on-dark)]">
                    {prompt}
                  </span>
                  <span className="ml-auto text-xs text-[var(--color-text-on-dark-muted)]">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {activity.skillSlugs.length > 0 && (
          <div className="flex items-center gap-2 mb-8">
            <span className="text-[10px] text-[var(--color-text-on-dark-muted)] uppercase tracking-wider">
              skills:
            </span>
            {activity.skillSlugs.map((skill) => (
              <span
                key={skill}
                className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-[var(--color-text-on-dark-muted)]"
              >
                {skill.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-3">
          <Link
            href={`/capture?activity=${activity.slug}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--wv-redwood)] text-[var(--color-text-on-dark)] font-semibold hover:brightness-110 transition-all no-underline"
          >
            capture your work →
          </Link>
        </div>
      </div>

      <footer className="wv-footer">
        <div className="wv-footer-inner">
          <p className="wv-footer-copyright">
            © {new Date().getFullYear()} winded.vertigo llc
          </p>
        </div>
      </footer>
    </main>
  );
}
