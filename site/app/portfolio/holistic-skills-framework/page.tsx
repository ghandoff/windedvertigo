import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchSiteContent } from "@/lib/notion";
import { SKILL_SETS, SKILLS, TYPE_META } from "@/lib/holistic-skills-data";
import { FrameworkPage } from "./framework-page";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "holistic skills framework — winded.vertigo",
  description:
    "an interactive map of cognitive, social, and behavioral skills and the skill sets they contribute to. click a skill set to see its skills, click a skill to see where it shows up.",
  alternates: {
    canonical: "/portfolio/holistic-skills-framework/",
  },
  openGraph: {
    title: "holistic skills framework — winded.vertigo",
    description:
      "an interactive map of cognitive, social, and behavioral skills and the skill sets they contribute to.",
    url: "/portfolio/holistic-skills-framework/",
  },
};

export default async function HolisticSkillsFrameworkPage() {
  const homeSections = await fetchSiteContent("home");

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <FrameworkPage skills={SKILLS} skillSets={SKILL_SETS} typeMeta={TYPE_META} />
      </main>
      <SiteFooter sections={homeSections} />
    </>
  );
}
