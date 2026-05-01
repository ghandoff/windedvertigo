import { notFound } from "next/navigation";
import { fetchScenarioBySlug, fetchElements, hydrateScenario } from "@/lib/notion";
import { DEFAULT_PALETTE } from "@/lib/palette-data";
import { ScenarioClient } from "./scenario-client";

export const revalidate = 3600;

export default async function ScenarioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const notionScenario = await fetchScenarioBySlug(slug);

  if (!notionScenario) {
    notFound();
  }

  // Use Notion elements if available, otherwise fall back to built-in palette
  const notionElements = await fetchElements();
  const palette = notionElements.length > 0 ? notionElements : DEFAULT_PALETTE;

  const scenario = hydrateScenario(notionScenario, palette);

  return <ScenarioClient scenario={scenario} palette={palette} />;
}
