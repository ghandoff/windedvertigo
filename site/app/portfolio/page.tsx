import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchPortfolioAssets, fetchSiteContent } from "@/lib/notion";
import { PortfolioGallery } from "@/components/portfolio-gallery";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "portfolio – winded.vertigo",
  description:
    "explore our portfolio of learning design tools, research outputs, and creative assets.",
  alternates: { canonical: "/portfolio/" },
  openGraph: {
    title: "portfolio – winded.vertigo",
    description:
      "explore our portfolio of learning design tools, research outputs, and creative assets.",
    url: "/portfolio/",
  },
};

export default async function PortfolioPage() {
  const [assets, homeSections] = await Promise.all([
    fetchPortfolioAssets(),
    fetchSiteContent("home"),
  ]);

  // Only show assets marked for portfolio display
  const portfolioAssets = assets.filter((a) => a.showInPortfolio);

  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <div className="container content-narrow">
          <h2 className="hero-title">portfolio</h2>
          <Suspense>
            <PortfolioGallery assets={portfolioAssets} allAssets={assets} />
          </Suspense>
        </div>
      </main>

      <SiteFooter sections={homeSections} />
    </>
  );
}
