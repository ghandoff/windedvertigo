import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchSiteContent } from "@/lib/notion";
import { Primer } from "./primer";

export const revalidate = 300;

const TITLE = "holistic skills: a primer — winded.vertigo";
const DESCRIPTION =
  "a guide to identifying and measuring 21 holistic skills in PRME pedagogy — definitions, what to look for in lesson plans, and validated measures.";
const URL = "/portfolio/holistic-skills-a-primer/";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
  },
};

export default async function HolisticSkillsPrimerPage() {
  const homeSections = await fetchSiteContent("home");

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Primer />
      </main>
      <SiteFooter sections={homeSections} />
    </>
  );
}
