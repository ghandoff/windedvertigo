import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "play for all accelerator – winded.vertigo",
  description:
    "the story of the winded.vertigo collective shares many roots through this LEGO Foundation initiative.",
  alternates: { canonical: "/projects/play-for-all-accelerator/" },
  openGraph: {
    type: "article",
    url: "https://www.windedvertigo.com/projects/play-for-all-accelerator/",
    title: "play for all accelerator – winded.vertigo",
    description:
      "the story of the winded.vertigo collective shares many roots through this LEGO Foundation initiative.",
  },
  twitter: {
    card: "summary",
    title: "play for all accelerator – winded.vertigo",
    description:
      "the story of the winded.vertigo collective shares many roots through this LEGO Foundation initiative.",
  },
};

export default function PlayForAllAcceleratorPage() {
  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <div className="container content-narrow">
          <article className="project-detail">
            <header className="page-header">
              <h1>play for all accelerator</h1>
            </header>

            <p className="author">garrett jaeger</p>

            <p>
              the story of the winded.vertigo collective shares many roots.
              while working for the{" "}
              <a href="https://learningthroughplay.com/">LEGO foundation</a>,{" "}
              <Link href="/we/">garrett</Link> and{" "}
              <Link href="/we/">maria</Link> met and played together with{" "}
              <Link href="/we/">jamie</Link> (he worked with{" "}
              <a href="https://nasen.org.uk/">nasen</a> at the time) on the{" "}
              <a href="https://learningthroughplay.com/play-for-all">
                play for all accelerator
              </a>
              .
            </p>

            <p>
              jamie consulted many of the teams on universal design and also how
              to develop more inclusive programming and interfaces. garrett and
              maria consulted on designing for learning through play and how to
              design responsibly for the wellbeing of children. the three of them
              harmonized on how to leverage developmental appropriateness of
              learning experiences to challenge learners in games.
            </p>

            <p>
              and now, they get to play together all the time as part of the
              winded.vertigo collective.
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
