import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { fetchSiteContent, extractTeamMembers } from "@/lib/notion";
import { TeamGrid } from "@/components/team-grid";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "we. – winded.vertigo",
  description:
    "meet the winded.vertigo collective: developmental psychologists, learning designers, creatives, and researchers.",
  alternates: { canonical: "/we/" },
  openGraph: {
    title: "we. – winded.vertigo",
    description:
      "meet the winded.vertigo collective: developmental psychologists, learning designers, creatives, and researchers.",
    url: "/we/",
  },
};

export default async function WePage() {
  const sections = await fetchSiteContent("we");
  const members = extractTeamMembers(sections);

  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <div className="container content-narrow">
          <TeamGrid members={members} />
        </div>
      </main>

      <SiteFooter sections={sections} />
    </>
  );
}
