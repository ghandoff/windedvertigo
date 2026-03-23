import type { Metadata } from "next";
import { fetchConferenceExperience } from "@/lib/notion";
import { ConferenceClient } from "./conference-client";
import "./conference.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "reimagining PEDAL Conference 2025 — winded.vertigo",
  description:
    "an immersive design concept reimagining the PEDAL Conference 2025 experience.",
  alternates: { canonical: "/portfolio/conference-experience/" },
  openGraph: {
    title: "reimagining PEDAL Conference 2025 — winded.vertigo",
    description:
      "an immersive design concept reimagining the PEDAL Conference 2025 experience.",
    url: "/portfolio/conference-experience/",
  },
};

export default async function ConferenceExperiencePage() {
  const data = await fetchConferenceExperience();

  return <ConferenceClient data={data} />;
}
