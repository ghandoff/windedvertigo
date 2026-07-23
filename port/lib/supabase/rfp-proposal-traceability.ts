import { supabase } from "./client";
import type { ProposalDraft, TraceabilityScore } from "@/lib/ai/proposal-generator";

export interface ProposalTraceabilityRow {
  rfp_id: string;
  generated_at: string;
  citation_trace: ProposalDraft["citationTrace"];
  score: number | null;
  score_breakdown: string[];
  citation_count: number;
}

/** One row per rfp_id — a regeneration upserts, replacing the prior trace. */
export async function upsertProposalTraceability(data: {
  rfpId: string;
  citationTrace: ProposalDraft["citationTrace"];
  traceabilityScore: TraceabilityScore;
  citationCount: number;
}): Promise<void> {
  const { error } = await supabase
    .from("rfp_proposal_traceability")
    .upsert(
      {
        rfp_id: data.rfpId,
        generated_at: new Date().toISOString(),
        citation_trace: data.citationTrace,
        score: data.traceabilityScore.score,
        score_breakdown: data.traceabilityScore.breakdown,
        citation_count: data.citationCount,
      },
      { onConflict: "rfp_id" },
    );
  if (error) throw error;
}

export async function getProposalTraceability(rfpId: string): Promise<ProposalTraceabilityRow | null> {
  const { data, error } = await supabase
    .from("rfp_proposal_traceability")
    .select("*")
    .eq("rfp_id", rfpId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
