import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchPortfolioAssets, fetchSiteContent } from "@/lib/notion";
import { PortfolioGallery } from "@/components/portfolio-gallery";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "do. – winded.vertigo",
  description:
    "explore our portfolio of learning design tools, research outputs, and creative assets.",
  alternates: { canonical: "/do/" },
  openGraph: {
    title: "do. – winded.vertigo",
    description:
      "explore our portfolio of learning design tools, research outputs, and creative assets.",
    url: "/do/",
  },
};

export default async function PortfolioPage() {
  const [assets, homeSections] = await Promise.all([
    fetchPortfolioAssets(),
    fetchSiteContent("home"),
  ]);

  const portfolioAssets = assets.filter((a) => a.showInPortfolio);

  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <div className="container content-narrow">
          <h2 className="hero-title">portfolio</h2>

          <p className="do-intro">
            we design learning experiences, build tools, and produce research
            that helps people and organisations learn through play. below is a
            selection of our work — from pedagogy frameworks to interactive
            products. use the filters to explore by quadrant, or dive into our
            featured case studies.
          </p>

          <div className="do-case-studies">
            <a href="/projects/impactful-five/" className="do-case-study-card">
              <span className="do-case-study-label">case study</span>
              <h3>impactful five</h3>
              <p>
                increasing the agency of faculty as they integrate playful
                pedagogies into responsible management education with the UN
                Global Compact.
              </p>
            </a>
            <a
              href="/projects/play-for-all-accelerator/"
              className="do-case-study-card"
            >
              <span className="do-case-study-label">case study</span>
              <h3>play for all accelerator</h3>
              <p>
                how garrett, maria, and jamie first came together through the
                LEGO Foundation — designing inclusive, developmentally
                appropriate play experiences.
              </p>
            </a>
          </div>

          <PortfolioGallery assets={portfolioAssets} />
        </div>
      </main>

      <SiteFooter sections={homeSections} />
    </>
  );
}
