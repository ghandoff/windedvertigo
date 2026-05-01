import { NextRequest } from "next/server";
import { getOrganization, updateOrganization } from "@/lib/notion/organizations";
import { enrichOrganization } from "@/lib/enrichment/org-enrichment";
import { callClaude } from "@/lib/ai/client";
import { getBudgetStatus } from "@/lib/ai/usage-store";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import type { Organization } from "@/lib/notion/types";

export const maxDuration = 30;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const { id } = await params;

  const budget = await getBudgetStatus();
  if (budget.isOverBudget) {
    return error("Monthly AI budget exceeded. Adjust in AI Hub settings.", 429);
  }

  let org: Organization;
  try {
    org = await getOrganization(id);
  } catch {
    return error("Organization not found", 404);
  }

  // ── 1. Structural enrichment: logo, description, linkedinUrl ──
  // Pass existing LinkedIn URL so enrichment can fetch from it even if the
  // website doesn't publish a JSON-LD sameAs link.
  const enrichResult = await enrichOrganization(
    id,
    org.organization,
    org.website ?? undefined,
    session.user.email,
    org.linkedinUrl ?? undefined,
  );

  const updates: Partial<Organization> = {
    enrichedAt: new Date().toISOString(),
  };

  // Always update from enrichment results (re-enriching should refresh data)
  if (enrichResult.logo) updates.logo = enrichResult.logo;
  if (enrichResult.extracted.description) updates.description = enrichResult.extracted.description;
  if (enrichResult.extracted.linkedinUrl) updates.linkedinUrl = enrichResult.extracted.linkedinUrl;

  // ── 2. Bespoke email copy via Claude ─────────────────────────
  // Generate if missing OR if the stored copy looks like a full cold email
  // (> 450 chars = old prompt that wrote 2–3 paragraphs instead of 2–4 sentences).
  // Hand-crafted short copy (≤ 450 chars) is left untouched.
  const isBloatedCopy = org.bespokeEmailCopy && org.bespokeEmailCopy.length > 450;
  let bespokeGenerated = false;
  if (!org.bespokeEmailCopy || isBloatedCopy) {
    const aboutText = org.description || enrichResult.extracted.description;
    const contextLines = [
      `Organisation: ${org.organization}`,
      org.type ? `Type: ${org.type}` : null,
      org.marketSegment ? `Market segment: ${org.marketSegment}` : null,
      aboutText ? `About: ${aboutText}` : null,
      org.targetServices ? `Target services we offer them: ${org.targetServices}` : null,
      org.buyingTrigger ? `Buying trigger: ${org.buyingTrigger}` : null,
      org.outreachTarget ? `Key contact role: ${org.outreachTarget}` : null,
      org.subject ? `Subject interest: ${org.subject}` : null,
    ].filter(Boolean);

    const copyResult = await callClaude({
      feature: "org-enrichment",
      system: `You are a business development writer for winded.vertigo — a learning design collective that helps organisations design better learning experiences, from curriculum to facilitation to evidence systems. You write warm, specific, human-sounding notes. No clichés.`,
      userMessage: `Write 2–4 sentences of personalised synchronicity copy for this organisation — the specific reasons why winded.vertigo and this org are a natural fit. This is NOT a full cold email — it is the bespoke "why us / why them" section that a human writer will weave into a complete outreach email later.

Focus only on concrete, specific connections between what we do and what they do. Reference their actual work, sector, or focus area. Do not write an opener, closer, or greeting. Do not pitch services generically. Write in first person as Garrett.

${contextLines.join("\n")}

Return ONLY the 2–4 sentence synchronicity copy. Nothing else.`,
      userId: session.user.email,
      maxTokens: 200,
      temperature: 0.75,
    });

    if (copyResult.text.trim()) {
      updates.bespokeEmailCopy = copyResult.text.trim();
      bespokeGenerated = true;
    }
  }

  // ── 3. Persist to Notion ──────────────────────────────────────
  await updateOrganization(id, updates);

  return json({
    logo: !!updates.logo,
    description: !!updates.description,
    linkedinUrl: !!updates.linkedinUrl,
    bespokeEmailCopy: bespokeGenerated,
  });
}
