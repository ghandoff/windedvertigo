/**
 * AI proposal generation — synthesises BD assets, org context, and RFP
 * details into a structured first draft ready to edit and submit.
 *
 * Called from the Inngest background job (generate-proposal.ts).
 * Never called synchronously from an HTTP handler.
 */

import { callClaude, parseJsonResponse } from "./client";
import type { RfpOpportunity, Organization, Activity, BdAsset, BibliographyEntry, RateReference } from "@/lib/notion/types";
import { formatRatesForPrompt } from "@/lib/notion/rate-reference";

// ── output schema ─────────────────────────────────────────

export interface ProposalDraft {
  executiveSummary: string;
  understandingOfRequirements: string;
  proposedApproach: string;
  relevantExperience: Array<{
    project: string;
    relevance: string;
    assetId?: string;
  }>;
  teamComposition: string;
  valueProposition: string;
  budgetFramework: string;
  riskMitigation: string;
  clarifyingQuestions: string[];
  missingInfo: string[];
  references: string[];
  /** True if the RFP explicitly or implicitly requires a cover letter. */
  requiresCoverLetter: boolean;
  /** Cover letter text (only populated when requiresCoverLetter is true). */
  coverLetter: string;
  /** Names of team members who should have CVs appended (empty if not required). */
  teamMembersForCvs: string[];
}

// ── QuestionBank types (inlined from lib/inngest/functions/parse-rfp-questions.ts) ──
// Avoids a hard dependency on the inngest module path, which is deleted at G.2.5.

interface QuestionBankEntry {
  number: string;
  text: string;
  suggestedAssets: Array<{ assetId: string; assetName: string; relevanceNote: string }>;
  draftResponse: string;
}

interface QuestionBank {
  rfpId: string;
  rfpName: string;
  generatedAt: string;
  questions: QuestionBankEntry[];
}

// ── input context ─────────────────────────────────────────

export interface ProposalContext {
  rfp: RfpOpportunity;
  org: Organization | null;
  recentActivities: Activity[];
  bdAssets: BdAsset[];
  userId: string;
  documentRequirements?: string | null;
  questionBank?: QuestionBank | null;
  relevantCitations?: BibliographyEntry[] | null;
  /** Rate benchmarks pre-fetched for this funder type and geography. */
  rateRefs?: RateReference[] | null;
}

// ── system prompt ─────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior business development strategist for winded.vertigo — a learning design collective.
The brand name is always "winded.vertigo" (lowercase, with a period). Abbreviate as "w.v". Never "Winded Vertigo".

## What winded.vertigo does
- Learning design, instructional design, curriculum development and sequencing
- Capacity building, train-the-trainer programmes, professional development systems
- Evidence design, monitoring & evaluation (MEL) frameworks, mixed-methods evaluation
- Pedagogy, andragogy, and competency-based learning
- Digital/blended learning experiences
- International development sector (UN, IDB, USAID, foundations, NGOs)

## Voice and tone
Direct, principled, evidence-grounded. Name problems honestly. No corporate filler ("robust", "impactful outcomes", "leverage synergies"). Write as a firm with a point of view. First person "we" throughout.

## Team members — always use real names
- **Garrett Jaeger** — Principal and lead on every proposal. MEL/evidence frameworks, learning design strategy, competency-based curriculum, Global South contexts. 10+ years experience in international development education. Always included.
- **Lamis Sabra** — Facilitation design, train-the-trainer architecture, workshop delivery, participatory learning. **Always included in every proposal.** Lamis is not only the facilitation specialist — she is the team's practitioner experience lead, ensuring everything w.v designs is genuinely appropriate for the people in the room: culturally, experientially, and in terms of pacing, group dynamics, and real-world usability. This contribution is present whether the engagement is heavily facilitation-focused or not.
- **Maria Altamirano Gonzalez** — Practitioner and cultural appropriateness, stakeholder coordination, operations, Latin American/IDB contexts. **Always included in every proposal.** Maria is not a regional specialist who appears only on LatAm bids. She is the team member who ensures that everything w.v creates is genuinely designed for the practitioners and communities it serves — reviewing frameworks, tools, and materials for cultural appropriateness, contextual fit, and real-world usability. She also manages the operational dimensions of every engagement: coordination, scheduling, and ensuring deliverables land correctly. She contributes to every project.
- **James Galpin** — Curriculum development, learning materials design, instructional writing. Include for curriculum or materials-heavy engagements.
- **Payton Jaeger** — Visual communication, tone and messaging strategy, stakeholder buy-in, brand voice, local partner identification and outreach. **Include in every proposal with a substantive description.** Payton's contribution goes well beyond logistics. She leads the visual language and tonal design of all external-facing deliverables, shapes how w.v's work communicates with funders and stakeholders, and ensures that materials — from training content to impact reports — are visually appropriate, clearly pitched, and built for the audiences receiving them. In client engagements, strong communications and stakeholder messaging are programme-level variables, not finishing touches. Payton is also the lead on identifying and vetting local partners.
Always note explicitly if a local partner or context-specific expert is needed that the team does not currently have.

## Citations
You will be given a relevantCitations array — a curated subset of winded.vertigo's annotated bibliography pre-selected for this RFP topic. Use these as your primary citation sources. Cite inline as (Author, year) and include the full citation in the references array. You may also cite authoritative policy sources (UNICEF, OECD, World Bank, Learning Policy Institute) not in the list if directly relevant. Never invent citations — omit rather than fabricate.

## Visual aide suggestions
For complex relationships (theory of change, phased approach, transfer rate comparisons, MEL feedback loops), include a visual aide suggestion as a note in the relevant section: "🎨 Visual aide: [description of what to show and why]".

## Section length requirements — these are MINIMUMS, not targets
- executiveSummary: 4–6 paragraphs. Open with the specific opportunity and why it matters. Name the client's core problem. Explain why w.v is the right partner. Close with a confident statement of what we will deliver. At least 350 words.
- understandingOfRequirements: 3–5 paragraphs. Quote or directly reference specific deliverables from the RFP/requirements. Name constraints (timeline, budget, geography, language). Demonstrate that you have read carefully and understand the stakes. At least 400 words.
- proposedApproach: Full phased methodology. Each phase should have: a name, duration estimate, key activities (3-5 bullet-style items embedded in prose), and specific deliverables. Where a diagram would help (theory of change, evaluation framework, phase timeline), add a 🎨 Visual aide suggestion. At least 600 words.
- relevantExperience: 4–6 entries. Each entry's relevance field must be 3–5 sentences describing the project, what w.v delivered, measurable outcomes where known, and why it is directly applicable. Not just one sentence.
- teamComposition: 5–6 paragraphs. **Maria Altamirano Gonzalez and Lamis Sabra must appear in every team section** — they are vital contributors to every engagement. For each team member, name their specific role in THIS engagement (not their title), their approximate time commitment, and 2–3 sentences on why their background is directly relevant. For Lamis: frame her role around both facilitation design and ensuring the practitioner experience is genuinely appropriate — not just technically competent but humanly usable. For Maria: frame her role as ensuring everything w.v produces is designed for the practitioners it serves and is culturally appropriate to context — not just as an operations lead. **For Payton: write a substantive paragraph describing her visual communication, tone strategy, stakeholder messaging, and brand development contributions** — use this as an opportunity to make the case that communications quality is a programme variable, not a cosmetic one. Do not reduce Payton to "she'll find local partners." End with a paragraph on local partner requirements if any.
- valueProposition: 3–4 paragraphs. Open with what a lesser firm would produce, then explain specifically how w.v's approach is different. Reference w.v's methods, evidence base, and track record. At least 300 words.
- budgetFramework: 2–3 paragraphs. You will be given rateReferenceData — a snapshot of w.v's calibrated daily rate benchmarks for the relevant funder type and geography. Use these specific figures when framing fees. Name actual ranges by role (e.g., "Garrett's principal rate for UN System engagements runs $X–$Y/day; facilitation design at $X–$Y/day"). Explain how we would structure fees (daily rates vs deliverable-based) and what factors would affect total cost. Flag if budget information is missing and how it affects the proposal. Never invent rates — if rateReferenceData is empty, frame the section without specific figures and note that calibration is pending.
- riskMitigation: 2–3 paragraphs. Name 3–4 real risks specific to this engagement (not generic ones) and explain w.v's mitigation approach for each.

## Gaps and missing info
For each item in missingInfo, include a suggested assignee and a short action: e.g., "No budget range provided — Garrett should contact the client before finalising."

## Cover letters and CVs
- Set requiresCoverLetter to true if: the RFP/requirements explicitly ask for a cover letter, letter of interest, expression of interest, or transmittal letter — OR if this is a grant/EOI type submission where a cover letter is standard practice.
- If requiresCoverLetter is true, write the full cover letter in the coverLetter field. Format: [Date], [Recipient name if known / "Procurement Committee"], [Organisation], Re: [RFP title/reference]. 4 paragraphs: (1) who we are and why we are submitting, (2) our understanding of the work and fit, (3) the team and our confidence in delivering, (4) next steps / contact. Sign off as Garrett Jaeger, Principal, winded.vertigo.
- Set teamMembersForCvs to an array of first names of team members who should have CVs included (e.g., ["Garrett", "Lamis"]). Set to [] if CVs are not required.

Output ONLY valid JSON matching this schema (no prose outside the JSON):
{
  "executiveSummary": "...",
  "understandingOfRequirements": "...",
  "proposedApproach": "...",
  "relevantExperience": [{ "project": "...", "relevance": "...", "assetId": "notion_page_id_or_null" }],
  "teamComposition": "...",
  "valueProposition": "...",
  "budgetFramework": "...",
  "riskMitigation": "...",
  "clarifyingQuestions": ["3–5 questions that show the brief was read carefully"],
  "missingInfo": ["up to 4 gaps, each with assignee and action"],
  "references": ["Full APA citation for each source cited inline"],
  "requiresCoverLetter": true/false,
  "coverLetter": "full cover letter text, or empty string if not required",
  "teamMembersForCvs": ["FirstName1", "FirstName2"] or []
}`;

// ── team bio data for CV generation ──────────────────────

export const TEAM_BIOS: Record<string, string> = {
  Garrett: `Garrett Jaeger is the Principal of winded.vertigo and leads all client engagements. He has over ten years of experience in learning design, monitoring and evaluation, and curriculum development for international development organisations including the UN Global Compact (PRME), Inter-American Development Bank, UNICEF, and multiple foundations. His work spans competency-based curriculum design, MEL framework development, evidence synthesis, and the design of professional learning systems for teachers and practitioners. He holds deep expertise in Global South contexts, with active projects in Latin America, Sub-Saharan Africa, and South Asia. Garrett leads all technical proposals and serves as principal investigator on evaluation engagements.`,
  Lamis: `Lamis Sabra is a facilitation designer and train-the-trainer specialist at winded.vertigo. She designs and delivers participatory learning experiences, professional development workshops, and facilitator certification programmes. Her work focuses on building facilitation capacity in organisations and education systems, designing scalable train-the-trainer architectures, and supporting teams to embed reflective practice. She has delivered workshops across multiple continents and is fluent in Arabic and English.`,
  James: `James Galpin is a curriculum developer and instructional writer at winded.vertigo. He specialises in learning materials development, instructional sequencing, and the production of educator-facing resources. He works across formal and non-formal education contexts, with particular expertise in competency-based progressions and evidence-aligned curriculum frameworks.`,
  Maria: `Maria Altamirano Gonzalez is the Practitioner and Cultural Appropriateness Lead at winded.vertigo, and contributes to every engagement the collective takes on. Her core role is ensuring that everything w.v designs — frameworks, curricula, tools, training programmes — is genuinely appropriate for the practitioners and communities it serves: not just technically sound, but contextually grounded, culturally resonant, and usable in the real conditions of the people receiving it. She reviews all programme design through this lens, and her input is a quality gate for every deliverable. She also manages project operations, stakeholder coordination, and the logistical dimensions of complex multi-stakeholder engagements. She is the primary point of contact for IDB procurements and El Salvador-related engagements, and has managed the operational complexity of multi-country development bank programmes. She is fluent in Spanish and English.`,
  Payton: `Payton Jaeger leads visual communication, tone strategy, and stakeholder messaging for winded.vertigo. Her work shapes how w.v's expertise reaches the people it needs to reach — from the visual language and design of training materials and impact reports, to the tonal calibration of proposals, stakeholder briefs, and external communications. She ensures that everything w.v produces communicates clearly and compellingly to its intended audience: the right level of formality, the right visual register, the right narrative frame for funders, partners, and programme staff. In client engagements, Payton contributes substantively to materials design and stakeholder communications strategy, treating visual and tonal quality as programme variables with real consequences for buy-in, adoption, and impact. She also leads on local partner identification and network development, and manages w.v's brand presence and outreach pipeline.`,
};

// ── main function ─────────────────────────────────────────

export async function generateProposal(ctx: ProposalContext): Promise<ProposalDraft> {
  const requirementsText = ctx.documentRequirements?.slice(0, 6000)
    ?? ctx.rfp.requirementsSnapshot?.slice(0, 3000)
    ?? null;

  const payload = {
    rfp: {
      id: ctx.rfp.id,
      name: ctx.rfp.opportunityName,
      type: ctx.rfp.opportunityType,
      dueDate: ctx.rfp.dueDate?.start ?? null,
      estimatedValue: ctx.rfp.estimatedValue,
      fitScore: ctx.rfp.wvFitScore,
      serviceMatch: ctx.rfp.serviceMatch,
      category: ctx.rfp.category,
      geography: ctx.rfp.geography,
      requirementsSnapshot: requirementsText,
      hasFullDocument: !!ctx.documentRequirements,
      url: ctx.rfp.url,
    },
    org: ctx.org ? {
      name: ctx.org.organization,
      type: ctx.org.type,
      category: ctx.org.category,
      connection: ctx.org.connection,
      outreachStatus: ctx.org.outreachStatus,
      description: ctx.org.description?.slice(0, 600) ?? null,
      notes: ctx.org.notes?.slice(0, 400) ?? null,
    } : null,
    recentActivities: ctx.recentActivities.slice(0, 10).map((a) => ({
      type: a.type,
      date: a.date?.start ?? null,
      outcome: a.outcome,
      notes: a.notes?.slice(0, 200) ?? null,
    })),
    questionBank: ctx.questionBank
      ? {
          questionCount: ctx.questionBank.questions.length,
          questions: ctx.questionBank.questions.slice(0, 30).map((q) => ({
            number: q.number,
            text: q.text,
            draftResponse: q.draftResponse,
            suggestedAssets: q.suggestedAssets.map((a) => a.assetName),
          })),
        }
      : null,
    bdAssets: ctx.bdAssets.slice(0, 20).map((a) => ({
      id: a.id,
      name: a.asset,
      type: a.assetType,
      tags: a.tags,
      description: a.description?.slice(0, 400) ?? null,
    })),
    relevantCitations: ctx.relevantCitations
      ? ctx.relevantCitations.slice(0, 15).map((c) => ({
          fullCitation: c.fullCitation,
          abstract: c.abstract?.slice(0, 400) ?? null,
          notes: c.notes?.slice(0, 200) ?? null,
          topic: c.topic,
          sourceType: c.sourceType,
          year: c.year,
        }))
      : [],
    rateReferenceData: ctx.rateRefs && ctx.rateRefs.length > 0
      ? formatRatesForPrompt(ctx.rateRefs)
      : "",
  };

  const result = await callClaude({
    feature: "proposal-generation",
    system: SYSTEM_PROMPT,
    userMessage: JSON.stringify(payload),
    userId: ctx.userId,
    maxTokens: 8192,
    temperature: 0.3,
  });

  const draft = parseJsonResponse<ProposalDraft>(result.text);

  return {
    executiveSummary: draft.executiveSummary ?? "",
    understandingOfRequirements: draft.understandingOfRequirements ?? "",
    proposedApproach: draft.proposedApproach ?? "",
    relevantExperience: Array.isArray(draft.relevantExperience) ? draft.relevantExperience : [],
    teamComposition: draft.teamComposition ?? "",
    valueProposition: draft.valueProposition ?? "",
    budgetFramework: draft.budgetFramework ?? "",
    riskMitigation: draft.riskMitigation ?? "",
    clarifyingQuestions: Array.isArray(draft.clarifyingQuestions) ? draft.clarifyingQuestions : [],
    missingInfo: Array.isArray(draft.missingInfo) ? draft.missingInfo : [],
    references: Array.isArray(draft.references) ? draft.references : [],
    requiresCoverLetter: draft.requiresCoverLetter ?? false,
    coverLetter: draft.coverLetter ?? "",
    teamMembersForCvs: Array.isArray(draft.teamMembersForCvs) ? draft.teamMembersForCvs : [],
  };
}
