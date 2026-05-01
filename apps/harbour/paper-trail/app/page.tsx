import Link from "next/link";
import { fetchActivities } from "@/lib/notion";

export const revalidate = 3600;

/**
 * paper.trail home — browse activities or jump to gallery.
 * Activities are fetched from Notion; shows placeholder if
 * the database isn't configured yet.
 */

export default async function PaperTrailHome() {
  const activities = await fetchActivities();

  return (
    <main id="main" className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-16 pb-14 sm:pt-20 sm:pb-16">
        <div className="max-w-2xl">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight mb-6 text-[var(--wv-white)]">
            paper.trail
          </h1>
          <p className="text-lg sm:text-xl text-[var(--color-text-on-dark-muted)] leading-relaxed max-w-xl mx-auto mb-8">
            find, fold, unfold, find again. hands-on activities that bridge the
            physical and digital. make something real, then capture and annotate
            what you discover.
          </p>
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-accent-on-dark)] hover:text-[var(--wv-champagne)] no-underline transition-colors"
          >
            view your gallery →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: "1",
              title: "find",
              body: "choose an activity and gather your materials — paper, scissors, markers, whatever the activity calls for.",
            },
            {
              step: "2",
              title: "fold",
              body: "follow the step-by-step instructions. fold, cut, build, observe. let your hands think.",
            },
            {
              step: "3",
              title: "unfold",
              body: "capture your work with your camera. annotate what you notice — stamps, arrows, labels.",
            },
            {
              step: "4",
              title: "find again",
              body: "revisit your gallery of captures. notice patterns. share your discoveries.",
            },
          ].map(({ step, title, body }) => (
            <div
              key={step}
              className="p-5 rounded-xl border border-white/10 bg-white/5"
            >
              <span className="text-xs font-bold text-[var(--wv-sienna)]">
                {step}
              </span>
              <h3 className="text-lg font-bold mt-2 mb-2">{title}</h3>
              <p className="text-sm text-[var(--color-text-on-dark-muted)] leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Activities grid */}
      <section className="max-w-4xl mx-auto px-6 pb-20 w-full">
        <h2 className="text-xs font-semibold tracking-[0.25em] text-[var(--color-accent-on-dark)] mb-6 text-center">
          activities
        </h2>

        {activities.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activities.map((a) => (
              <Link
                key={a.slug}
                href={`/activity/${a.slug}`}
                className="p-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all no-underline group"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[var(--wv-sienna)] uppercase tracking-wider">
                    {a.difficulty}
                  </span>
                  {a.audience && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-[var(--color-text-on-dark-muted)] lowercase">
                      for {a.audience}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold mt-2 mb-2 group-hover:text-[var(--color-accent-on-dark)] transition-colors">
                  {a.title}
                </h3>
                <p className="text-sm text-[var(--color-text-on-dark-muted)] leading-relaxed mb-3">
                  {a.description}
                </p>
                {a.materials.length > 0 && (
                  <p className="text-xs text-[var(--color-text-on-dark-muted)]">
                    materials: {a.materials.join(", ")}
                  </p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-[var(--color-text-on-dark-muted)] mb-4">
              activities are being prepared. check back soon.
            </p>
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--wv-redwood)] text-[var(--color-text-on-dark)] font-semibold hover:brightness-110 transition-all no-underline"
            >
              view your gallery →
            </Link>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="wv-footer mt-auto">
        <div className="wv-footer-inner">
          <p className="wv-footer-copyright">
            © {new Date().getFullYear()} winded.vertigo llc
          </p>
        </div>
      </footer>
    </main>
  );
}
