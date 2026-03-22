import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "projects. – winded.vertigo",
  description:
    "selected engagements where the winded.vertigo collective has partnered with organisations to design learning experiences.",
  alternates: { canonical: "/projects/" },
};

export default function ProjectsPage() {
  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <div className="container content-narrow">
          <section className="content-section">
            <h2 className="hero-title">projects.</h2>
            <p>
              selected engagements where the winded.vertigo collective has
              partnered with organisations to design learning experiences,
              evaluate impact, and build tools for systemic change.
            </p>

            <div className="projects-grid" style={{ marginTop: "var(--space-xl)" }}>
              <article className="project-card">
                <div className="project-card-content">
                  <h3>
                    <Link href="/projects/impactful-five/">impactful five</Link>
                  </h3>
                  <p>
                    increasing the agency of faculty as they integrate the
                    impactful five (i5) into their pedagogies and curricula.
                  </p>
                </div>
              </article>

              <article className="project-card">
                <div className="project-card-content">
                  <h3>
                    <Link href="/projects/play-for-all-accelerator/">
                      play for all accelerator
                    </Link>
                  </h3>
                  <p>
                    the story of the winded.vertigo collective shares many roots
                    through this LEGO Foundation initiative.
                  </p>
                </div>
              </article>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
