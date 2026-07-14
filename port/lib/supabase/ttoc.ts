import { supabase } from "./client";
import type { TtocVerdict, TtocGateInput } from "@/lib/ai/ttoc-gate";

export interface TtocScorecard {
  id: string;
  createdAt: string;
  kind: TtocGateInput["kind"];
  subjectId: string | null;
  title: string;
  verdict: TtocVerdict;
  tag: TtocVerdict["tag"];
  requestedBy: string;
}

interface TtocScorecardRow {
  id: string;
  created_at: string;
  kind: TtocGateInput["kind"];
  subject_id: string | null;
  title: string;
  verdict: TtocVerdict;
  tag: TtocVerdict["tag"];
  requested_by: string;
}

function mapRow(row: TtocScorecardRow): TtocScorecard {
  return {
    id: row.id,
    createdAt: row.created_at,
    kind: row.kind,
    subjectId: row.subject_id,
    title: row.title,
    verdict: row.verdict,
    tag: row.tag,
    requestedBy: row.requested_by,
  };
}

/** Log a ttoc_gate verdict — the auditability the TToC alignment work needs ("a 52/100 defer should say why in TToC terms"). */
export async function insertTtocScorecard(data: {
  kind: TtocGateInput["kind"];
  subjectId?: string;
  title: string;
  verdict: TtocVerdict;
  requestedBy: string;
}): Promise<TtocScorecard> {
  const { data: row, error } = await supabase
    .from("ttoc_scorecards")
    .insert({
      kind: data.kind,
      subject_id: data.subjectId ?? null,
      title: data.title,
      verdict: data.verdict,
      tag: data.verdict.tag,
      requested_by: data.requestedBy,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapRow(row);
}

export async function getRecentTtocScorecards(limit = 20): Promise<TtocScorecard[]> {
  const { data, error } = await supabase
    .from("ttoc_scorecards")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}
