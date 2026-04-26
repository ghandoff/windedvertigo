import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  fetchRegenerativePractices,
  fetchCatalogueSchema,
  fetchSiteContent,
} from "@/lib/notion";
import { CataloguePage } from "./catalogue-page";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "regenerative practices catalogue — winded.vertigo",
  description:
    "a living catalogue of regenerative teaching practices, designed by faculty in the PPCS programme.",
  alternates: {
    canonical: "/portfolio/regenerative-practices-catalogue/",
  },
  openGraph: {
    title: "regenerative practices catalogue — winded.vertigo",
    description:
      "a living catalogue of regenerative teaching practices, designed by faculty in the PPCS programme.",
    url: "/portfolio/regenerative-practices-catalogue/",
  },
};

export default async function RegenerativeCataloguePage() {
  const [practices, schema, homeSections] = await Promise.all([
    fetchRegenerativePractices(),
    fetchCatalogueSchema(),
    fetchSiteContent("home"),
  ]);

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <CataloguePage practices={practices} schema={schema} />
      </main>
      <SiteFooter sections={homeSections} />
    </>
  );
}
