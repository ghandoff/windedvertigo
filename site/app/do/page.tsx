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
          <PortfolioGallery assets={portfolioAssets} />
        </div>
      </main>

      <SiteFooter sections={homeSections} />
    </>
  );
}
