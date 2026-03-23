import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  fetchSiteContent,
  fetchPackageBuilderData,
} from "@/lib/notion";
import { PackageBuilderWizard } from "@/components/package-builder-wizard";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "do. – winded.vertigo",
  description:
    "build your custom learning experience package with our interactive package builder.",
  alternates: { canonical: "/do/" },
  openGraph: {
    title: "do. – winded.vertigo",
    description:
      "build your custom learning experience package with our interactive package builder.",
    url: "/do/",
  },
};

export default async function DoPage() {
  const [sections, packs] = await Promise.all([
    fetchSiteContent("do"),
    fetchPackageBuilderData(),
  ]);

  const cta = sections.find((s) => s.type === "cta");

  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <div className="container content-narrow">
          <h2 className="hero-title">do.</h2>

          <PackageBuilderWizard packs={packs} ctaLink={cta?.link} />
        </div>
      </main>

      <SiteFooter sections={sections} />
    </>
  );
}
