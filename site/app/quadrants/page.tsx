import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  fetchSiteContent,
  fetchPackageBuilderData,
} from "@/lib/notion";
import { PackageBuilderWizard } from "@/components/package-builder-wizard";
import { QuizErrorBoundary } from "@/components/quiz-error-boundary";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "quadrants. – winded.vertigo",
  description:
    "discover your learning design quadrant and build a custom experience package with our interactive quiz.",
  alternates: { canonical: "/quadrants/" },
  openGraph: {
    type: "website",
    url: "https://www.windedvertigo.com/quadrants/",
    title: "quadrants. – winded.vertigo",
    description:
      "discover your learning design quadrant and build a custom experience package with our interactive quiz.",
  },
  twitter: {
    card: "summary",
    title: "quadrants. – winded.vertigo",
    description:
      "discover your learning design quadrant and build a custom experience package with our interactive quiz.",
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
          <QuizErrorBoundary>
            <PackageBuilderWizard packs={packs} {...(cta?.link ? { ctaLink: cta.link } : {})} />
          </QuizErrorBoundary>
        </div>
      </main>

      <SiteFooter sections={sections} />
    </>
  );
}
