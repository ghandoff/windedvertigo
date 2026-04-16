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

            <h2>where it started</h2>

            <p>
              the story of the winded.vertigo collective shares many roots.
              while working for the{" "}
              <a href="https://learningthroughplay.com/">LEGO Foundation</a>,{" "}
              <Link href="/we/">garrett</Link> and{" "}
              <Link href="/we/">maria</Link> met and played together with{" "}
              <Link href="/we/">jamie</Link> (he worked with{" "}
              <a href="https://nasen.org.uk/">nasen</a> at the time) on the{" "}
              <a href="https://learningthroughplay.com/play-for-all">
                Play for All Accelerator
              </a>
              .
            </p>

            <p>
              Play for All was the LEGO Foundation&rsquo;s initiative to make
              digital play experiences more inclusive and accessible for children
              with disabilities. the programme brought together ed-tech
              companies, disability organisations, and learning design experts to
              co-develop products that centre the needs of the most marginalised
              learners first — and benefit all children as a result.
            </p>

            <h2>our roles</h2>

            <p>
              jamie consulted many of the teams on universal design and how to
              develop more inclusive programming and interfaces. his background
              in inclusive education meant he could bridge the gap between
              accessibility standards and the messy, joyful reality of how
              children actually play. he helped teams move beyond compliance
              checklists toward genuinely inclusive design thinking.
            </p>

            <p>
              garrett and maria consulted on designing for learning through play
              and how to design responsibly for the wellbeing of children. they
              brought a developmental lens — asking not just &ldquo;is this
              fun?&rdquo; but &ldquo;does this support the kind of playful
              learning that leads to growth?&rdquo; together they helped teams
              think about challenge calibration, emotional safety, and the
              difference between engagement and genuine learning.
            </p>

            <p>
              the three of them harmonised on how to leverage developmental
              appropriateness of learning experiences to challenge learners in
              games — finding the sweet spot where play is accessible enough to
              welcome everyone and challenging enough to keep them growing.
            </p>

            <h2>the ripple effect</h2>

            <p>
              the accelerator ran across multiple cohorts and geographies,
              supporting teams building everything from literacy apps to
              therapeutic games. for garrett, maria, and jamie, the experience
              crystallised something they&rsquo;d each felt separately: that the
              most powerful learning design happens at the intersection of play,
              inclusion, and rigorous developmental thinking.
            </p>

            <p>
              and now, they get to play together all the time as part of the
              winded.vertigo collective. the values they practised at Play for
              All — design with (not for), start with the margins, make it
              playful — became the DNA of everything w.v does.
            </p>

            <div className="what-we-learned">
              <h2>what we learned</h2>
              <p>
                inclusion isn&rsquo;t a feature you bolt on at the end — it&rsquo;s
                a design posture you adopt from the first sketch. the teams that
                made the most progress were the ones that brought children with
                disabilities into the design process early, not as testers but
                as co-designers.
              </p>
              <p>
                we also learned that &ldquo;play for all&rdquo; doesn&rsquo;t
                mean &ldquo;the same play for everyone.&rdquo; the best
                inclusive designs offered multiple pathways — different ways to
                engage, different levels of challenge, different modalities —
                so every child could find their way in.
              </p>
            </div>

            <p>
              <Link href="/do/" className="back-link">
                &#8592; back to portfolio
              </Link>
            </p>
          </article>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
