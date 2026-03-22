import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "impactful five – winded.vertigo",
  description:
    "increasing the agency of faculty as they integrate the impactful five (i5) into their pedagogies and curricula.",
  alternates: { canonical: "/projects/impactful-five/" },
  openGraph: {
    type: "article",
    url: "https://www.windedvertigo.com/projects/impactful-five/",
    title: "impactful five – winded.vertigo",
    description:
      "increasing the agency of faculty as they integrate the impactful five (i5) into their pedagogies and curricula.",
  },
  twitter: {
    card: "summary",
    title: "impactful five – winded.vertigo",
    description:
      "increasing the agency of faculty as they integrate the impactful five (i5) into their pedagogies and curricula.",
  },
};

export default function ImpactfulFivePage() {
  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <div className="container content-narrow">
          <article className="project-detail">
            <header className="page-header">
              <h1>impactful five</h1>
            </header>

            <p className="author">garrett jaeger</p>

            <h2>brief overview of the learning agenda</h2>

            <p>
              the overarching goal that the United Nations Global Compact (UNGC)
              has for its programme,{" "}
              <a href="https://www.unprme.org/">
                Principles in Responsible Management Education
              </a>{" "}
              (PRME), is to increase the agency of faculty as they integrate
              the{" "}
              <a href="https://www.unprme.org/the-impactful-five-i5/">
                Impactful Five
              </a>{" "}
              (i5) into their pedagogies and curricula. we believe increased
              agency will help activate them to adapt their teaching and
              outcomes to meet contextual needs. this phase of development for
              the PRME initiative includes two intervention themes:
            </p>

            <p>
              provide the PRME community with the{" "}
              <strong>pedagogical resources</strong> they need to thrive. for
              example, provide documentation tools that enable faculty to become
              stronger advocates for responsible management education (RME)
            </p>

            <p>
              provide sufficient <strong>social support</strong> for the growth
              (both in size and spirit) of the PRME community of practice (CoP).
              when faculty feel supported to take risks, they are more likely to
              change their ways of teaching RME.
            </p>

            <h2>learning strategies &amp; evaluation methods</h2>

            <p>
              we want to learn how faculty best plan and facilitate learning
              activities for their students. the{" "}
              <a href="https://www.unprme.org/our-people/">PRME secretariat</a>{" "}
              actively supports these efforts to change and develop new teaching
              approaches. i5 faculty gain access to resources as were requested
              via surveys and other forms of outreach for the community;
              communication and coordination tools that help the community to
              decentralize its operations as a community of practice. these
              enabling structures support a culture of risk-tolerance,
              generosity, and value gains from active engagement.
            </p>

            <p>
              our theory of change: as faculty master playful pedagogies, and
              thus provide high quality playful learning, RME students experience
              more playful learning; students develop holistic skills alongside
              traditional outcomes; students value&mdash;and act upon these
              values&mdash;sustainable business practices; business thrive when
              incoming workforce meets sustainable needs while being prepared to
              innovate in VUCA world.
            </p>

            <p>
              this learning agenda attempts to answer our learning questions
              using validated measurements and rigorous research methods. we
              provide numerous hands-on training for faculty integration of the
              PRME pedagogy, which provides a foundation of understanding by
              faculty in addition to an evidentiary baseline for our monitoring
              of their pedagogical development.
            </p>

            <p>
              <Link href="/do/">&#8592; back to projects</Link>
            </p>
          </article>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
